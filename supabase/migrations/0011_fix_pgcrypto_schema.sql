-- =====================================================================
-- Arregla "function gen_salt(unknown) does not exist" / "function crypt(...)
-- does not exist"
-- =====================================================================
-- En muchos proyectos de Supabase, pgcrypto se instala automáticamente en
-- el esquema "extensions" en vez de "public". Nuestras funciones
-- SECURITY DEFINER fijan `search_path = public` por seguridad, así que no
-- encuentran crypt()/gen_salt() si viven en otro esquema. La solución
-- correcta es mover pgcrypto a "public" (una única vez), en vez de tocar
-- el search_path de cada función.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pgcrypto') then
    if not exists (
      select 1
      from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace
      where e.extname = 'pgcrypto' and n.nspname = 'public'
    ) then
      alter extension pgcrypto set schema public;
    end if;
  else
    create extension pgcrypto with schema public;
  end if;
end $$;
