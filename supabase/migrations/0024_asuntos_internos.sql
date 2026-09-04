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
