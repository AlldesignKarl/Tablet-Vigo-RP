-- =====================================================================
-- Arreglo: police_create_map_marker() solo devolvía el id, así que el
-- agente que creaba el marcador dependía por completo de Realtime para
-- verlo aparecer en su propio mapa. Si Realtime fallaba o tardaba (como
-- ya pasó con las luces de busca y captura), el marcador se guardaba en
-- la base de datos pero no se veía nada en pantalla. Ahora devuelve la
-- fila completa para que la tablet la pinte al instante sin depender
-- solo de Realtime.
-- =====================================================================

drop function if exists public.police_create_map_marker(text, real, real, text);

create or replace function public.police_create_map_marker(p_type text, p_x real, p_y real, p_note text default null)
returns setof public.map_markers
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_callsign text;
begin
  if not public.is_police_authorized(v_uid) then
    raise exception 'No autorizado';
  end if;

  if p_type not in ('posicion', 'panico', 'incidente', 'control') then
    raise exception 'Tipo de marcador inválido';
  end if;

  select callsign into v_callsign from public.police_users where profile_id = v_uid;

  return query
    insert into public.map_markers (created_by, callsign, type, x, y, note)
      values (v_uid, coalesce(v_callsign, 'DESCONOCIDO'), p_type, greatest(0, least(1, p_x)), greatest(0, least(1, p_y)), nullif(trim(coalesce(p_note, '')), ''))
      returning *;

  if p_type = 'panico' then
    perform public.write_audit_log(v_uid, 'mapa_boton_panico', null, jsonb_build_object('callsign', v_callsign));
  end if;
end;
$$;
