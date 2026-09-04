-- =====================================================================
-- 1) Todos los empleos "de emergencias" (Paramédico, Bombero y sus
--    jefaturas) dan acceso a la sección de policía, igual que CNP, GC,
--    GEO, UIP y UPR y sus altos mandos.
-- 2) Se retira el antiguo empleo genérico "Policía" (de antes de que
--    existieran los rangos reales CNP/GC/GEO/UIP/UPR): quien lo tuviera
--    pasa a Desempleado.
-- =====================================================================

create or replace function public.job_grants_police_access(p_job_code text)
returns boolean language sql immutable as $$
  select coalesce(
    p_job_code = any(array[
      'cnp', 'jefe_cnp', 'gc', 'jefe_gc', 'geo', 'jefe_geo', 'uip', 'jefe_uip', 'upr', 'jefe_upr',
      'paramedico', 'jefe_sanidad', 'bombero', 'jefe_bomberos'
    ]),
    false
  );
$$;

do $$
declare
  v_desempleado_id uuid;
  v_policia_id uuid;
begin
  select id into v_desempleado_id from public.jobs where code = 'desempleado';
  select id into v_policia_id from public.jobs where code = 'policia';

  if v_policia_id is not null then
    update public.bank_accounts set job_id = v_desempleado_id where job_id = v_policia_id;
    delete from public.jobs where id = v_policia_id;
  end if;
end $$;

-- Concede el acceso ya mismo a quien ya tenga uno de los empleos de
-- emergencias (para que un admin no tenga que reasignarles el empleo a
-- mano solo para que se aplique la regla nueva). A propósito solo
-- CONCEDE, nunca revoca: así no se toca a nadie a quien un admin le haya
-- dado acceso policial a mano desde /admin/policia sin pasar por un
-- empleo concreto.
do $$
declare
  r record;
begin
  for r in
    select b.profile_id
    from public.bank_accounts b
    join public.jobs j on j.id = b.job_id
    where public.job_grants_police_access(j.code)
  loop
    insert into public.police_users (profile_id, callsign, authorized)
      values (r.profile_id, 'Z-' || floor(random() * 90 + 10)::text, true)
      on conflict (profile_id) do update set authorized = true;
    update public.profiles set role = 'policia' where id = r.profile_id and role = 'ciudadano';
  end loop;
end $$;
