-- =====================================================================
-- VIGO RP TABLET — Esquema principal
-- =====================================================================
-- Convenciones:
--  * Toda tabla de negocio referencia profiles.id (= auth.users.id).
--  * Los importes de dinero se guardan en céntimos (bigint) para evitar
--    errores de coma flotante. La UI los formatea a euros.
--  * Nada se borra: las acciones policiales/bancarias son de solo
--    inserción (append-only) para mantener un historial íntegro.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Roles y perfiles
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('ciudadano', 'policia', 'admin', 'fundador');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'ciudadano',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discord_links (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  discord_user_id text,
  discord_username text,
  avatar_url text,
  linked_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- DNI / ciudadanos
-- ---------------------------------------------------------------------
create sequence if not exists public.dni_number_seq start 100000;

create table if not exists public.dnis (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  dni_number text not null unique default ('V-' || lpad(nextval('public.dni_number_seq')::text, 6, '0')),
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  roblox_username text not null,
  roblox_user_id bigint not null,
  roblox_avatar_url text,
  license_points integer not null default 12 check (license_points >= 0 and license_points <= 20),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dnis_roblox_username_idx on public.dnis (lower(roblox_username));
create index if not exists dnis_name_idx on public.dnis (lower(first_name), lower(last_name));

-- ---------------------------------------------------------------------
-- Empleos / rangos (determinan el sueldo)
-- ---------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  salary_cents bigint not null default 0 check (salary_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Banco
-- ---------------------------------------------------------------------
create table if not exists public.bank_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  job_id uuid references public.jobs(id) on delete set null,
  last_salary_payment timestamptz,
  next_salary_payment timestamptz not null default (now() + interval '2 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  create type public.transaction_type as enum (
    'salario', 'compra_tienda', 'compra_licencia', 'pago_multa', 'ajuste_admin'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type public.transaction_type not null,
  amount_cents bigint not null, -- positivo = ingreso, negativo = gasto
  description text not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists bank_transactions_profile_idx on public.bank_transactions (profile_id, created_at desc);

-- ---------------------------------------------------------------------
-- Licencias
-- ---------------------------------------------------------------------
create table if not exists public.license_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  icon text not null default '🪪',
  price_cents bigint not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  renewable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  license_type_id uuid not null references public.license_types(id) on delete restrict,
  acquired_at timestamptz not null default now(),
  active boolean not null default true,
  unique (profile_id, license_type_id)
);

-- ---------------------------------------------------------------------
-- Vehículos
-- ---------------------------------------------------------------------
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plate text not null unique,
  brand text not null,
  model text not null,
  color text not null,
  insured boolean not null default false,
  impounded boolean not null default false,
  status text not null default 'activo',
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicles_plate_idx on public.vehicles (upper(plate));
create index if not exists vehicles_profile_idx on public.vehicles (profile_id);

-- ---------------------------------------------------------------------
-- Policía: usuarios autorizados
-- ---------------------------------------------------------------------
create table if not exists public.police_users (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  callsign text not null unique,
  rank text not null default 'Agente',
  authorized boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Acciones policiales (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.arrests (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id) on delete cascade,
  officer_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  created_at timestamptz not null default now()
);

do $$ begin
  create type public.fine_status as enum ('pendiente', 'pagada');
exception when duplicate_object then null;
end $$;

create table if not exists public.fines (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id) on delete cascade,
  officer_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  amount_cents bigint not null check (amount_cents > 0),
  status public.fine_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists fines_citizen_idx on public.fines (citizen_id, status);

create table if not exists public.confiscations (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id) on delete cascade,
  officer_id uuid not null references public.profiles(id) on delete restrict,
  material text not null,
  quantity text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_impounds (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  officer_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references public.profiles(id)
);

create table if not exists public.license_points_history (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id) on delete cascade,
  officer_id uuid not null references public.profiles(id) on delete restrict,
  points_removed integer not null check (points_removed > 0),
  points_before integer not null,
  points_after integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wanted_persons (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id) on delete cascade,
  officer_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create unique index if not exists wanted_persons_one_active_idx on public.wanted_persons (citizen_id) where active;
create index if not exists arrests_citizen_idx on public.arrests (citizen_id, created_at desc);
create index if not exists confiscations_citizen_idx on public.confiscations (citizen_id, created_at desc);
create index if not exists vehicle_impounds_vehicle_idx on public.vehicle_impounds (vehicle_id, created_at desc);
create index if not exists points_history_citizen_idx on public.license_points_history (citizen_id, created_at desc);

-- ---------------------------------------------------------------------
-- Radio policial
-- ---------------------------------------------------------------------
create table if not exists public.radio_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  callsign text not null,
  channel text not null default 'general',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists radio_messages_channel_idx on public.radio_messages (channel, created_at desc);

-- ---------------------------------------------------------------------
-- Configuración general (clave/valor JSON) y auditoría
-- ---------------------------------------------------------------------
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_label text,
  action text not null,
  target text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------
-- Rate limiting (para endpoints sensibles)
-- ---------------------------------------------------------------------
create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 1,
  window_start timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Trigger: crear perfil automáticamente al registrarse
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email));

  if new.raw_user_meta_data ? 'provider_id' or new.raw_user_meta_data ? 'sub' then
    insert into public.discord_links (profile_id, discord_user_id, discord_username, avatar_url)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'provider_id', new.raw_user_meta_data->>'sub'),
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'custom_claims'),
      new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- Trigger: al crear un DNI, crear cuenta bancaria y aplicar puntos iniciales
-- ---------------------------------------------------------------------
create or replace function public.handle_new_dni()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initial_points integer;
  v_default_job uuid;
begin
  select coalesce((value->>'initial_license_points')::integer, 12)
    into v_initial_points
    from public.app_config where key = 'general';

  if v_initial_points is not null then
    new.license_points := v_initial_points;
  end if;

  select id into v_default_job from public.jobs where code = 'desempleado' limit 1;

  insert into public.bank_accounts (profile_id, balance_cents, job_id, next_salary_payment)
  values (new.profile_id, 0, v_default_job, now() + interval '2 days')
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

drop trigger if exists before_dni_insert on public.dnis;
create trigger before_dni_insert
  before insert on public.dnis
  for each row execute procedure public.handle_new_dni();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists set_updated_at_dnis on public.dnis;
create trigger set_updated_at_dnis before update on public.dnis for each row execute procedure public.set_updated_at();
drop trigger if exists set_updated_at_jobs on public.jobs;
create trigger set_updated_at_jobs before update on public.jobs for each row execute procedure public.set_updated_at();
drop trigger if exists set_updated_at_bank_accounts on public.bank_accounts;
create trigger set_updated_at_bank_accounts before update on public.bank_accounts for each row execute procedure public.set_updated_at();
drop trigger if exists set_updated_at_license_types on public.license_types;
create trigger set_updated_at_license_types before update on public.license_types for each row execute procedure public.set_updated_at();
drop trigger if exists set_updated_at_vehicles on public.vehicles;
create trigger set_updated_at_vehicles before update on public.vehicles for each row execute procedure public.set_updated_at();
drop trigger if exists set_updated_at_police_users on public.police_users;
create trigger set_updated_at_police_users before update on public.police_users for each row execute procedure public.set_updated_at();
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

