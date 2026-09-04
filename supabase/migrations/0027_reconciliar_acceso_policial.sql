-- =====================================================================
-- Reconciliación completa del acceso policial: el acceso a
-- /tablet/policia debe depender ÚNICAMENTE del empleo actual de cada
-- ciudadano (CNP, GC, GEO, UIP, UPR, Paramédico, Bombero o sus altos
-- mandos), sin excepciones. Antes solo se CONCEDÍA acceso de forma
-- retroactiva (0026), nunca se RETIRABA: cualquier autorización antigua
-- (de cuando el acceso era por código, o dada a mano desde
-- /admin/policia) seguía activa aunque el ciudadano no tuviera ya un
-- empleo que la justificase. Esta migración sí revoca: recorre a todo
-- el mundo y aplica la regla de empleo tal cual está hoy.
-- =====================================================================

do $$
declare
  r record;
begin
  for r in
    select b.profile_id, j.code as job_code
    from public.bank_accounts b
    left join public.jobs j on j.id = b.job_id
  loop
    perform public.sync_police_access_for_job(r.profile_id, r.job_code);
  end loop;
end $$;
