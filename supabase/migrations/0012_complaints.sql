-- =====================================================================
-- Denuncias entre ciudadanos + gestión policial
-- =====================================================================
-- Cualquier ciudadano con DNI puede denunciar a otro ciudadano indicando
-- un motivo. La policía ve todas las denuncias y puede marcarlas como
-- pendiente, en inspección o cerrada.

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  accused_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'en_inspeccion', 'cerrada')),
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at_complaints on public.complaints;
create trigger set_updated_at_complaints before update on public.complaints for each row execute procedure public.set_updated_at();

alter table public.complaints enable row level security;

drop policy if exists complaints_select on public.complaints;
create policy complaints_select on public.complaints for select
  using (reporter_id = auth.uid() or public.is_police_authorized() or public.is_admin());
-- Sin policies de insert/update para clientes: solo las funciones de abajo
-- (security definer) pueden crear o cambiar el estado de una denuncia.

create or replace view public.complaints_view as
select
  c.id,
  c.reason,
  c.status,
  c.created_at,
  c.updated_at,
  c.reporter_id,
  rd.first_name as reporter_first_name,
  rd.last_name as reporter_last_name,
  rd.dni_number as reporter_dni_number,
  c.accused_id,
  ad.first_name as accused_first_name,
  ad.last_name as accused_last_name,
  ad.dni_number as accused_dni_number,
  c.resolved_by
from public.complaints c
join public.dnis rd on rd.profile_id = c.reporter_id
join public.dnis ad on ad.profile_id = c.accused_id;

-- Búsqueda de ciudadanos para elegir a quién denunciar. RLS en "dnis" solo
-- deja leer tu propia fila (o a policía/admin), así que un ciudadano normal
-- no puede buscar a otro directamente: esta función, limitada a columnas
-- no sensibles (nunca saldo, puntos ni busca y captura), se lo permite.
create or replace function public.search_citizens_public(p_query text, p_by text default 'nombre')
returns table (profile_id uuid, first_name text, last_name text, dni_number text, roblox_avatar_url text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_by = 'dni' then
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid() and d.dni_number ilike '%' || p_query || '%'
      limit 15;
  elsif p_by = 'roblox' then
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid() and d.roblox_username ilike '%' || p_query || '%'
      limit 15;
  else
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid()
        and (d.first_name ilike '%' || p_query || '%' or d.last_name ilike '%' || p_query || '%')
      limit 15;
  end if;
end;
$$;

create or replace function public.file_complaint(p_accused_id uuid, p_reason text)
returns table (success boolean, message text, complaint_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_allowed boolean;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (select 1 from public.dnis where profile_id = v_uid) then
    return query select false, 'Necesitas tener un DNI creado.', null::uuid;
    return;
  end if;

  if p_accused_id = v_uid then
    return query select false, 'No puedes denunciarte a ti mismo.', null::uuid;
    return;
  end if;

  if not exists (select 1 from public.dnis where profile_id = p_accused_id) then
    return query select false, 'La persona denunciada no existe.', null::uuid;
    return;
  end if;

  select public.check_rate_limit('file_complaint:' || v_uid::text, 5, 3600) into v_allowed;
  if not v_allowed then
    return query select false, 'Has puesto demasiadas denuncias. Espera un poco antes de poner otra.', null::uuid;
    return;
  end if;

  insert into public.complaints (reporter_id, accused_id, reason)
    values (v_uid, p_accused_id, p_reason)
    returning id into v_id;

  perform public.write_audit_log(v_uid, 'denuncia_creada', v_id::text, jsonb_build_object('accused_id', p_accused_id));
  return query select true, 'Denuncia registrada.', v_id;
end;
$$;

create or replace function public.police_update_complaint_status(p_complaint_id uuid, p_status text)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not public.is_police_authorized(v_uid) then
    return query select false, 'No autorizado.';
    return;
  end if;

  if p_status not in ('pendiente', 'en_inspeccion', 'cerrada') then
    return query select false, 'Estado inválido.';
    return;
  end if;

  update public.complaints set status = p_status, resolved_by = v_uid where id = p_complaint_id;
  if not found then
    return query select false, 'Denuncia no encontrada.';
    return;
  end if;

  perform public.write_audit_log(v_uid, 'denuncia_actualizada', p_complaint_id::text, jsonb_build_object('status', p_status));
  return query select true, 'Denuncia actualizada.';
end;
$$;

-- Arreglo de police_stats_view: al sustituir la licencia genérica "armas"
-- por licencias específicas por modelo (arma_beretta, arma_ak47, etc. en
-- la migración 0008), este contador se quedó buscando solo el código
-- "armas" exacto y siempre daría 0 para licencias nuevas.
create or replace view public.police_stats_view as
select
  (select count(*) from public.dnis) as total_citizens,
  (select count(*) from public.vehicles) as total_vehicles,
  (select count(distinct l.profile_id) from public.licenses l
     join public.license_types lt on lt.id = l.license_type_id
     where (lt.code = 'armas' or lt.code like 'arma_%') and l.active) as total_weapon_licenses,
  (select count(*) from public.wanted_persons where active) as total_wanted;
