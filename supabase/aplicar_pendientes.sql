-- =====================================================================
-- Aplica en tu base de datos ya existente lo último añadido: el sistema
-- de acceso policial por email + las licencias de armas y el equipamiento
-- nuevos de la tienda. Es idempotente: se puede ejecutar varias veces sin
-- problema, incluso si ya se había aplicado parte de esto antes.
-- =====================================================================

-- Archivo: supabase/migrations/0009_police_access_codes.sql
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

-- Archivo: supabase/migrations/0008_shop_weapons.sql
-- =====================================================================
-- Licencias de armas específicas por modelo + equipamiento en la tienda
-- =====================================================================
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

-- Archivo: supabase/migrations/0010_shop_more_items.sql
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

-- Archivo: supabase/migrations/0011_fix_pgcrypto_schema.sql
-- =====================================================================
-- Arregla "function gen_salt(unknown) does not exist" / "function crypt(...)
-- does not exist"
-- =====================================================================
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

-- Archivo: supabase/migrations/0012_complaints.sql
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
