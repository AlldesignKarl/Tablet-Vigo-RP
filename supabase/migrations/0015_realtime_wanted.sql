-- Habilita Supabase Realtime para wanted_persons: así, en cuanto un
-- agente marca a alguien en busca y captura (o se la retira), el efecto
-- de luces azules en la tablet del ciudadano aparece/desaparece al
-- instante, sin tener que recargar la página.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wanted_persons'
     )
  then
    alter publication supabase_realtime add table public.wanted_persons;
  end if;
end $$;
