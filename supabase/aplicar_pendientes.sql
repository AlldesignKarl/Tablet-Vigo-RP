-- =====================================================================
-- Aplica en tu base de datos ya existente lo último añadido:
--  1) Búsqueda de ciudadanos (denuncias y policía) de verdad robusta:
--     por palabras sueltas y sin distinguir acentos, así que "Juan
--     Perez" encuentra a "Juan Pérez" y da igual el orden nombre/
--     apellidos.
--  2) Busca y captura: matrícula opcional del vehículo al marcar a
--     alguien, y una vista para listarlos todos con foto, nombre y
--     matrícula.
--  3) Un ciudadano puede eliminar su propio vehículo (si ya no está
--     incautado).
-- Es idempotente: se puede ejecutar varias veces sin problema.
-- =====================================================================

do $$
begin
  if exists (select 1 from pg_extension where extname = 'unaccent') then
    if not exists (
      select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
      where e.extname = 'unaccent' and n.nspname = 'public'
    ) then
      alter extension unaccent set schema public;
    end if;
  else
    create extension unaccent with schema public;
  end if;
end $$;

create or replace function public.search_citizens_public(p_query text, p_by text default 'nombre')
returns table (profile_id uuid, first_name text, last_name text, dni_number text, roblox_avatar_url text)
language plpgsql security definer set search_path = public as $$
declare
  v_query text := trim(regexp_replace(p_query, '\s+', ' ', 'g'));
  v_tokens text[];
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_by = 'dni' then
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid() and d.dni_number ilike '%' || v_query || '%'
      limit 15;
  elsif p_by = 'roblox' then
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid()
        and unaccent(lower(d.roblox_username)) ilike unaccent(lower('%' || v_query || '%'))
      limit 15;
  else
    v_tokens := string_to_array(v_query, ' ');
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid()
        and not exists (
          select 1 from unnest(v_tokens) as tok
          where tok <> ''
            and unaccent(lower(d.first_name || ' ' || d.last_name)) not ilike '%' || unaccent(lower(tok)) || '%'
        )
      limit 15;
  end if;
end;
$$;

create or replace function public.search_citizens_police(p_query text, p_by text default 'nombre')
returns setof public.citizen_profile_view
language plpgsql security definer set search_path = public as $$
declare
  v_query text := trim(regexp_replace(p_query, '\s+', ' ', 'g'));
  v_tokens text[];
begin
  if not public.is_police_authorized(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  if p_by = 'dni' then
    return query select * from public.citizen_profile_view where dni_number ilike '%' || v_query || '%' limit 25;
  elsif p_by = 'roblox' then
    return query
      select * from public.citizen_profile_view
      where unaccent(lower(roblox_username)) ilike unaccent(lower('%' || v_query || '%'))
      limit 25;
  else
    v_tokens := string_to_array(v_query, ' ');
    return query
      select v.* from public.citizen_profile_view v
      where not exists (
        select 1 from unnest(v_tokens) as tok
        where tok <> ''
          and unaccent(lower(v.first_name || ' ' || v.last_name)) not ilike '%' || unaccent(lower(tok)) || '%'
      )
      limit 25;
  end if;
end;
$$;

alter table public.wanted_persons add column if not exists vehicle_plate text;

drop function if exists public.police_set_wanted(uuid, text);

create or replace function public.police_set_wanted(p_citizen_id uuid, p_reason text, p_vehicle_plate text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_plate text := nullif(trim(upper(coalesce(p_vehicle_plate, ''))), '');
begin
  if not public.is_police_authorized(v_uid) then
    raise exception 'No autorizado';
  end if;

  update public.wanted_persons set active = false, resolved_at = now(), resolved_by = v_uid
    where citizen_id = p_citizen_id and active = true;

  insert into public.wanted_persons (citizen_id, officer_id, reason, vehicle_plate)
    values (p_citizen_id, v_uid, p_reason, v_plate) returning id into v_id;

  perform public.write_audit_log(v_uid, 'busca_y_captura_activar', p_citizen_id::text, jsonb_build_object('motivo', p_reason, 'matricula', v_plate));
  return v_id;
end;
$$;

create or replace view public.wanted_active_view as
select
  wp.id,
  wp.citizen_id,
  wp.reason,
  wp.vehicle_plate,
  wp.created_at,
  d.first_name,
  d.last_name,
  d.dni_number,
  d.roblox_avatar_url
from public.wanted_persons wp
join public.dnis d on d.profile_id = wp.citizen_id
where wp.active = true
order by wp.created_at desc;

create or replace function public.delete_vehicle(p_vehicle_id uuid)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_impounded boolean;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select profile_id, impounded into v_owner, v_impounded from public.vehicles where id = p_vehicle_id;

  if v_owner is null then
    return query select false, 'Vehículo no encontrado.';
    return;
  end if;

  if v_owner <> v_uid then
    return query select false, 'No autorizado.';
    return;
  end if;

  if v_impounded then
    return query select false, 'No puedes eliminar un vehículo incautado. Pide a un agente que lo libere primero.';
    return;
  end if;

  delete from public.vehicles where id = p_vehicle_id;
  perform public.write_audit_log(v_uid, 'vehiculo_eliminado', p_vehicle_id::text, '{}'::jsonb);
  return query select true, 'Vehículo eliminado.';
end;
$$;
