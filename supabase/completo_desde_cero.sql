-- ===================================================================
-- VIGO RP TABLET — Script completo (0001 a 0008), IDEMPOTENTE.
-- Puedes pegarlo y ejecutarlo tantas veces como quieras, sin importar
-- qué parte ya se hubiera aplicado antes.
-- ===================================================================

-- Archivo: supabase/migrations/0001_schema.sql
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

-- Archivo: supabase/migrations/0002_functions.sql
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

-- Archivo: supabase/migrations/0003_views.sql
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

-- Archivo: supabase/migrations/0004_rls.sql
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

-- Archivo: supabase/migrations/0005_seed.sql
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

-- Archivo: supabase/migrations/0006_realtime.sql
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

-- Archivo: supabase/migrations/0007_admin_functions.sql
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

-- Archivo: supabase/migrations/0008_shop_weapons.sql
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

