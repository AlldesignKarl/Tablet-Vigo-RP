-- =====================================================================
-- Funciones de permisos y operaciones atómicas (SECURITY DEFINER)
-- =====================================================================
-- Todas las funciones que tocan dinero o acciones policiales verifican
-- auth.uid() internamente. El frontend NUNCA puede saltarse estas
-- comprobaciones porque las tablas base están protegidas por RLS y las
-- escrituras sensibles solo pueden hacerse a través de estas funciones.
-- =====================================================================

create or replace function public.current_role()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_police_authorized(p_uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles p
    join public.police_users pu on pu.profile_id = p.id
    where p.id = p_uid
      and pu.authorized = true
      and p.role in ('policia', 'admin', 'fundador')
  );
$$;

create or replace function public.is_admin(p_uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = p_uid and role in ('admin', 'fundador')
  );
$$;

-- ---------------------------------------------------------------------
-- Rate limiting simple basado en DB (ventana fija)
-- ---------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_max_count integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_row public.rate_limits%rowtype;
begin
  select * into v_row from public.rate_limits where key = p_key for update;

  if not found then
    insert into public.rate_limits (key, count, window_start) values (p_key, 1, now());
    return true;
  end if;

  if now() - v_row.window_start > (p_window_seconds || ' seconds')::interval then
    update public.rate_limits set count = 1, window_start = now() where key = p_key;
    return true;
  end if;

  if v_row.count >= p_max_count then
    return false;
  end if;

  update public.rate_limits set count = count + 1 where key = p_key;
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Registro de auditoría (interno, usado por otras funciones)
-- ---------------------------------------------------------------------
create or replace function public.write_audit_log(p_actor uuid, p_action text, p_target text, p_metadata jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, actor_label, action, target, metadata)
  values (
    p_actor,
    (select coalesce(pu.callsign, pr.display_name, pr.id::text) from public.profiles pr
       left join public.police_users pu on pu.profile_id = pr.id where pr.id = p_actor),
    p_action, p_target, coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Cobro de sueldo: atómico, no explotable recargando o llamando 2 veces
-- ---------------------------------------------------------------------
create or replace function public.claim_salary()
returns table (paid boolean, new_balance_cents bigint, next_salary_payment timestamptz, amount_cents bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_account public.bank_accounts%rowtype;
  v_salary bigint;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select * into v_account from public.bank_accounts where profile_id = v_uid for update;
  if not found then
    raise exception 'Cuenta bancaria no encontrada. Crea tu DNI primero.';
  end if;

  if v_account.next_salary_payment > now() then
    return query select false, v_account.balance_cents, v_account.next_salary_payment, 0::bigint;
    return;
  end if;

  select coalesce(j.salary_cents, 0) into v_salary from public.jobs j where j.id = v_account.job_id;
  v_salary := coalesce(v_salary, 0);

  update public.bank_accounts
    set balance_cents = balance_cents + v_salary,
        last_salary_payment = now(),
        next_salary_payment = now() + interval '2 days'
    where profile_id = v_uid
    returning * into v_account;

  insert into public.bank_transactions (profile_id, type, amount_cents, description)
    values (v_uid, 'salario', v_salary, 'Pago de sueldo');

  return query select true, v_account.balance_cents, v_account.next_salary_payment, v_salary;
end;
$$;

-- Variante para cron: paga a TODOS los que tengan el sueldo vencido.
-- Solo debe invocarse con la service role key (backend/cron), nunca desde el cliente.
create or replace function public.pay_all_due_salaries()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select ba.profile_id, coalesce(j.salary_cents, 0) as salary_cents
    from public.bank_accounts ba
    left join public.jobs j on j.id = ba.job_id
    where ba.next_salary_payment <= now()
    for update of ba skip locked
  loop
    update public.bank_accounts
      set balance_cents = balance_cents + r.salary_cents,
          last_salary_payment = now(),
          next_salary_payment = now() + interval '2 days'
      where profile_id = r.profile_id;

    insert into public.bank_transactions (profile_id, type, amount_cents, description)
      values (r.profile_id, 'salario', r.salary_cents, 'Pago de sueldo (automático)');

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Compra de licencia: atómica, verifica saldo real en servidor
-- ---------------------------------------------------------------------
create or replace function public.purchase_license(p_license_type_id uuid)
returns table (success boolean, message text, new_balance_cents bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_license public.license_types%rowtype;
  v_account public.bank_accounts%rowtype;
  v_existing public.licenses%rowtype;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select * into v_license from public.license_types where id = p_license_type_id;
  if not found or v_license.active = false then
    return query select false, 'Esta licencia no está disponible.', 0::bigint;
    return;
  end if;

  select * into v_existing from public.licenses where profile_id = v_uid and license_type_id = p_license_type_id;
  if found and not v_license.renewable then
    return query select false, 'Ya posees esta licencia.', 0::bigint;
    return;
  end if;

  select * into v_account from public.bank_accounts where profile_id = v_uid for update;
  if not found then
    return query select false, 'Cuenta bancaria no encontrada.', 0::bigint;
    return;
  end if;

  if v_account.balance_cents < v_license.price_cents then
    return query select false, 'Fondos insuficientes.', v_account.balance_cents;
    return;
  end if;

  update public.bank_accounts set balance_cents = balance_cents - v_license.price_cents
    where profile_id = v_uid returning * into v_account;

  if found and v_existing.id is not null then
    update public.licenses set acquired_at = now(), active = true where id = v_existing.id;
  else
    insert into public.licenses (profile_id, license_type_id) values (v_uid, p_license_type_id);
  end if;

  insert into public.bank_transactions (profile_id, type, amount_cents, description, reference_id)
    values (v_uid, 'compra_licencia', -v_license.price_cents, 'Compra de licencia: ' || v_license.name, v_license.id);

  perform public.write_audit_log(v_uid, 'compra_licencia', v_license.code, jsonb_build_object('precio_cents', v_license.price_cents));

  return query select true, 'Licencia adquirida.', v_account.balance_cents;
end;
$$;

-- ---------------------------------------------------------------------
-- Pago de una multa pendiente por parte del propio ciudadano
-- ---------------------------------------------------------------------
create or replace function public.pay_fine(p_fine_id uuid)
returns table (success boolean, message text, new_balance_cents bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_fine public.fines%rowtype;
  v_account public.bank_accounts%rowtype;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select * into v_fine from public.fines where id = p_fine_id and citizen_id = v_uid for update;
  if not found then
    return query select false, 'Multa no encontrada.', 0::bigint;
    return;
  end if;

  if v_fine.status = 'pagada' then
    return query select false, 'Esta multa ya está pagada.', 0::bigint;
    return;
  end if;

  select * into v_account from public.bank_accounts where profile_id = v_uid for update;
  if not found or v_account.balance_cents < v_fine.amount_cents then
    return query select false, 'Fondos insuficientes.', coalesce(v_account.balance_cents, 0);
    return;
  end if;

  update public.bank_accounts set balance_cents = balance_cents - v_fine.amount_cents
    where profile_id = v_uid returning * into v_account;

  update public.fines set status = 'pagada', paid_at = now() where id = p_fine_id;

  insert into public.bank_transactions (profile_id, type, amount_cents, description, reference_id)
    values (v_uid, 'pago_multa', -v_fine.amount_cents, 'Pago de multa: ' || v_fine.reason, v_fine.id);

  return query select true, 'Multa pagada.', v_account.balance_cents;
end;
$$;

-- ---------------------------------------------------------------------
-- Compra genérica en la tienda (productos no-licencia, p.ej. objetos)
-- ---------------------------------------------------------------------
create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  icon text not null default '🛒',
  price_cents bigint not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_shop_products before update on public.shop_products for each row execute procedure public.set_updated_at();

create table if not exists public.shop_purchases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.shop_products(id) on delete restrict,
  price_cents bigint not null,
  created_at timestamptz not null default now()
);

create or replace function public.purchase_product(p_product_id uuid)
returns table (success boolean, message text, new_balance_cents bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_product public.shop_products%rowtype;
  v_account public.bank_accounts%rowtype;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select * into v_product from public.shop_products where id = p_product_id;
  if not found or v_product.active = false then
    return query select false, 'Producto no disponible.', 0::bigint;
    return;
  end if;

  select * into v_account from public.bank_accounts where profile_id = v_uid for update;
  if not found or v_account.balance_cents < v_product.price_cents then
    return query select false, 'Fondos insuficientes.', coalesce(v_account.balance_cents, 0);
    return;
  end if;

  update public.bank_accounts set balance_cents = balance_cents - v_product.price_cents
    where profile_id = v_uid returning * into v_account;

  insert into public.shop_purchases (profile_id, product_id, price_cents) values (v_uid, p_product_id, v_product.price_cents);

  insert into public.bank_transactions (profile_id, type, amount_cents, description, reference_id)
    values (v_uid, 'compra_tienda', -v_product.price_cents, 'Compra: ' || v_product.name, v_product.id);

  return query select true, 'Compra realizada.', v_account.balance_cents;
end;
$$;

-- ---------------------------------------------------------------------
-- Registro de vehículo (comprobación de matrícula en servidor)
-- ---------------------------------------------------------------------
create or replace function public.register_vehicle(p_plate text, p_brand text, p_model text, p_color text)
returns table (success boolean, message text, vehicle_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_plate text := upper(trim(p_plate));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (select 1 from public.dnis where profile_id = v_uid) then
    return query select false, 'Debes tener un DNI creado.', null::uuid;
    return;
  end if;

  if length(v_plate) < 4 then
    return query select false, 'Matrícula inválida.', null::uuid;
    return;
  end if;

  if exists (select 1 from public.vehicles where upper(plate) = v_plate) then
    return query select false, 'Esa matrícula ya está registrada.', null::uuid;
    return;
  end if;

  insert into public.vehicles (profile_id, plate, brand, model, color)
    values (v_uid, v_plate, p_brand, p_model, p_color)
    returning id into v_id;

  return query select true, 'Vehículo registrado.', v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Acciones policiales (todas verifican is_police_authorized internamente)
-- ---------------------------------------------------------------------
create or replace function public.police_arrest(p_citizen_id uuid, p_reason text, p_duration_minutes integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if not public.is_police_authorized(v_uid) then
    raise exception 'No autorizado';
  end if;
  if p_duration_minutes <= 0 then
    raise exception 'Duración inválida';
  end if;

  insert into public.arrests (citizen_id, officer_id, reason, duration_minutes)
    values (p_citizen_id, v_uid, p_reason, p_duration_minutes) returning id into v_id;

  perform public.write_audit_log(v_uid, 'arresto', p_citizen_id::text, jsonb_build_object('motivo', p_reason, 'duracion', p_duration_minutes));
  return v_id;
end;
$$;

create or replace function public.police_fine(p_citizen_id uuid, p_reason text, p_amount_cents bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if not public.is_police_authorized(v_uid) then
    raise exception 'No autorizado';
  end if;
  if p_amount_cents <= 0 then
    raise exception 'Importe inválido';
  end if;

  insert into public.fines (citizen_id, officer_id, reason, amount_cents)
    values (p_citizen_id, v_uid, p_reason, p_amount_cents) returning id into v_id;

  perform public.write_audit_log(v_uid, 'multa', p_citizen_id::text, jsonb_build_object('motivo', p_reason, 'importe_cents', p_amount_cents));
  return v_id;
end;
$$;

create or replace function public.police_confiscate(p_citizen_id uuid, p_material text, p_quantity text, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if not public.is_police_authorized(v_uid) then
    raise exception 'No autorizado';
  end if;

  insert into public.confiscations (citizen_id, officer_id, material, quantity, reason)
    values (p_citizen_id, v_uid, p_material, p_quantity, p_reason) returning id into v_id;

  perform public.write_audit_log(v_uid, 'incautacion_material', p_citizen_id::text, jsonb_build_object('material', p_material, 'cantidad', p_quantity, 'motivo', p_reason));
  return v_id;
end;
$$;

create or replace function public.police_impound_vehicle(p_vehicle_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_plate text;
begin
  if not public.is_police_authorized(v_uid) then
    raise exception 'No autorizado';
  end if;

  update public.vehicles set impounded = true where id = p_vehicle_id returning plate into v_plate;
  if not found then
    raise exception 'Vehículo no encontrado';
  end if;

  insert into public.vehicle_impounds (vehicle_id, officer_id, reason)
    values (p_vehicle_id, v_uid, p_reason) returning id into v_id;

  perform public.write_audit_log(v_uid, 'incautacion_vehiculo', v_plate, jsonb_build_object('motivo', p_reason));
  return v_id;
end;
$$;

create or replace function public.police_release_vehicle(p_vehicle_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.is_police_authorized(v_uid) then
    raise exception 'No autorizado';
  end if;

  update public.vehicles set impounded = false where id = p_vehicle_id;
  update public.vehicle_impounds set released_at = now(), released_by = v_uid
    where vehicle_id = p_vehicle_id and released_at is null;

  perform public.write_audit_log(v_uid, 'liberar_vehiculo', p_vehicle_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.police_remove_points(p_citizen_id uuid, p_points integer, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_before integer;
  v_after integer;
begin
  if not public.is_police_authorized(v_uid) then
    raise exception 'No autorizado';
  end if;
  if p_points <= 0 then
    raise exception 'Puntos inválidos';
  end if;

  select license_points into v_before from public.dnis where profile_id = p_citizen_id for update;
  if not found then
    raise exception 'DNI no encontrado';
  end if;

  v_after := greatest(0, v_before - p_points);
  update public.dnis set license_points = v_after where profile_id = p_citizen_id;

  insert into public.license_points_history (citizen_id, officer_id, points_removed, points_before, points_after, reason)
    values (p_citizen_id, v_uid, p_points, v_before, v_after, p_reason);

  perform public.write_audit_log(v_uid, 'quitar_puntos', p_citizen_id::text, jsonb_build_object('puntos', p_points, 'restantes', v_after));
  return v_after;
end;
$$;

create or replace function public.police_set_wanted(p_citizen_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if not public.is_police_authorized(v_uid) then
    raise exception 'No autorizado';
  end if;

  update public.wanted_persons set active = false, resolved_at = now(), resolved_by = v_uid
    where citizen_id = p_citizen_id and active = true;

  insert into public.wanted_persons (citizen_id, officer_id, reason)
    values (p_citizen_id, v_uid, p_reason) returning id into v_id;

  perform public.write_audit_log(v_uid, 'busca_y_captura_activar', p_citizen_id::text, jsonb_build_object('motivo', p_reason));
  return v_id;
end;
$$;

create or replace function public.police_clear_wanted(p_citizen_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.is_police_authorized(v_uid) then
    raise exception 'No autorizado';
  end if;

  update public.wanted_persons set active = false, resolved_at = now(), resolved_by = v_uid
    where citizen_id = p_citizen_id and active = true;

  perform public.write_audit_log(v_uid, 'busca_y_captura_retirar', p_citizen_id::text, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- Desbloqueo de cuenta policial mediante código
-- ---------------------------------------------------------------------
create or replace function public.redeem_police_code(p_code text, p_callsign text)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_allowed boolean;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (select 1 from public.dnis where profile_id = v_uid) then
    return query select false, 'Necesitas tener un DNI creado.';
    return;
  end if;

  select public.check_rate_limit('police_code:' || v_uid::text, 5, 300) into v_allowed;
  if not v_allowed then
    return query select false, 'Demasiados intentos. Espera unos minutos.';
    return;
  end if;

  select value->>'police_code_hash' into v_hash from public.app_config where key = 'security';

  if v_hash is null or crypt(p_code, v_hash) <> v_hash then
    perform public.write_audit_log(v_uid, 'intento_codigo_policial_fallido', v_uid::text, '{}'::jsonb);
    return query select false, 'Código incorrecto.';
    return;
  end if;

  insert into public.police_users (profile_id, callsign, authorized)
    values (v_uid, coalesce(nullif(trim(p_callsign), ''), 'Z-' || floor(random() * 90 + 10)::text), true)
    on conflict (profile_id) do update set authorized = true;

  update public.profiles set role = 'policia' where id = v_uid and role = 'ciudadano';

  perform public.write_audit_log(v_uid, 'acceso_policial_concedido', v_uid::text, '{}'::jsonb);
  return query select true, 'Acceso policial concedido.';
end;
$$;

create extension if not exists pgcrypto;
