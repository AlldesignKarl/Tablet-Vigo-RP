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
