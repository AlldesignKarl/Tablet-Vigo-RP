-- Habilita Supabase Realtime (Postgres Changes) para la radio policial.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.radio_messages;
  end if;
end $$;
