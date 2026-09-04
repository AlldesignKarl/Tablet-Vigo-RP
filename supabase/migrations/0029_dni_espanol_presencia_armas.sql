-- =====================================================================
-- 1) DNI con formato español real: 8 dígitos + letra de control, en vez
--    del "V-100001" de antes. Solo afecta a los DNI que se creen a
--    partir de ahora (los ya existentes no se tocan, para no invalidar
--    números que la gente ya usa en el rol).
-- =====================================================================

create or replace function public.generate_dni_number()
returns text language plpgsql as $$
declare
  v_num bigint := nextval('public.dni_number_seq');
  v_letter char(1);
begin
  v_letter := substr('TRWAGMYFPDXBNJZSQVHLCKE', ((v_num % 23) + 1)::int, 1);
  return lpad(v_num::text, 8, '0') || v_letter;
end;
$$;

alter table public.dnis alter column dni_number set default public.generate_dni_number();

-- =====================================================================
-- 2) Presencia: cada ciudadano "avisa" cada pocos segundos mientras
--    tiene la tablet abierta, para que la policía pueda ver quién está
--    conectado ahora mismo y, en el expediente de una persona en
--    concreto, si esa persona está en línea o no.
-- =====================================================================

alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.touch_presence()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.profiles set last_seen_at = now() where id = auth.uid();
end;
$$;

-- Se considera "en línea" haber avisado en los últimos 90 segundos
-- (el aviso se manda cada 30s, así que da margen a algún fallo de red
-- sin marcar a alguien como desconectado de más).
create or replace function public.police_online_citizens()
returns table (
  profile_id uuid,
  first_name text,
  last_name text,
  dni_number text,
  roblox_avatar_url text,
  last_seen_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;

  return query
    select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url, p.last_seen_at
    from public.dnis d
    join public.profiles p on p.id = d.profile_id
    where p.last_seen_at > now() - interval '90 seconds'
    order by p.last_seen_at desc;
end;
$$;

-- last_seen_at añadido al final de la vista (no se puede insertar una
-- columna en medio de una vista ya existente sin borrarla y crearla).
create or replace view public.citizen_profile_view as
select
  d.profile_id,
  d.id as dni_id,
  d.dni_number,
  d.first_name,
  d.last_name,
  d.birth_date,
  d.roblox_username,
  d.roblox_user_id,
  d.roblox_avatar_url,
  d.license_points,
  d.issued_at,
  ba.balance_cents,
  ba.next_salary_payment,
  ba.last_salary_payment,
  j.name as job_name,
  j.salary_cents,
  coalesce(fines_agg.total_count, 0) as fines_count,
  coalesce(fines_agg.pending_amount_cents, 0) as fines_pending_amount_cents,
  coalesce(arrests_agg.count, 0) as arrests_count,
  coalesce(vehicles_agg.count, 0) as vehicles_count,
  coalesce(confiscations_agg.count, 0) as confiscations_count,
  wp.id is not null as is_wanted,
  wp.reason as wanted_reason,
  wp.created_at as wanted_since,
  (d.first_name || ' ' || d.last_name) as full_name,
  p.last_seen_at
from public.dnis d
left join public.profiles p on p.id = d.profile_id
left join public.bank_accounts ba on ba.profile_id = d.profile_id
left join public.jobs j on j.id = ba.job_id
left join lateral (
  select count(*) as total_count,
         sum(amount_cents) filter (where status = 'pendiente') as pending_amount_cents
  from public.fines where citizen_id = d.profile_id
) fines_agg on true
left join lateral (
  select count(*) as count from public.arrests where citizen_id = d.profile_id
) arrests_agg on true
left join lateral (
  select count(*) as count from public.vehicles where profile_id = d.profile_id
) vehicles_agg on true
left join lateral (
  select count(*) as count from public.confiscations where citizen_id = d.profile_id
) confiscations_agg on true
left join public.wanted_persons wp on wp.citizen_id = d.profile_id and wp.active = true;

-- =====================================================================
-- 3) Registro de armas: comprar la licencia de armas da de alta un arma
--    con número de serie propio, visible para la policía en una lista
--    con nombre del comprador, DNI, número de serie y precio pagado.
-- =====================================================================

create sequence if not exists public.weapon_serial_seq start 1;

create table if not exists public.registered_weapons (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  weapon_model text not null,
  serial_number text not null unique,
  price_cents integer not null,
  created_at timestamptz not null default now()
);

alter table public.registered_weapons enable row level security;

drop policy if exists registered_weapons_select on public.registered_weapons;
create policy registered_weapons_select on public.registered_weapons for select
  using (profile_id = auth.uid() or public.is_police_authorized());
-- Sin policies de insert/update/delete: solo purchase_license (abajo) escribe aquí.

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

  -- Cada licencia de arma concreta (arma_beretta, arma_glock, etc. — la
  -- genérica "armas" está desactivada desde que se sustituyó por estas)
  -- da de alta un arma registrada con su propio número de serie.
  if v_license.code like 'arma_%' then
    insert into public.registered_weapons (profile_id, weapon_model, serial_number, price_cents)
      values (
        v_uid,
        regexp_replace(v_license.name, '^Licencia:\s*', ''),
        'AR-' || lpad(nextval('public.weapon_serial_seq')::text, 6, '0'),
        v_license.price_cents
      );
  end if;

  insert into public.bank_transactions (profile_id, type, amount_cents, description, reference_id)
    values (v_uid, 'compra_licencia', -v_license.price_cents, 'Compra de licencia: ' || v_license.name, v_license.id);

  perform public.write_audit_log(v_uid, 'compra_licencia', v_license.code, jsonb_build_object('precio_cents', v_license.price_cents));

  return query select true, 'Licencia adquirida.', v_account.balance_cents;
end;
$$;

create or replace function public.police_list_weapons()
returns table (
  weapon_id uuid,
  weapon_model text,
  serial_number text,
  price_cents integer,
  created_at timestamptz,
  profile_id uuid,
  first_name text,
  last_name text,
  dni_number text
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;

  return query
    select w.id, w.weapon_model, w.serial_number, w.price_cents, w.created_at, d.profile_id, d.first_name, d.last_name, d.dni_number
    from public.registered_weapons w
    join public.dnis d on d.profile_id = w.profile_id
    order by w.created_at desc;
end;
$$;