drop trigger if exists set_updated_at_shop_products on public.shop_products;
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
-- =====================================================================
-- Vistas agregadas (siempre calculadas en vivo desde las tablas fuente,
-- nunca contadores duplicados que puedan desincronizarse)
-- =====================================================================

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
  wp.created_at as wanted_since
from public.dnis d
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

create or replace view public.police_stats_view as
select
  (select count(*) from public.dnis) as total_citizens,
  (select count(*) from public.vehicles) as total_vehicles,
  (select count(distinct l.profile_id) from public.licenses l
     join public.license_types lt on lt.id = l.license_type_id
     where lt.code = 'armas' and l.active) as total_weapon_licenses,
  (select count(*) from public.wanted_persons where active) as total_wanted;
-- =====================================================================
-- Row Level Security
-- =====================================================================
-- Regla general: los ciudadanos solo ven/tocan sus propios datos.
-- Las escrituras sensibles (dinero, acciones policiales) NO tienen
-- policy de INSERT/UPDATE para el rol authenticated: solo pueden
-- ejecutarse a través de las funciones SECURITY DEFINER de 0002, que
-- validan permisos en servidor y se ejecutan como el propietario
-- (bypassa RLS de forma controlada y auditada).
--
-- Nota: cada "create policy" va precedido de un "drop policy if exists"
-- para que este archivo se pueda volver a ejecutar sin errores.
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.discord_links enable row level security;
alter table public.dnis enable row level security;
alter table public.jobs enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.license_types enable row level security;
alter table public.licenses enable row level security;
alter table public.vehicles enable row level security;
alter table public.police_users enable row level security;
alter table public.arrests enable row level security;
alter table public.fines enable row level security;
alter table public.confiscations enable row level security;
alter table public.vehicle_impounds enable row level security;
alter table public.license_points_history enable row level security;
alter table public.wanted_persons enable row level security;
alter table public.radio_messages enable row level security;
alter table public.app_config enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;
alter table public.shop_products enable row level security;
alter table public.shop_purchases enable row level security;

-- profiles ------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_police_authorized() or public.is_admin());

-- discord_links ---------------------------------------------------------
drop policy if exists discord_links_select on public.discord_links;
create policy discord_links_select on public.discord_links for select
  using (profile_id = auth.uid() or public.is_admin());

-- dnis ------------------------------------------------------------------
drop policy if exists dnis_select on public.dnis;
create policy dnis_select on public.dnis for select
  using (profile_id = auth.uid() or public.is_police_authorized() or public.is_admin());

drop policy if exists dnis_insert on public.dnis;
create policy dnis_insert on public.dnis for insert
  with check (profile_id = auth.uid() and not exists (select 1 from public.dnis d2 where d2.profile_id = auth.uid()));

-- jobs (catálogo público de solo lectura, administrable por admin) ------
drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs for select using (true);
drop policy if exists jobs_admin_write on public.jobs;
create policy jobs_admin_write on public.jobs for all using (public.is_admin()) with check (public.is_admin());

-- bank_accounts -----------------------------------------------------------
drop policy if exists bank_accounts_select on public.bank_accounts;
create policy bank_accounts_select on public.bank_accounts for select
  using (profile_id = auth.uid() or public.is_admin());
drop policy if exists bank_accounts_admin_write on public.bank_accounts;
create policy bank_accounts_admin_write on public.bank_accounts for update
  using (public.is_admin()) with check (public.is_admin());

-- bank_transactions ---------------------------------------------------------
drop policy if exists bank_transactions_select on public.bank_transactions;
create policy bank_transactions_select on public.bank_transactions for select
  using (profile_id = auth.uid() or public.is_admin());

-- license_types (catálogo) --------------------------------------------------
drop policy if exists license_types_select on public.license_types;
create policy license_types_select on public.license_types for select using (true);
drop policy if exists license_types_admin_write on public.license_types;
create policy license_types_admin_write on public.license_types for all
  using (public.is_admin()) with check (public.is_admin());

-- licenses --------------------------------------------------------------
drop policy if exists licenses_select on public.licenses;
create policy licenses_select on public.licenses for select
  using (profile_id = auth.uid() or public.is_police_authorized() or public.is_admin());

-- shop_products / shop_purchases ----------------------------------------
drop policy if exists shop_products_select on public.shop_products;
create policy shop_products_select on public.shop_products for select using (true);
drop policy if exists shop_products_admin_write on public.shop_products;
create policy shop_products_admin_write on public.shop_products for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists shop_purchases_select on public.shop_purchases;
create policy shop_purchases_select on public.shop_purchases for select
  using (profile_id = auth.uid() or public.is_admin());

-- vehicles ----------------------------------------------------------------
drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles for select
  using (profile_id = auth.uid() or public.is_police_authorized() or public.is_admin());
drop policy if exists vehicles_admin_write on public.vehicles;
create policy vehicles_admin_write on public.vehicles for update
  using (public.is_admin()) with check (public.is_admin());

-- police_users --------------------------------------------------------------
drop policy if exists police_users_select on public.police_users;
create policy police_users_select on public.police_users for select
  using (profile_id = auth.uid() or public.is_police_authorized() or public.is_admin());
drop policy if exists police_users_admin_write on public.police_users;
create policy police_users_admin_write on public.police_users for all
  using (public.is_admin()) with check (public.is_admin());

-- arrests / fines / confiscations / points / wanted --------------------------
drop policy if exists arrests_select on public.arrests;
create policy arrests_select on public.arrests for select
  using (citizen_id = auth.uid() or public.is_police_authorized() or public.is_admin());

drop policy if exists fines_select on public.fines;
create policy fines_select on public.fines for select
  using (citizen_id = auth.uid() or public.is_police_authorized() or public.is_admin());

drop policy if exists confiscations_select on public.confiscations;
create policy confiscations_select on public.confiscations for select
  using (citizen_id = auth.uid() or public.is_police_authorized() or public.is_admin());

drop policy if exists vehicle_impounds_select on public.vehicle_impounds;
create policy vehicle_impounds_select on public.vehicle_impounds for select
  using (
    public.is_police_authorized() or public.is_admin()
    or exists (select 1 from public.vehicles v where v.id = vehicle_impounds.vehicle_id and v.profile_id = auth.uid())
  );

drop policy if exists points_history_select on public.license_points_history;
create policy points_history_select on public.license_points_history for select
  using (citizen_id = auth.uid() or public.is_police_authorized() or public.is_admin());

