-- =====================================================================
-- 1) Botón para borrar todas las llamadas/marcadores del mapa policial
--    de una vez.
-- =====================================================================

create or replace function public.police_clear_all_map_markers()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;
  delete from public.map_markers;
  perform public.write_audit_log(auth.uid(), 'mapa_borrar_todas_las_llamadas', null, '{}'::jsonb);
end;
$$;

-- =====================================================================
-- 2) Se regeneran los DNI de todos los ciudadanos ya registrados al
--    formato español real (8 dígitos + letra), para que todo el mundo
--    tenga uno igual de realista, no solo los nuevos a partir de ahora.
--    Cada llamada a generate_dni_number() usa la secuencia interna, así
--    que siguen siendo únicos.
-- =====================================================================

update public.dnis set dni_number = public.generate_dni_number();
