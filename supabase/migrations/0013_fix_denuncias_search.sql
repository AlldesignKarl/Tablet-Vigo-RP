-- =====================================================================
-- Arreglo: la búsqueda de ciudadanos para poner una denuncia no
-- encontraba a nadie al escribir el nombre completo (nombre + apellidos)
-- =====================================================================
-- search_citizens_public() solo comparaba el texto buscado contra
-- first_name O last_name por separado, así que una búsqueda como
-- "Juan Pérez" nunca encajaba con first_name = 'Juan' ni con
-- last_name = 'Pérez' (la cadena completa no está contenida en ninguna
-- de las dos columnas). Ahora también compara contra el nombre completo
-- en ambos órdenes, y normaliza espacios repetidos en la búsqueda.

create or replace function public.search_citizens_public(p_query text, p_by text default 'nombre')
returns table (profile_id uuid, first_name text, last_name text, dni_number text, roblox_avatar_url text)
language plpgsql security definer set search_path = public as $$
declare
  v_query text := trim(regexp_replace(p_query, '\s+', ' ', 'g'));
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
      where d.profile_id <> auth.uid() and d.roblox_username ilike '%' || v_query || '%'
      limit 15;
  else
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid()
        and (
          d.first_name ilike '%' || v_query || '%'
          or d.last_name ilike '%' || v_query || '%'
          or (d.first_name || ' ' || d.last_name) ilike '%' || v_query || '%'
          or (d.last_name || ' ' || d.first_name) ilike '%' || v_query || '%'
        )
      limit 15;
  end if;
end;
$$;

-- El mismo problema existía en la búsqueda de policía (citizen_profile_view
-- filtrado por first_name/last_name por separado desde el backend), así
-- que añadimos una columna de nombre completo a la vista para que el
-- backend también pueda buscar por nombre y apellidos juntos.
-- Nota: "create or replace view" no permite insertar una columna nueva en
-- medio de la lista (solo añadir al final), así que full_name va al final
-- para no romper el "replace" sobre la vista ya desplegada en producción.
create or replace view public.citizen_profile_view as
select
  d.profile_id,
  d.id as dni_id,
  d.dni_number,
  d.first_name,
  d.last_name,
  d.birth_date,
  d.roblox_username,
  d.roblox_user_id,
  d.roblox_avatar_url,
  d.license_points,
  d.issued_at,
  ba.balance_cents,
  ba.next_salary_payment,
  ba.last_salary_payment,
  j.name as job_name,
  j.salary_cents,
  coalesce(fines_agg.total_count, 0) as fines_count,
  coalesce(fines_agg.pending_amount_cents, 0) as fines_pending_amount_cents,
  coalesce(arrests_agg.count, 0) as arrests_count,
  coalesce(vehicles_agg.count, 0) as vehicles_count,
  coalesce(confiscations_agg.count, 0) as confiscations_count,
  wp.id is not null as is_wanted,
  wp.reason as wanted_reason,
  wp.created_at as wanted_since,
  (d.first_name || ' ' || d.last_name) as full_name
from public.dnis d
left join public.bank_accounts ba on ba.profile_id = d.profile_id
left join public.jobs j on j.id = ba.job_id
left join lateral (
  select count(*) as total_count,
         sum(amount_cents) filter (where status = 'pendiente') as pending_amount_cents
  from public.fines where citizen_id = d.profile_id
) fines_agg on true
left join lateral (
  select count(*) as count from public.arrests where citizen_id = d.profile_id
) arrests_agg on true
left join lateral (
  select count(*) as count from public.vehicles where profile_id = d.profile_id
) vehicles_agg on true
left join lateral (
  select count(*) as count from public.confiscations where citizen_id = d.profile_id
) confiscations_agg on true
left join public.wanted_persons wp on wp.citizen_id = d.profile_id and wp.active = true;