drop policy if exists wanted_persons_select on public.wanted_persons;
create policy wanted_persons_select on public.wanted_persons for select
  using (citizen_id = auth.uid() or public.is_police_authorized() or public.is_admin());

-- radio_messages ------------------------------------------------------------
drop policy if exists radio_messages_select on public.radio_messages;
create policy radio_messages_select on public.radio_messages for select
  using (public.is_police_authorized() or public.is_admin());
drop policy if exists radio_messages_insert on public.radio_messages;
create policy radio_messages_insert on public.radio_messages for insert
  with check (sender_id = auth.uid() and (public.is_police_authorized() or public.is_admin()));

-- app_config ------------------------------------------------------------------
drop policy if exists app_config_admin_only on public.app_config;
create policy app_config_admin_only on public.app_config for select using (public.is_admin());
drop policy if exists app_config_admin_write on public.app_config;
create policy app_config_admin_write on public.app_config for all
  using (public.is_admin()) with check (public.is_admin());

-- audit_logs --------------------------------------------------------------------
drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select on public.audit_logs for select using (public.is_admin());
-- Sin policies de insert/update/delete para clientes: solo write_audit_log() (definer) puede escribir,
-- y nadie puede editar/borrar jamás, ni siquiera un admin desde la API.

-- rate_limits: sin policies para clientes (solo accesible via función definer)
-- =====================================================================
-- Seed de configuración inicial (NO incluye ciudadanos ficticios)
-- =====================================================================

insert into public.app_config (key, value) values
  ('security', jsonb_build_object('police_code_hash', crypt('1212', gen_salt('bf')))),
  ('general', jsonb_build_object('initial_license_points', 12)),
  ('discord', jsonb_build_object(
    'webhook_dni', null,
    'webhook_vehiculos', null,
    'webhook_compras', null,
    'webhook_policia', null,
    'webhook_sueldos', null
  ))
on conflict (key) do nothing;

-- Todos los ciudadanos empiezan con el empleo "desempleado", que paga un
-- sueldo base de 750€ cada 48h (configurable después desde /admin/empleos).
insert into public.jobs (code, name, salary_cents) values
  ('desempleado', 'Desempleado', 75000),
  ('taxista', 'Taxista', 15000),
  ('mecanico', 'Mecánico', 20000),
  ('sanitario', 'Sanitario', 25000),
  ('policia', 'Policía', 30000),
  ('administracion', 'Administración Pública', 40000)
on conflict (code) do nothing;

insert into public.license_types (code, name, description, icon, price_cents, active, renewable) values
  ('armas', 'Licencia de armas', 'Permite la posesión y porte legal de armas de fuego en Vigo RP.', '🔫', 250000, true, false),
  ('caza', 'Licencia de caza', 'Autoriza la práctica de caza en las zonas habilitadas.', '🦌', 120000, true, false),
  ('seguro_coche', 'Seguro obligatorio de coche', 'Seguro obligatorio para circular legalmente con tu vehículo.', '🚗', 80000, true, true)
on conflict (code) do nothing;
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
-- =====================================================================
-- Funciones y políticas adicionales para el panel de administración
-- =====================================================================

-- Permite a un admin cambiar el rol de un perfil (p.ej. revocar acceso
-- policial o nombrar a otro admin). No se expone ninguna otra columna
-- de "profiles" a escritura por RLS.
drop policy if exists profiles_admin_write on public.profiles;
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
-- =====================================================================
-- Licencias de armas específicas por modelo + equipamiento en la tienda
-- =====================================================================

-- Sustituimos la licencia genérica de "armas" por una licencia por cada
-- modelo de arma. Se desactiva en vez de borrarse para no romper a los
-- ciudadanos que ya la tuvieran comprada.
update public.license_types set active = false where code = 'armas';

insert into public.license_types (code, name, description, icon, price_cents, active, renewable) values
  ('arma_beretta', 'Licencia: Beretta M9', 'Permite la posesión y porte legal de una Beretta M9.', '🔫', 180000, true, false),
  ('arma_glock', 'Licencia: Glock 17', 'Permite la posesión y porte legal de una Glock 17.', '🔫', 180000, true, false),
  ('arma_deagle', 'Licencia: Desert Eagle', 'Permite la posesión y porte legal de una Desert Eagle.', '🔫', 220000, true, false),
  ('arma_ak47', 'Licencia: AK-47', 'Permite la posesión y porte legal de un fusil AK-47.', '🔫', 350000, true, false),
  ('arma_m4', 'Licencia: M4A1', 'Permite la posesión y porte legal de un fusil M4A1.', '🔫', 380000, true, false),
  ('arma_escopeta', 'Licencia: Escopeta recortada', 'Permite la posesión y porte legal de una escopeta recortada.', '🔫', 260000, true, false)
on conflict (code) do nothing;

insert into public.shop_products (code, name, description, icon, price_cents, active) values
  ('equipo_mascara', 'Máscara táctica', 'Cubre el rostro para uso de rol.', '🥷', 15000, true),
  ('equipo_cuchillo', 'Cuchillo', 'Arma blanca para uso de rol.', '🔪', 20000, true),
  ('equipo_bate', 'Bate de béisbol', 'Objeto contundente para uso de rol.', '🏏', 15000, true),
  ('equipo_chaleco', 'Chaleco antibalas', 'Chaleco de protección para uso de rol.', '🦺', 45000, true),
  ('equipo_guantes', 'Guantes tácticos', 'Guantes tácticos para uso de rol.', '🧤', 8000, true)
on conflict (code) do nothing;
-- =====================================================================
-- Acceso policial por código de un solo uso enviado por email
-- =====================================================================
-- Sustituye el código fijo compartido (p.ej. "1212") por un código de 6
-- dígitos que cambia en cada solicitud y se envía únicamente al correo
-- del dueño del servidor. Un ciudadano nunca ve el código: solo puede
-- pedir que se genere y se lo entregue quien reciba el email.

create table if not exists public.police_access_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.police_access_codes enable row level security;
-- Sin policies para clientes (mismo patrón que rate_limits): solo las
-- funciones security definer de abajo pueden leer/escribir esta tabla.

