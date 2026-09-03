-- =====================================================================
-- Catálogo de empleos/rangos por sección + asignación manual desde admin
-- =====================================================================
-- Sueldos cada 48h. "on conflict ... do update" para que sea seguro
-- volver a ejecutar esta migración y corrija el sueldo si ya existía.

insert into public.jobs (code, name, salary_cents) values
  ('cnp', 'CNP - Agente', 250000),
  ('jefe_cnp', 'CNP - Jefatura', 500000),
  ('gc', 'Guardia Civil - Agente', 250000),
  ('jefe_gc', 'Guardia Civil - Jefatura', 500000),
  ('geo', 'GEO - Agente', 300000),
  ('jefe_geo', 'GEO - Jefatura', 500000),
  ('uip', 'UIP - Agente', 300000),
  ('jefe_uip', 'UIP - Jefatura', 500000),
  ('upr', 'UPR - Agente', 300000),
  ('jefe_upr', 'UPR - Jefatura', 500000),
  ('paramedico', 'Paramédico', 245000),
  ('jefe_sanidad', 'Sanidad - Jefatura', 500000),
  ('bombero', 'Bombero', 245000),
  ('jefe_bomberos', 'Bomberos - Jefatura', 500000)
on conflict (code) do update set name = excluded.name, salary_cents = excluded.salary_cents;

-- Permite a un admin asignar el empleo/rango de un ciudadano (determina
-- su sueldo cada 48h). bank_accounts se crea automáticamente al hacerse
-- el DNI, así que aquí solo actualizamos su job_id.
create or replace function public.admin_set_job(p_profile_id uuid, p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  update public.bank_accounts set job_id = p_job_id where profile_id = p_profile_id;
  if not found then
    raise exception 'Este ciudadano no tiene cuenta bancaria (no tiene DNI).';
  end if;

  perform public.write_audit_log(auth.uid(), 'admin_cambio_empleo', p_profile_id::text, jsonb_build_object('job_id', p_job_id));
end;
$$;
