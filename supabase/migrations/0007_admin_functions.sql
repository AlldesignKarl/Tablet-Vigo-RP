-- =====================================================================
-- Funciones y políticas adicionales para el panel de administración
-- =====================================================================

-- Permite a un admin cambiar el rol de un perfil (p.ej. revocar acceso
-- policial o nombrar a otro admin). No se expone ninguna otra columna
-- de "profiles" a escritura por RLS.
create policy profiles_admin_write on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.admin_set_police_code(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  if length(p_code) < 4 then
    raise exception 'El código debe tener al menos 4 caracteres';
  end if;

  insert into public.app_config (key, value, updated_by)
    values ('security', jsonb_build_object('police_code_hash', crypt(p_code, gen_salt('bf'))), auth.uid())
  on conflict (key) do update
    set value = jsonb_build_object('police_code_hash', crypt(p_code, gen_salt('bf'))),
        updated_at = now(),
        updated_by = auth.uid();

  perform public.write_audit_log(auth.uid(), 'admin_cambio_codigo_policial', null, '{}'::jsonb);
end;
$$;

create or replace function public.admin_set_role(p_profile_id uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  update public.profiles set role = p_role where id = p_profile_id;

  perform public.write_audit_log(auth.uid(), 'admin_cambio_rol', p_profile_id::text, jsonb_build_object('nuevo_rol', p_role));
end;
$$;

create or replace function public.admin_adjust_balance(p_profile_id uuid, p_amount_cents bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  update public.bank_accounts set balance_cents = greatest(0, balance_cents + p_amount_cents)
    where profile_id = p_profile_id;
  if not found then
    raise exception 'Cuenta bancaria no encontrada';
  end if;

  insert into public.bank_transactions (profile_id, type, amount_cents, description)
    values (p_profile_id, 'ajuste_admin', p_amount_cents, coalesce(nullif(p_reason, ''), 'Ajuste administrativo'));

  perform public.write_audit_log(auth.uid(), 'admin_ajuste_saldo', p_profile_id::text, jsonb_build_object('importe_cents', p_amount_cents, 'motivo', p_reason));
end;
$$;

create or replace function public.admin_set_config(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  if p_key = 'security' then
    raise exception 'Usa admin_set_police_code() para cambiar la seguridad.';
  end if;

  insert into public.app_config (key, value, updated_by) values (p_key, p_value, auth.uid())
  on conflict (key) do update set value = p_value, updated_at = now(), updated_by = auth.uid();

  perform public.write_audit_log(auth.uid(), 'admin_actualiza_config', p_key, p_value);
end;
$$;
