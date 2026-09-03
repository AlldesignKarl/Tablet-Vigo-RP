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
