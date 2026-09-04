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
