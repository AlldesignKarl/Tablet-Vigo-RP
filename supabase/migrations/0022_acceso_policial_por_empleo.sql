-- =====================================================================
-- El acceso al canal de policía ya no se pide con un código de un solo
-- uso: se concede automáticamente en cuanto un admin le asigna a un
-- ciudadano uno de los empleos policiales (CNP, GC, altos mandos de
-- ambas, UIP, UPR), y se retira si luego se le cambia a otro empleo
-- (incluido desempleado). El sistema de código queda eliminado.
-- =====================================================================

create or replace function public.job_grants_police_access(p_job_code text)
returns boolean language sql immutable as $$
  select coalesce(
    p_job_code = any(array['cnp', 'jefe_cnp', 'gc', 'jefe_gc', 'geo', 'jefe_geo', 'uip', 'jefe_uip', 'upr', 'jefe_upr']),
    false
  );
$$;

-- No expuesta a clientes de forma independiente (no comprueba permisos
-- por sí misma): solo la deben llamar funciones security definer que ya
-- hayan verificado quién puede cambiar el empleo de un ciudadano
-- (admin_set_job, admin_panel_set_job).
create or replace function public.sync_police_access_for_job(p_profile_id uuid, p_job_code text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role;
begin
  select role into v_role from public.profiles where id = p_profile_id;

  if public.job_grants_police_access(p_job_code) then
    insert into public.police_users (profile_id, callsign, authorized)
      values (p_profile_id, 'Z-' || floor(random() * 90 + 10)::text, true)
      on conflict (profile_id) do update set authorized = true;
    if v_role = 'ciudadano' then
      update public.profiles set role = 'policia' where id = p_profile_id;
    end if;
  else
    update public.police_users set authorized = false where profile_id = p_profile_id;
    if v_role = 'policia' then
      update public.profiles set role = 'ciudadano' where id = p_profile_id;
    end if;
  end if;
end;
$$;

-- admin_set_job ahora también sincroniza el acceso policial según el
-- código del empleo que se le asigne al ciudadano.
create or replace function public.admin_set_job(p_profile_id uuid, p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_job_code text;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  update public.bank_accounts set job_id = p_job_id where profile_id = p_profile_id;
  if not found then
    raise exception 'Este ciudadano no tiene cuenta bancaria (no tiene DNI).';
  end if;

  select code into v_job_code from public.jobs where id = p_job_id;
  perform public.sync_police_access_for_job(p_profile_id, v_job_code);

  perform public.write_audit_log(auth.uid(), 'admin_cambio_empleo', p_profile_id::text, jsonb_build_object('job_id', p_job_id));
end;
$$;

-- El acceso por código de un solo uso queda eliminado: ya no hace falta
-- pedirlo ni verificarlo, así que se retiran las funciones y la tabla.
drop function if exists public.request_police_access_code();
drop function if exists public.redeem_police_access_code(text);
drop table if exists public.police_access_codes;
