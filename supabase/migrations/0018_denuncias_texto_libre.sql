-- =====================================================================
-- Denuncias: quitar la búsqueda de ciudadanos y pasar a texto libre
-- =====================================================================
-- La búsqueda daba problemas constantes (acentos, orden de nombre y
-- apellidos, gente que solo sabe la matrícula del coche pero no el
-- nombre del conductor...). Ahora el ciudadano simplemente escribe a
-- quién denuncia (nombre, o descripción del vehículo/matrícula si no
-- sabe el nombre) y el motivo, y la denuncia llega igualmente a la
-- policía para que investigue.

alter table public.complaints alter column accused_id drop not null;
alter table public.complaints add column if not exists accused_description text;

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
  c.resolved_by,
  c.accused_description
from public.complaints c
join public.dnis rd on rd.profile_id = c.reporter_id
left join public.dnis ad on ad.profile_id = c.accused_id;

drop function if exists public.file_complaint(uuid, text);

create or replace function public.file_complaint(p_accused_description text, p_reason text)
returns table (success boolean, message text, complaint_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_allowed boolean;
  v_id uuid;
  v_description text := trim(p_accused_description);
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (select 1 from public.dnis where profile_id = v_uid) then
    return query select false, 'Necesitas tener un DNI creado.', null::uuid;
    return;
  end if;

  if v_description = '' then
    return query select false, 'Indica a quién denuncias (nombre, vehículo, matrícula...).', null::uuid;
    return;
  end if;

  select public.check_rate_limit('file_complaint:' || v_uid::text, 5, 3600) into v_allowed;
  if not v_allowed then
    return query select false, 'Has puesto demasiadas denuncias. Espera un poco antes de poner otra.', null::uuid;
    return;
  end if;

  insert into public.complaints (reporter_id, accused_description, reason)
    values (v_uid, v_description, p_reason)
    returning id into v_id;

  perform public.write_audit_log(v_uid, 'denuncia_creada', v_id::text, jsonb_build_object('denunciado', v_description));
  return query select true, 'Denuncia registrada.', v_id;
end;
$$;
