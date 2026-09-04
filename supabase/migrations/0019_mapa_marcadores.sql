-- =====================================================================
-- Marcadores en el mapa de policía (posición propia, botón de pánico,
-- incidente, control) en tiempo real para todos los agentes.
-- =====================================================================
-- ERLC no da la ubicación real de los jugadores a herramientas externas,
-- así que esto NO es rastreo automático: es un agente marcando a mano
-- dónde está (o un aviso) sobre el mapa, y todos los demás agentes lo ven
-- al instante. x/y son proporciones (0-1) sobre la imagen del mapa, no
-- coordenadas del juego.

create table if not exists public.map_markers (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  callsign text not null,
  type text not null check (type in ('posicion', 'panico', 'incidente', 'control')),
  x real not null check (x >= 0 and x <= 1),
  y real not null check (y >= 0 and y <= 1),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists map_markers_created_at_idx on public.map_markers (created_at desc);

alter table public.map_markers enable row level security;

drop policy if exists map_markers_select on public.map_markers;
create policy map_markers_select on public.map_markers for select
  using (public.is_police_authorized() or public.is_admin());
-- Sin policies de insert/update/delete para clientes: solo las funciones
-- de abajo (security definer) pueden crear o borrar un marcador.

create or replace function public.police_create_map_marker(p_type text, p_x real, p_y real, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_callsign text;
  v_id uuid;
begin
  if not public.is_police_authorized(v_uid) then
    raise exception 'No autorizado';
  end if;

  if p_type not in ('posicion', 'panico', 'incidente', 'control') then
    raise exception 'Tipo de marcador inválido';
  end if;

  select callsign into v_callsign from public.police_users where profile_id = v_uid;

  insert into public.map_markers (created_by, callsign, type, x, y, note)
    values (v_uid, coalesce(v_callsign, 'DESCONOCIDO'), p_type, greatest(0, least(1, p_x)), greatest(0, least(1, p_y)), nullif(trim(coalesce(p_note, '')), ''))
    returning id into v_id;

  if p_type = 'panico' then
    perform public.write_audit_log(v_uid, 'mapa_boton_panico', v_id::text, jsonb_build_object('callsign', v_callsign));
  end if;

  return v_id;
end;
$$;

create or replace function public.police_delete_map_marker(p_marker_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  delete from public.map_markers where id = p_marker_id;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'map_markers'
     )
  then
    alter publication supabase_realtime add table public.map_markers;
  end if;
end $$;
