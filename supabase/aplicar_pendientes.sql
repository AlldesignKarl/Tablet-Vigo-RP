-- =====================================================================
-- El acceso al canal de policía ya no se pide con un código de un solo
-- uso: se concede automáticamente en cuanto un admin le asigna a un
-- ciudadano uno de los empleos policiales (CNP, GC, altos mandos de
-- ambas, UIP, UPR), y se retira si luego se le cambia a otro empleo
-- (incluido desempleado). El sistema de código queda eliminado.
-- =====================================================================

create or replace function public.job_grants_police_access(p_job_code text)
returns boolean language sql immutable as $$
  select coalesce(
    p_job_code = any(array['cnp', 'jefe_cnp', 'gc', 'jefe_gc', 'geo', 'jefe_geo', 'uip', 'jefe_uip', 'upr', 'jefe_upr']),
    false
  );
$$;

-- No expuesta a clientes de forma independiente (no comprueba permisos
-- por sí misma): solo la deben llamar funciones security definer que ya
-- hayan verificado quién puede cambiar el empleo de un ciudadano
-- (admin_set_job, admin_panel_set_job).
create or replace function public.sync_police_access_for_job(p_profile_id uuid, p_job_code text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role;
begin
  select role into v_role from public.profiles where id = p_profile_id;

  if public.job_grants_police_access(p_job_code) then
    insert into public.police_users (profile_id, callsign, authorized)
      values (p_profile_id, 'Z-' || floor(random() * 90 + 10)::text, true)
      on conflict (profile_id) do update set authorized = true;
    if v_role = 'ciudadano' then
      update public.profiles set role = 'policia' where id = p_profile_id;
    end if;
  else
    update public.police_users set authorized = false where profile_id = p_profile_id;
    if v_role = 'policia' then
      update public.profiles set role = 'ciudadano' where id = p_profile_id;
    end if;
  end if;
end;
$$;

-- admin_set_job ahora también sincroniza el acceso policial según el
-- código del empleo que se le asigne al ciudadano.
create or replace function public.admin_set_job(p_profile_id uuid, p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_job_code text;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  update public.bank_accounts set job_id = p_job_id where profile_id = p_profile_id;
  if not found then
    raise exception 'Este ciudadano no tiene cuenta bancaria (no tiene DNI).';
  end if;

  select code into v_job_code from public.jobs where id = p_job_id;
  perform public.sync_police_access_for_job(p_profile_id, v_job_code);

  perform public.write_audit_log(auth.uid(), 'admin_cambio_empleo', p_profile_id::text, jsonb_build_object('job_id', p_job_id));
end;
$$;

-- El acceso por código de un solo uso queda eliminado: ya no hace falta
-- pedirlo ni verificarlo, así que se retiran las funciones y la tabla.
drop function if exists public.request_police_access_code();
drop function if exists public.redeem_police_access_code(text);
drop table if exists public.police_access_codes;
-- =====================================================================
-- Panel Admin de la propia tablet: sección al final del menú protegida
-- por una contraseña numérica compartida (empieza en "0000"), pensada
-- para que cualquiera con esa contraseña pueda cambiar el tema de la
-- tablet y asignar roles/empleos sin necesitar una cuenta con el rol
-- real de admin en la base de datos. La contraseña se comprueba SIEMPRE
-- en el servidor (dentro de cada función); el cliente nunca decide por
-- sí solo si el panel queda "desbloqueado".
-- =====================================================================

create table if not exists public.panel_admin_config (
  id text primary key default 'main',
  password_hash text not null default crypt('0000', gen_salt('bf')),
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  updated_at timestamptz not null default now(),
  constraint panel_admin_config_singleton check (id = 'main')
);

insert into public.panel_admin_config (id) values ('main') on conflict (id) do nothing;

alter table public.panel_admin_config enable row level security;
-- Sin policies para clientes (igual que rate_limits/app_config): solo
-- las funciones de abajo pueden leer/escribir esta tabla, y la
-- contraseña en sí nunca sale de aquí (solo un booleano de "correcta").

-- El límite de intentos solo cuenta las contraseñas INCORRECTAS: así se
-- frena la fuerza bruta sin arriesgarse a bloquear a quien ya conoce la
-- contraseña y solo está usando el panel con normalidad (esta función la
-- llaman también panel_admin_search_citizens y panel_admin_set_job en
-- cada acción, no solo la pantalla de desbloqueo).
create or replace function public.verify_panel_admin_password(p_password text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_hash text;
  v_correct boolean;
  v_allowed boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select password_hash into v_hash from public.panel_admin_config where id = 'main';
  v_correct := v_hash is not null and crypt(p_password, v_hash) = v_hash;

  if not v_correct then
    select public.check_rate_limit('panel_admin_verify_fail:' || auth.uid()::text, 15, 300) into v_allowed;
    if not v_allowed then
      return false;
    end if;
  end if;

  return v_correct;
end;
$$;

-- Lectura pública del tema (no es sensible: hace falta para pintar la
-- tablet igual antes de comprobar ninguna contraseña).
create or replace function public.get_tablet_theme()
returns text language sql stable security definer set search_path = public as $$
  select theme from public.panel_admin_config where id = 'main';
$$;

create or replace function public.panel_admin_set_theme(p_password text, p_theme text)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.verify_panel_admin_password(p_password) then
    return query select false, 'Contraseña incorrecta.';
    return;
  end if;
  if p_theme not in ('dark', 'light') then
    return query select false, 'Tema no válido.';
    return;
  end if;
  update public.panel_admin_config set theme = p_theme, updated_at = now() where id = 'main';
  perform public.write_audit_log(auth.uid(), 'panel_admin_cambio_tema', null, jsonb_build_object('theme', p_theme));
  return query select true, 'Tema actualizado.';
end;
$$;

create or replace function public.panel_admin_set_password(p_current_password text, p_new_password text)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.verify_panel_admin_password(p_current_password) then
    return query select false, 'La contraseña actual no es correcta.';
    return;
  end if;
  if p_new_password !~ '^[0-9]{4,12}$' then
    return query select false, 'La nueva contraseña debe tener solo números (entre 4 y 12 dígitos).';
    return;
  end if;
  update public.panel_admin_config set password_hash = crypt(p_new_password, gen_salt('bf')), updated_at = now() where id = 'main';
  perform public.write_audit_log(auth.uid(), 'panel_admin_password_cambiada', null, '{}'::jsonb);
  return query select true, 'Contraseña actualizada.';
end;
$$;

-- Buscar ciudadanos para asignarles rol/empleo desde el Panel Admin.
-- Misma lógica de búsqueda tokenizada y sin acentos que search_citizens_police.
create or replace function public.panel_admin_search_citizens(p_password text, p_query text)
returns table (
  profile_id uuid,
  first_name text,
  last_name text,
  dni_number text,
  roblox_username text,
  role public.app_role,
  job_id uuid,
  job_code text,
  job_name text
)
language plpgsql security definer set search_path = public as $$
declare
  v_query text := trim(regexp_replace(p_query, '\s+', ' ', 'g'));
  v_tokens text[];
begin
  if not public.verify_panel_admin_password(p_password) then
    raise exception 'Contraseña incorrecta';
  end if;

  v_tokens := string_to_array(v_query, ' ');
  return query
    select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_username, p.role, j.id, j.code, j.name
    from public.dnis d
    join public.profiles p on p.id = d.profile_id
    left join public.bank_accounts b on b.profile_id = d.profile_id
    left join public.jobs j on j.id = b.job_id
    where d.dni_number ilike '%' || v_query || '%'
       or unaccent(lower(d.roblox_username)) ilike unaccent(lower('%' || v_query || '%'))
       or not exists (
            select 1 from unnest(v_tokens) as tok
            where tok <> ''
              and unaccent(lower(d.first_name || ' ' || d.last_name)) not ilike '%' || unaccent(lower(tok)) || '%'
          )
    order by d.first_name
    limit 20;
end;
$$;

-- Asignar empleo/rol desde el Panel Admin: misma lógica que admin_set_job
-- (incluida la sincronización de acceso policial), pero comprobando la
-- contraseña compartida en vez de un rol real de admin.
create or replace function public.panel_admin_set_job(p_password text, p_profile_id uuid, p_job_id uuid)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_job_code text;
begin
  if not public.verify_panel_admin_password(p_password) then
    return query select false, 'Contraseña incorrecta.';
    return;
  end if;

  update public.bank_accounts set job_id = p_job_id where profile_id = p_profile_id;
  if not found then
    return query select false, 'Este ciudadano no tiene cuenta bancaria (no tiene DNI).';
    return;
  end if;

  select code into v_job_code from public.jobs where id = p_job_id;
  perform public.sync_police_access_for_job(p_profile_id, v_job_code);

  perform public.write_audit_log(auth.uid(), 'panel_admin_cambio_empleo', p_profile_id::text, jsonb_build_object('job_id', p_job_id));
  return query select true, 'Rol actualizado correctamente.';
end;
$$;
-- =====================================================================
-- Asuntos Internos: tablón de mensajes persistente para el cuerpo de
-- policía (no es un chat en directo como el antiguo Radio: los mensajes
-- quedan guardados). Solo pueden leerlo y escribir en él quienes tengan
-- acceso policial (is_police_authorized()).
-- =====================================================================

create table if not exists public.internal_affairs_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  callsign text not null,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists internal_affairs_posts_created_at_idx on public.internal_affairs_posts (created_at desc);

alter table public.internal_affairs_posts enable row level security;

drop policy if exists internal_affairs_posts_select on public.internal_affairs_posts;
create policy internal_affairs_posts_select on public.internal_affairs_posts for select using (public.is_police_authorized());
-- Sin policies de insert/update/delete: solo las funciones de abajo escriben.

create or replace function public.post_internal_affairs_message(p_message text)
returns setof public.internal_affairs_posts
language plpgsql security definer set search_path = public as $$
declare
  v_callsign text;
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;

  select callsign into v_callsign from public.police_users where profile_id = auth.uid();

  return query
    insert into public.internal_affairs_posts (author_id, callsign, message)
    values (auth.uid(), coalesce(v_callsign, 'Desconocido'), p_message)
    returning *;
end;
$$;

create or replace function public.delete_internal_affairs_message(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;
  -- Cada agente solo puede borrar sus propios mensajes.
  delete from public.internal_affairs_posts where id = p_id and author_id = auth.uid();
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'internal_affairs_posts'
     )
  then
    alter publication supabase_realtime add table public.internal_affairs_posts;
  end if;
end $$;
-- =====================================================================
-- Redadas: planificación de operativos para la policía. Cada redada
-- tiene un título, notas de texto y trazos dibujados a mano sobre el
-- mapa de ERLC (compartidos entre todos los agentes en tiempo real).
-- Solo pueden verlas y editarlas quienes tengan acceso policial.
-- =====================================================================

create table if not exists public.raids (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  notes text not null default '',
  created_by uuid not null references public.profiles(id) on delete cascade,
  callsign text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.raid_strokes (
  id uuid primary key default gen_random_uuid(),
  raid_id uuid not null references public.raids(id) on delete cascade,
  points jsonb not null,
  color text not null default '#ef4444',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists raid_strokes_raid_id_idx on public.raid_strokes (raid_id);

alter table public.raids enable row level security;
alter table public.raid_strokes enable row level security;

drop policy if exists raids_select on public.raids;
create policy raids_select on public.raids for select using (public.is_police_authorized());
drop policy if exists raid_strokes_select on public.raid_strokes;
create policy raid_strokes_select on public.raid_strokes for select using (public.is_police_authorized());
-- Sin policies de insert/update/delete: solo las funciones de abajo escriben.

create or replace function public.create_raid(p_title text, p_notes text default '')
returns setof public.raids
language plpgsql security definer set search_path = public as $$
declare
  v_callsign text;
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;
  select callsign into v_callsign from public.police_users where profile_id = auth.uid();
  return query
    insert into public.raids (title, notes, created_by, callsign)
    values (p_title, coalesce(p_notes, ''), auth.uid(), coalesce(v_callsign, 'Desconocido'))
    returning *;
end;
$$;

create or replace function public.update_raid_notes(p_raid_id uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;
  update public.raids set notes = p_notes, updated_at = now() where id = p_raid_id;
end;
$$;

create or replace function public.delete_raid(p_raid_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;
  delete from public.raids where id = p_raid_id;
end;
$$;

create or replace function public.add_raid_stroke(p_raid_id uuid, p_points jsonb, p_color text default '#ef4444')
returns setof public.raid_strokes
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;
  if not exists (select 1 from public.raids where id = p_raid_id) then
    raise exception 'Redada no encontrada';
  end if;
  return query
    insert into public.raid_strokes (raid_id, points, color, created_by)
    values (p_raid_id, p_points, coalesce(p_color, '#ef4444'), auth.uid())
    returning *;
end;
$$;

create or replace function public.clear_raid_strokes(p_raid_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;
  delete from public.raid_strokes where raid_id = p_raid_id;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'raids'
     )
  then
    alter publication supabase_realtime add table public.raids;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'raid_strokes'
     )
  then
    alter publication supabase_realtime add table public.raid_strokes;
  end if;
end $$;
