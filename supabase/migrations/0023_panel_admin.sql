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