create or replace function public.request_police_access_code()
returns table (success boolean, message text, code text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_allowed boolean;
  v_code text;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (select 1 from public.dnis where profile_id = v_uid) then
    return query select false, 'Necesitas tener un DNI creado.', null::text;
    return;
  end if;

  select public.check_rate_limit('police_code_request:' || v_uid::text, 3, 600) into v_allowed;
  if not v_allowed then
    return query select false, 'Has pedido demasiados códigos. Espera unos minutos e inténtalo de nuevo.', null::text;
    return;
  end if;

  -- Invalida cualquier código anterior sin usar de este ciudadano, para que
  -- solo el último enviado por email sea válido.
  update public.police_access_codes set used = true where profile_id = v_uid and used = false;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into public.police_access_codes (profile_id, code_hash, expires_at)
    values (v_uid, crypt(v_code, gen_salt('bf')), now() + interval '10 minutes');

  perform public.write_audit_log(v_uid, 'codigo_policial_solicitado', v_uid::text, '{}'::jsonb);
  return query select true, 'Código generado.', v_code;
end;
$$;

create or replace function public.redeem_police_access_code(p_code text)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_allowed boolean;
  v_row public.police_access_codes%rowtype;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select public.check_rate_limit('police_code_verify:' || v_uid::text, 5, 300) into v_allowed;
  if not v_allowed then
    return query select false, 'Demasiados intentos. Espera unos minutos.';
    return;
  end if;

  select * into v_row from public.police_access_codes
    where profile_id = v_uid and used = false
    order by created_at desc
    limit 1;

  if not found then
    return query select false, 'No has solicitado ningún código todavía.';
    return;
  end if;

  if v_row.expires_at < now() then
    return query select false, 'El código ha caducado. Solicita uno nuevo.';
    return;
  end if;

  if crypt(p_code, v_row.code_hash) <> v_row.code_hash then
    perform public.write_audit_log(v_uid, 'intento_codigo_policial_fallido', v_uid::text, '{}'::jsonb);
    return query select false, 'Código incorrecto.';
    return;
  end if;

  update public.police_access_codes set used = true where id = v_row.id;

  insert into public.police_users (profile_id, callsign, authorized)
    values (v_uid, 'Z-' || floor(random() * 90 + 10)::text, true)
    on conflict (profile_id) do update set authorized = true;

  update public.profiles set role = 'policia' where id = v_uid and role = 'ciudadano';

  perform public.write_audit_log(v_uid, 'acceso_policial_concedido', v_uid::text, '{}'::jsonb);
  return query select true, 'Acceso policial concedido.';
end;
$$;
-- =====================================================================
-- Más licencias de armas y más equipamiento en la tienda
-- =====================================================================

insert into public.license_types (code, name, description, icon, price_cents, active, renewable) values
  ('arma_francotirador', 'Licencia: Rifle de francotirador', 'Permite la posesión y porte legal de un rifle de francotirador.', '🎯', 450000, true, false),
  ('arma_uzi', 'Licencia: Uzi', 'Permite la posesión y porte legal de un subfusil Uzi.', '🔫', 280000, true, false),
  ('arma_revolver', 'Licencia: Revólver', 'Permite la posesión y porte legal de un revólver.', '🔫', 150000, true, false)
on conflict (code) do nothing;

insert into public.shop_products (code, name, description, icon, price_cents, active) values
  ('equipo_palanca', 'Palanca', 'Herramienta para forzar puertas y objetos, uso de rol.', '🛠️', 18000, true),
  ('equipo_caja_municion', 'Caja de munición', 'Munición de repuesto para uso de rol.', '📦', 12000, true),
  ('equipo_puro', 'Puro', 'Puro de lujo para uso de rol.', '🚬', 6000, true),
  ('equipo_cigarrillo', 'Paquete de cigarrillos', 'Cigarrillos para uso de rol.', '🚬', 3000, true),
  ('equipo_mechero', 'Mechero', 'Mechero para uso de rol.', '🔥', 2000, true),
  ('equipo_linterna', 'Linterna', 'Linterna táctica para uso de rol.', '🔦', 10000, true),
  ('equipo_mochila', 'Mochila', 'Mochila para transportar objetos, uso de rol.', '🎒', 15000, true),
  ('equipo_gafas_sol', 'Gafas de sol', 'Complemento estético para uso de rol.', '🕶️', 8000, true)
on conflict (code) do nothing;
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
-- =====================================================================
-- Denuncias entre ciudadanos + gestión policial
-- =====================================================================
-- Cualquier ciudadano con DNI puede denunciar a otro ciudadano indicando
-- un motivo. La policía ve todas las denuncias y puede marcarlas como
-- pendiente, en inspección o cerrada.

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  accused_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'en_inspeccion', 'cerrada')),
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at_complaints on public.complaints;
create trigger set_updated_at_complaints before update on public.complaints for each row execute procedure public.set_updated_at();

alter table public.complaints enable row level security;

drop policy if exists complaints_select on public.complaints;
create policy complaints_select on public.complaints for select
  using (reporter_id = auth.uid() or public.is_police_authorized() or public.is_admin());
-- Sin policies de insert/update para clientes: solo las funciones de abajo
-- (security definer) pueden crear o cambiar el estado de una denuncia.

create or replace view public.complaints_view as
select
  c.id,
  c.reason,
  c.status,
  c.created_at,
  c.updated_at,
  c.reporter_id,
  rd.first_name as reporter_first_name,
  rd.last_name as reporter_last_name,
  rd.dni_number as reporter_dni_number,
  c.accused_id,
  ad.first_name as accused_first_name,
  ad.last_name as accused_last_name,
  ad.dni_number as accused_dni_number,
  c.resolved_by
from public.complaints c
join public.dnis rd on rd.profile_id = c.reporter_id
join public.dnis ad on ad.profile_id = c.accused_id;

