-- Habilita Supabase Realtime (Postgres Changes) para la radio policial.
-- Comprueba primero si la tabla ya es miembro de la publicación para que
-- este archivo se pueda volver a ejecutar sin errores.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'radio_messages'
     )
  then
    alter publication supabase_realtime add table public.radio_messages;
  end if;
end $$;