-- Búsqueda de ciudadanos para elegir a quién denunciar. RLS en "dnis" solo
-- deja leer tu propia fila (o a policía/admin), así que un ciudadano normal
-- no puede buscar a otro directamente: esta función, limitada a columnas
-- no sensibles (nunca saldo, puntos ni busca y captura), se lo permite.
create or replace function public.search_citizens_public(p_query text, p_by text default 'nombre')
returns table (profile_id uuid, first_name text, last_name text, dni_number text, roblox_avatar_url text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_by = 'dni' then
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid() and d.dni_number ilike '%' || p_query || '%'
      limit 15;
  elsif p_by = 'roblox' then
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid() and d.roblox_username ilike '%' || p_query || '%'
      limit 15;
  else
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid()
        and (d.first_name ilike '%' || p_query || '%' or d.last_name ilike '%' || p_query || '%')
      limit 15;
  end if;
end;
$$;

create or replace function public.file_complaint(p_accused_id uuid, p_reason text)
returns table (success boolean, message text, complaint_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_allowed boolean;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (select 1 from public.dnis where profile_id = v_uid) then
    return query select false, 'Necesitas tener un DNI creado.', null::uuid;
    return;
  end if;

  if p_accused_id = v_uid then
    return query select false, 'No puedes denunciarte a ti mismo.', null::uuid;
    return;
  end if;

  if not exists (select 1 from public.dnis where profile_id = p_accused_id) then
    return query select false, 'La persona denunciada no existe.', null::uuid;
    return;
  end if;

  select public.check_rate_limit('file_complaint:' || v_uid::text, 5, 3600) into v_allowed;
  if not v_allowed then
    return query select false, 'Has puesto demasiadas denuncias. Espera un poco antes de poner otra.', null::uuid;
    return;
  end if;

  insert into public.complaints (reporter_id, accused_id, reason)
    values (v_uid, p_accused_id, p_reason)
    returning id into v_id;

  perform public.write_audit_log(v_uid, 'denuncia_creada', v_id::text, jsonb_build_object('accused_id', p_accused_id));
  return query select true, 'Denuncia registrada.', v_id;
end;
$$;

create or replace function public.police_update_complaint_status(p_complaint_id uuid, p_status text)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not public.is_police_authorized(v_uid) then
    return query select false, 'No autorizado.';
    return;
  end if;

  if p_status not in ('pendiente', 'en_inspeccion', 'cerrada') then
    return query select false, 'Estado inválido.';
    return;
  end if;

  update public.complaints set status = p_status, resolved_by = v_uid where id = p_complaint_id;
  if not found then
    return query select false, 'Denuncia no encontrada.';
    return;
  end if;

  perform public.write_audit_log(v_uid, 'denuncia_actualizada', p_complaint_id::text, jsonb_build_object('status', p_status));
  return query select true, 'Denuncia actualizada.';
end;
$$;

-- Arreglo de police_stats_view: al sustituir la licencia genérica "armas"
-- por licencias específicas por modelo (arma_beretta, arma_ak47, etc. en
-- la migración 0008), este contador se quedó buscando solo el código
-- "armas" exacto y siempre daría 0 para licencias nuevas.
create or replace view public.police_stats_view as
select
  (select count(*) from public.dnis) as total_citizens,
  (select count(*) from public.vehicles) as total_vehicles,
  (select count(distinct l.profile_id) from public.licenses l
     join public.license_types lt on lt.id = l.license_type_id
     where (lt.code = 'armas' or lt.code like 'arma_%') and l.active) as total_weapon_licenses,
  (select count(*) from public.wanted_persons where active) as total_wanted;
-- =====================================================================
-- Arreglo: la búsqueda de ciudadanos para poner una denuncia no
-- encontraba a nadie al escribir el nombre completo (nombre + apellidos)
-- =====================================================================
-- search_citizens_public() solo comparaba el texto buscado contra
-- first_name O last_name por separado, así que una búsqueda como
-- "Juan Pérez" nunca encajaba con first_name = 'Juan' ni con
-- last_name = 'Pérez' (la cadena completa no está contenida en ninguna
-- de las dos columnas). Ahora también compara contra el nombre completo
-- en ambos órdenes, y normaliza espacios repetidos en la búsqueda.

create or replace function public.search_citizens_public(p_query text, p_by text default 'nombre')
returns table (profile_id uuid, first_name text, last_name text, dni_number text, roblox_avatar_url text)
language plpgsql security definer set search_path = public as $$
declare
  v_query text := trim(regexp_replace(p_query, '\s+', ' ', 'g'));
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_by = 'dni' then
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid() and d.dni_number ilike '%' || v_query || '%'
      limit 15;
  elsif p_by = 'roblox' then
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid() and d.roblox_username ilike '%' || v_query || '%'
      limit 15;
  else
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid()
        and (
          d.first_name ilike '%' || v_query || '%'
          or d.last_name ilike '%' || v_query || '%'
          or (d.first_name || ' ' || d.last_name) ilike '%' || v_query || '%'
          or (d.last_name || ' ' || d.first_name) ilike '%' || v_query || '%'
        )
      limit 15;
  end if;
end;
$$;

-- El mismo problema existía en la búsqueda de policía (citizen_profile_view
-- filtrado por first_name/last_name por separado desde el backend), así
-- que añadimos una columna de nombre completo a la vista para que el
-- backend también pueda buscar por nombre y apellidos juntos.
-- Nota: "create or replace view" no permite insertar una columna nueva en
-- medio de la lista (solo añadir al final), así que full_name va al final
-- para no romper el "replace" sobre la vista ya desplegada en producción.
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
  (d.first_name || ' ' || d.last_name) as full_name
from public.dnis d
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
-- =====================================================================
-- 1) Búsqueda de ciudadanos realmente robusta: por palabras sueltas y
--    sin distinguir acentos (antes "Juan Perez" no encontraba a "Juan
--    Pérez" porque las tildes no coinciden con ILIKE normal).
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'unaccent') then
    if not exists (
      select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
      where e.extname = 'unaccent' and n.nspname = 'public'
    ) then
      alter extension unaccent set schema public;
    end if;
  else
    create extension unaccent with schema public;
  end if;
end $$;

create or replace function public.search_citizens_public(p_query text, p_by text default 'nombre')
returns table (profile_id uuid, first_name text, last_name text, dni_number text, roblox_avatar_url text)
language plpgsql security definer set search_path = public as $$
declare
  v_query text := trim(regexp_replace(p_query, '\s+', ' ', 'g'));
  v_tokens text[];
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_by = 'dni' then
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid() and d.dni_number ilike '%' || v_query || '%'
      limit 15;
  elsif p_by = 'roblox' then
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid()
        and unaccent(lower(d.roblox_username)) ilike unaccent(lower('%' || v_query || '%'))
      limit 15;
  else
    v_tokens := string_to_array(v_query, ' ');
    return query
      select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_avatar_url
      from public.dnis d
      where d.profile_id <> auth.uid()
        and not exists (
          select 1 from unnest(v_tokens) as tok
          where tok <> ''
            and unaccent(lower(d.first_name || ' ' || d.last_name)) not ilike '%' || unaccent(lower(tok)) || '%'
        )
      limit 15;
  end if;
end;
$$;

-- Misma lógica (por palabras sueltas, sin acentos) para la búsqueda de
-- policía, que antes hacía el filtro directamente en el backend con
-- ilike y tenía el mismo fallo con nombres completos.
create or replace function public.search_citizens_police(p_query text, p_by text default 'nombre')
returns setof public.citizen_profile_view
language plpgsql security definer set search_path = public as $$
declare
  v_query text := trim(regexp_replace(p_query, '\s+', ' ', 'g'));
  v_tokens text[];
begin
  if not public.is_police_authorized(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  if p_by = 'dni' then
    return query select * from public.citizen_profile_view where dni_number ilike '%' || v_query || '%' limit 25;
  elsif p_by = 'roblox' then
    return query
      select * from public.citizen_profile_view
      where unaccent(lower(roblox_username)) ilike unaccent(lower('%' || v_query || '%'))
      limit 25;
  else
    v_tokens := string_to_array(v_query, ' ');
    return query
      select v.* from public.citizen_profile_view v
      where not exists (
        select 1 from unnest(v_tokens) as tok
        where tok <> ''
          and unaccent(lower(v.first_name || ' ' || v.last_name)) not ilike '%' || unaccent(lower(tok)) || '%'
      )
      limit 25;
  end if;
end;
$$;

-- =====================================================================
-- 2) Busca y captura: matrícula opcional del vehículo + listado para
--    policía (foto del DNI, nombre y apellidos, matrícula si se puso).
-- =====================================================================
alter table public.wanted_persons add column if not exists vehicle_plate text;

-- El nuevo parámetro opcional cambia la firma de la función: hay que
-- borrar la versión antigua de 2 argumentos o quedan las dos a la vez y
-- PostgREST no sabe cuál usar al llamarla por RPC.
drop function if exists public.police_set_wanted(uuid, text);

create or replace function public.police_set_wanted(p_citizen_id uuid, p_reason text, p_vehicle_plate text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_plate text := nullif(trim(upper(coalesce(p_vehicle_plate, ''))), '');
begin
  if not public.is_police_authorized(v_uid) then
    raise exception 'No autorizado';
  end if;

  update public.wanted_persons set active = false, resolved_at = now(), resolved_by = v_uid
    where citizen_id = p_citizen_id and active = true;

  insert into public.wanted_persons (citizen_id, officer_id, reason, vehicle_plate)
    values (p_citizen_id, v_uid, p_reason, v_plate) returning id into v_id;

  perform public.write_audit_log(v_uid, 'busca_y_captura_activar', p_citizen_id::text, jsonb_build_object('motivo', p_reason, 'matricula', v_plate));
  return v_id;
end;
$$;

create or replace view public.wanted_active_view as
select
  wp.id,
  wp.citizen_id,
  wp.reason,
  wp.vehicle_plate,
  wp.created_at,
  d.first_name,
  d.last_name,
  d.dni_number,
  d.roblox_avatar_url
from public.wanted_persons wp
join public.dnis d on d.profile_id = wp.citizen_id
where wp.active = true
order by wp.created_at desc;

-- =====================================================================
-- 3) Un ciudadano puede eliminar su propio vehículo (p.ej. si ya no lo
--    usa). No se puede borrar uno incautado: primero tiene que liberarlo
--    un agente.
-- =====================================================================
create or replace function public.delete_vehicle(p_vehicle_id uuid)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_impounded boolean;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select profile_id, impounded into v_owner, v_impounded from public.vehicles where id = p_vehicle_id;

  if v_owner is null then
    return query select false, 'Vehículo no encontrado.';
    return;
  end if;

  if v_owner <> v_uid then
    return query select false, 'No autorizado.';
    return;
  end if;

  if v_impounded then
    return query select false, 'No puedes eliminar un vehículo incautado. Pide a un agente que lo libere primero.';
    return;
  end if;

  delete from public.vehicles where id = p_vehicle_id;
  perform public.write_audit_log(v_uid, 'vehiculo_eliminado', p_vehicle_id::text, '{}'::jsonb);
  return query select true, 'Vehículo eliminado.';
end;
$$;
-- Sueldo de "Desempleado" (rango civil, sin trabajo): 400€ cada 48h.
update public.jobs set salary_cents = 40000 where code = 'desempleado';
-- =====================================================================
-- Denuncias: quitar la búsqueda de ciudadanos y pasar a texto libre
-- =====================================================================
-- La búsqueda daba problemas constantes (acentos, orden de nombre y
-- apellidos, gente que solo sabe la matrícula del coche pero no el
-- nombre del conductor...). Ahora el ciudadano simplemente escribe a
-- quién denuncia (nombre, o descripción del vehículo/matrícula si no
-- sabe el nombre) y el motivo, y la denuncia llega igualmente a la
-- policía para que investigue.

alter table public.complaints alter column accused_id drop not null;
alter table public.complaints add column if not exists accused_description text;

create or replace view public.complaints_view as
select
  c.id,
  c.reason,
  c.status,
  c.created_at,
  c.updated_at,
  c.reporter_id,
  rd.first_name as reporter_first_name,
  rd.last_name as reporter_last_name,
  rd.dni_number as reporter_dni_number,
  c.accused_id,
  ad.first_name as accused_first_name,
  ad.last_name as accused_last_name,
  ad.dni_number as accused_dni_number,
  c.resolved_by,
  c.accused_description
from public.complaints c
join public.dnis rd on rd.profile_id = c.reporter_id
left join public.dnis ad on ad.profile_id = c.accused_id;

drop function if exists public.file_complaint(uuid, text);

create or replace function public.file_complaint(p_accused_description text, p_reason text)
returns table (success boolean, message text, complaint_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_allowed boolean;
  v_id uuid;
  v_description text := trim(p_accused_description);
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (select 1 from public.dnis where profile_id = v_uid) then
    return query select false, 'Necesitas tener un DNI creado.', null::uuid;
    return;
  end if;

  if v_description = '' then
    return query select false, 'Indica a quién denuncias (nombre, vehículo, matrícula...).', null::uuid;
    return;
  end if;

  select public.check_rate_limit('file_complaint:' || v_uid::text, 5, 3600) into v_allowed;
  if not v_allowed then
    return query select false, 'Has puesto demasiadas denuncias. Espera un poco antes de poner otra.', null::uuid;
    return;
  end if;

  insert into public.complaints (reporter_id, accused_description, reason)
    values (v_uid, v_description, p_reason)
    returning id into v_id;

  perform public.write_audit_log(v_uid, 'denuncia_creada', v_id::text, jsonb_build_object('denunciado', v_description));
  return query select true, 'Denuncia registrada.', v_id;
end;
$$;
-- =====================================================================
-- Marcadores en el mapa de policía (posición propia, botón de pánico,
-- incidente, control) en tiempo real para todos los agentes.
-- =====================================================================
-- ERLC no da la ubicación real de los jugadores a herramientas externas,
-- así que esto NO es rastreo automático: es un agente marcando a mano
-- dónde está (o un aviso) sobre el mapa, y todos los demás agentes lo ven
-- al instante. x/y son proporciones (0-1) sobre la imagen del mapa, no
-- coordenadas del juego.

create table if not exists public.map_markers (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  callsign text not null,
  type text not null check (type in ('posicion', 'panico', 'incidente', 'control')),
  x real not null check (x >= 0 and x <= 1),
  y real not null check (y >= 0 and y <= 1),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists map_markers_created_at_idx on public.map_markers (created_at desc);

alter table public.map_markers enable row level security;

drop policy if exists map_markers_select on public.map_markers;
create policy map_markers_select on public.map_markers for select
  using (public.is_police_authorized() or public.is_admin());
-- Sin policies de insert/update/delete para clientes: solo las funciones
-- de abajo (security definer) pueden crear o borrar un marcador.

create or replace function public.police_create_map_marker(p_type text, p_x real, p_y real, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_callsign text;
  v_id uuid;
begin
  if not public.is_police_authorized(v_uid) then
    raise exception 'No autorizado';
  end if;

  if p_type not in ('posicion', 'panico', 'incidente', 'control') then
    raise exception 'Tipo de marcador inválido';
  end if;

  select callsign into v_callsign from public.police_users where profile_id = v_uid;

  insert into public.map_markers (created_by, callsign, type, x, y, note)
    values (v_uid, coalesce(v_callsign, 'DESCONOCIDO'), p_type, greatest(0, least(1, p_x)), greatest(0, least(1, p_y)), nullif(trim(coalesce(p_note, '')), ''))
    returning id into v_id;

  if p_type = 'panico' then
    perform public.write_audit_log(v_uid, 'mapa_boton_panico', v_id::text, jsonb_build_object('callsign', v_callsign));
  end if;

  return v_id;
end;
$$;

create or replace function public.police_delete_map_marker(p_marker_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  delete from public.map_markers where id = p_marker_id;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'map_markers'
     )
  then
    alter publication supabase_realtime add table public.map_markers;
  end if;
end $$;
-- =====================================================================
-- Arreglo: police_create_map_marker() solo devolvía el id, así que el
-- agente que creaba el marcador dependía por completo de Realtime para
-- verlo aparecer en su propio mapa. Si Realtime fallaba o tardaba (como
-- ya pasó con las luces de busca y captura), el marcador se guardaba en
-- la base de datos pero no se veía nada en pantalla. Ahora devuelve la
-- fila completa para que la tablet la pinte al instante sin depender
-- solo de Realtime.
-- =====================================================================

drop function if exists public.police_create_map_marker(text, real, real, text);

create or replace function public.police_create_map_marker(p_type text, p_x real, p_y real, p_note text default null)
returns setof public.map_markers
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_callsign text;
begin
  if not public.is_police_authorized(v_uid) then
    raise exception 'No autorizado';
  end if;

  if p_type not in ('posicion', 'panico', 'incidente', 'control') then
    raise exception 'Tipo de marcador inválido';
  end if;

  select callsign into v_callsign from public.police_users where profile_id = v_uid;

  return query
    insert into public.map_markers (created_by, callsign, type, x, y, note)
      values (v_uid, coalesce(v_callsign, 'DESCONOCIDO'), p_type, greatest(0, least(1, p_x)), greatest(0, least(1, p_y)), nullif(trim(coalesce(p_note, '')), ''))
      returning *;

  if p_type = 'panico' then
    perform public.write_audit_log(v_uid, 'mapa_boton_panico', null, jsonb_build_object('callsign', v_callsign));
  end if;
end;
$$;
-- Artículos de rol variados para la tienda.
insert into public.shop_products (code, name, description, icon, price_cents) values
  ('cadena_oro', 'Cadena de oro', 'Cadena de oro llamativa, ideal para presumir.', '📿', 15000),
  ('rolex', 'Rolex', 'Reloj de lujo. Puro estatus.', '⌚', 50000),
  ('silla_plastico', 'Silla de plástico', 'La típica silla blanca de jardín.', '🪑', 500),
  ('parrilla_portatil', 'Parrilla portátil', 'Para hacer una barbacoa donde sea.', '🍖', 8000),
  ('gafas_sol_lujo', 'Gafas de sol de lujo', 'Gafas de diseñador, imprescindibles.', '🕶️', 5000),
  ('gorra', 'Gorra', 'Gorra para completar el look.', '🧢', 1500),
  ('altavoz_portatil', 'Altavoz portátil', 'Música allá donde vayas.', '🔊', 6000),
  ('silla_camping', 'Silla de camping', 'Plegable, para acampar o esperar en el coche.', '🏕️', 2000),
  ('perfume_caro', 'Perfume caro', 'Huele a dinero.', '🧴', 4000),
  ('vape', 'Vape', 'Vapeador desechable.', '💨', 1000)
on conflict (code) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, price_cents = excluded.price_cents;
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
-- =====================================================================
-- Panel Admin de la propia tablet: sección al final del menú protegida
-- por una contraseña numérica compartida (empieza en "0000"), pensada
-- para que cualquiera con esa contraseña pueda cambiar el tema de la
-- tablet y asignar roles/empleos sin necesitar una cuenta con el rol
-- real de admin en la base de datos. La contraseña se comprueba SIEMPRE
-- en el servidor (dentro de cada función); el cliente nunca decide por
-- sí solo si el panel queda "desbloqueado".
-- =====================================================================

create table if not exists public.panel_admin_config (
  id text primary key default 'main',
  password_hash text not null default crypt('0000', gen_salt('bf')),
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  updated_at timestamptz not null default now(),
  constraint panel_admin_config_singleton check (id = 'main')
);

insert into public.panel_admin_config (id) values ('main') on conflict (id) do nothing;

alter table public.panel_admin_config enable row level security;
-- Sin policies para clientes (igual que rate_limits/app_config): solo
-- las funciones de abajo pueden leer/escribir esta tabla, y la
-- contraseña en sí nunca sale de aquí (solo un booleano de "correcta").

-- El límite de intentos solo cuenta las contraseñas INCORRECTAS: así se
-- frena la fuerza bruta sin arriesgarse a bloquear a quien ya conoce la
-- contraseña y solo está usando el panel con normalidad (esta función la
-- llaman también panel_admin_search_citizens y panel_admin_set_job en
-- cada acción, no solo la pantalla de desbloqueo).
create or replace function public.verify_panel_admin_password(p_password text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_hash text;
  v_correct boolean;
  v_allowed boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select password_hash into v_hash from public.panel_admin_config where id = 'main';
  v_correct := v_hash is not null and crypt(p_password, v_hash) = v_hash;

  if not v_correct then
    select public.check_rate_limit('panel_admin_verify_fail:' || auth.uid()::text, 15, 300) into v_allowed;
    if not v_allowed then
      return false;
    end if;
  end if;

  return v_correct;
end;
$$;

-- Lectura pública del tema (no es sensible: hace falta para pintar la
-- tablet igual antes de comprobar ninguna contraseña).
create or replace function public.get_tablet_theme()
returns text language sql stable security definer set search_path = public as $$
  select theme from public.panel_admin_config where id = 'main';
$$;

create or replace function public.panel_admin_set_theme(p_password text, p_theme text)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.verify_panel_admin_password(p_password) then
    return query select false, 'Contraseña incorrecta.';
    return;
  end if;
  if p_theme not in ('dark', 'light') then
    return query select false, 'Tema no válido.';
    return;
  end if;
  update public.panel_admin_config set theme = p_theme, updated_at = now() where id = 'main';
  perform public.write_audit_log(auth.uid(), 'panel_admin_cambio_tema', null, jsonb_build_object('theme', p_theme));
  return query select true, 'Tema actualizado.';
end;
$$;

create or replace function public.panel_admin_set_password(p_current_password text, p_new_password text)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.verify_panel_admin_password(p_current_password) then
    return query select false, 'La contraseña actual no es correcta.';
    return;
  end if;
  if p_new_password !~ '^[0-9]{4,12}$' then
    return query select false, 'La nueva contraseña debe tener solo números (entre 4 y 12 dígitos).';
    return;
  end if;
  update public.panel_admin_config set password_hash = crypt(p_new_password, gen_salt('bf')), updated_at = now() where id = 'main';
  perform public.write_audit_log(auth.uid(), 'panel_admin_password_cambiada', null, '{}'::jsonb);
  return query select true, 'Contraseña actualizada.';
end;
$$;

-- Buscar ciudadanos para asignarles rol/empleo desde el Panel Admin.
-- Misma lógica de búsqueda tokenizada y sin acentos que search_citizens_police.
create or replace function public.panel_admin_search_citizens(p_password text, p_query text)
returns table (
  profile_id uuid,
  first_name text,
  last_name text,
  dni_number text,
  roblox_username text,
  role public.app_role,
  job_id uuid,
  job_code text,
  job_name text
)
language plpgsql security definer set search_path = public as $$
declare
  v_query text := trim(regexp_replace(p_query, '\s+', ' ', 'g'));
  v_tokens text[];
begin
  if not public.verify_panel_admin_password(p_password) then
    raise exception 'Contraseña incorrecta';
  end if;

  v_tokens := string_to_array(v_query, ' ');
  return query
    select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_username, p.role, j.id, j.code, j.name
    from public.dnis d
    join public.profiles p on p.id = d.profile_id
    left join public.bank_accounts b on b.profile_id = d.profile_id
    left join public.jobs j on j.id = b.job_id
    where d.dni_number ilike '%' || v_query || '%'
       or unaccent(lower(d.roblox_username)) ilike unaccent(lower('%' || v_query || '%'))
       or not exists (
            select 1 from unnest(v_tokens) as tok
            where tok <> ''
              and unaccent(lower(d.first_name || ' ' || d.last_name)) not ilike '%' || unaccent(lower(tok)) || '%'
          )
    order by d.first_name
    limit 20;
end;
$$;

-- Asignar empleo/rol desde el Panel Admin: misma lógica que admin_set_job
-- (incluida la sincronización de acceso policial), pero comprobando la
-- contraseña compartida en vez de un rol real de admin.
create or replace function public.panel_admin_set_job(p_password text, p_profile_id uuid, p_job_id uuid)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_job_code text;
begin
  if not public.verify_panel_admin_password(p_password) then
    return query select false, 'Contraseña incorrecta.';
    return;
  end if;

  update public.bank_accounts set job_id = p_job_id where profile_id = p_profile_id;
  if not found then
    return query select false, 'Este ciudadano no tiene cuenta bancaria (no tiene DNI).';
    return;
  end if;

  select code into v_job_code from public.jobs where id = p_job_id;
  perform public.sync_police_access_for_job(p_profile_id, v_job_code);

  perform public.write_audit_log(auth.uid(), 'panel_admin_cambio_empleo', p_profile_id::text, jsonb_build_object('job_id', p_job_id));
  return query select true, 'Rol actualizado correctamente.';
end;
$$;
-- =====================================================================
-- Asuntos Internos: tablón de mensajes persistente para el cuerpo de
-- policía (no es un chat en directo como el antiguo Radio: los mensajes
-- quedan guardados). Solo pueden leerlo y escribir en él quienes tengan
-- acceso policial (is_police_authorized()).
-- =====================================================================

create table if not exists public.internal_affairs_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  callsign text not null,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists internal_affairs_posts_created_at_idx on public.internal_affairs_posts (created_at desc);

alter table public.internal_affairs_posts enable row level security;

drop policy if exists internal_affairs_posts_select on public.internal_affairs_posts;
create policy internal_affairs_posts_select on public.internal_affairs_posts for select using (public.is_police_authorized());
-- Sin policies de insert/update/delete: solo las funciones de abajo escriben.

create or replace function public.post_internal_affairs_message(p_message text)
returns setof public.internal_affairs_posts
language plpgsql security definer set search_path = public as $$
declare
  v_callsign text;
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;

  select callsign into v_callsign from public.police_users where profile_id = auth.uid();

  return query
    insert into public.internal_affairs_posts (author_id, callsign, message)
    values (auth.uid(), coalesce(v_callsign, 'Desconocido'), p_message)
    returning *;
end;
$$;

create or replace function public.delete_internal_affairs_message(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;
  -- Cada agente solo puede borrar sus propios mensajes.
  delete from public.internal_affairs_posts where id = p_id and author_id = auth.uid();
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'internal_affairs_posts'
     )
  then
    alter publication supabase_realtime add table public.internal_affairs_posts;
  end if;
end $$;
-- =====================================================================
-- Redadas: planificación de operativos para la policía. Cada redada
-- tiene un título, notas de texto y trazos dibujados a mano sobre el
-- mapa de ERLC (compartidos entre todos los agentes en tiempo real).
-- Solo pueden verlas y editarlas quienes tengan acceso policial.
-- =====================================================================

create table if not exists public.raids (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  notes text not null default '',
  created_by uuid not null references public.profiles(id) on delete cascade,
  callsign text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.raid_strokes (
  id uuid primary key default gen_random_uuid(),
  raid_id uuid not null references public.raids(id) on delete cascade,
  points jsonb not null,
  color text not null default '#ef4444',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists raid_strokes_raid_id_idx on public.raid_strokes (raid_id);

alter table public.raids enable row level security;
alter table public.raid_strokes enable row level security;

drop policy if exists raids_select on public.raids;
create policy raids_select on public.raids for select using (public.is_police_authorized());
drop policy if exists raid_strokes_select on public.raid_strokes;
create policy raid_strokes_select on public.raid_strokes for select using (public.is_police_authorized());
-- Sin policies de insert/update/delete: solo las funciones de abajo escriben.

create or replace function public.create_raid(p_title text, p_notes text default '')
returns setof public.raids
language plpgsql security definer set search_path = public as $$
declare
  v_callsign text;
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;
  select callsign into v_callsign from public.police_users where profile_id = auth.uid();
  return query
    insert into public.raids (title, notes, created_by, callsign)
    values (p_title, coalesce(p_notes, ''), auth.uid(), coalesce(v_callsign, 'Desconocido'))
    returning *;
end;
$$;

create or replace function public.update_raid_notes(p_raid_id uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;
  update public.raids set notes = p_notes, updated_at = now() where id = p_raid_id;
end;
$$;

create or replace function public.delete_raid(p_raid_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;
  delete from public.raids where id = p_raid_id;
end;
$$;

create or replace function public.add_raid_stroke(p_raid_id uuid, p_points jsonb, p_color text default '#ef4444')
returns setof public.raid_strokes
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;
  if not exists (select 1 from public.raids where id = p_raid_id) then
    raise exception 'Redada no encontrada';
  end if;
  return query
    insert into public.raid_strokes (raid_id, points, color, created_by)
    values (p_raid_id, p_points, coalesce(p_color, '#ef4444'), auth.uid())
    returning *;
end;
$$;

create or replace function public.clear_raid_strokes(p_raid_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_police_authorized() then
    raise exception 'No autorizado';
  end if;
  delete from public.raid_strokes where raid_id = p_raid_id;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'raids'
     )
  then
    alter publication supabase_realtime add table public.raids;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'raid_strokes'
     )
  then
    alter publication supabase_realtime add table public.raid_strokes;
  end if;
end $$;
