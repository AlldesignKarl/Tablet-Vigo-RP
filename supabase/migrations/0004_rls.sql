-- =====================================================================
-- Row Level Security
-- =====================================================================
-- Regla general: los ciudadanos solo ven/tocan sus propios datos.
-- Las escrituras sensibles (dinero, acciones policiales) NO tienen
-- policy de INSERT/UPDATE para el rol authenticated: solo pueden
-- ejecutarse a través de las funciones SECURITY DEFINER de 0002, que
-- validan permisos en servidor y se ejecutan como el propietario
-- (bypassa RLS de forma controlada y auditada).
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
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_police_authorized() or public.is_admin());

-- discord_links ---------------------------------------------------------
create policy discord_links_select on public.discord_links for select
  using (profile_id = auth.uid() or public.is_admin());

-- dnis ------------------------------------------------------------------
create policy dnis_select on public.dnis for select
  using (profile_id = auth.uid() or public.is_police_authorized() or public.is_admin());

create policy dnis_insert on public.dnis for insert
  with check (profile_id = auth.uid() and not exists (select 1 from public.dnis d2 where d2.profile_id = auth.uid()));

-- jobs (catálogo público de solo lectura, administrable por admin) ------
create policy jobs_select on public.jobs for select using (true);
create policy jobs_admin_write on public.jobs for all using (public.is_admin()) with check (public.is_admin());

-- bank_accounts -----------------------------------------------------------
create policy bank_accounts_select on public.bank_accounts for select
  using (profile_id = auth.uid() or public.is_admin());
create policy bank_accounts_admin_write on public.bank_accounts for update
  using (public.is_admin()) with check (public.is_admin());

-- bank_transactions ---------------------------------------------------------
create policy bank_transactions_select on public.bank_transactions for select
  using (profile_id = auth.uid() or public.is_admin());

-- license_types (catálogo) --------------------------------------------------
create policy license_types_select on public.license_types for select using (true);
create policy license_types_admin_write on public.license_types for all
  using (public.is_admin()) with check (public.is_admin());

-- licenses --------------------------------------------------------------
create policy licenses_select on public.licenses for select
  using (profile_id = auth.uid() or public.is_police_authorized() or public.is_admin());

-- shop_products / shop_purchases ----------------------------------------
create policy shop_products_select on public.shop_products for select using (true);
create policy shop_products_admin_write on public.shop_products for all
  using (public.is_admin()) with check (public.is_admin());
create policy shop_purchases_select on public.shop_purchases for select
  using (profile_id = auth.uid() or public.is_admin());

-- vehicles ----------------------------------------------------------------
create policy vehicles_select on public.vehicles for select
  using (profile_id = auth.uid() or public.is_police_authorized() or public.is_admin());
create policy vehicles_admin_write on public.vehicles for update
  using (public.is_admin()) with check (public.is_admin());

-- police_users --------------------------------------------------------------
create policy police_users_select on public.police_users for select
  using (profile_id = auth.uid() or public.is_police_authorized() or public.is_admin());
create policy police_users_admin_write on public.police_users for all
  using (public.is_admin()) with check (public.is_admin());

-- arrests / fines / confiscations / points / wanted --------------------------
create policy arrests_select on public.arrests for select
  using (citizen_id = auth.uid() or public.is_police_authorized() or public.is_admin());

create policy fines_select on public.fines for select
  using (citizen_id = auth.uid() or public.is_police_authorized() or public.is_admin());

create policy confiscations_select on public.confiscations for select
  using (citizen_id = auth.uid() or public.is_police_authorized() or public.is_admin());

create policy vehicle_impounds_select on public.vehicle_impounds for select
  using (
    public.is_police_authorized() or public.is_admin()
    or exists (select 1 from public.vehicles v where v.id = vehicle_impounds.vehicle_id and v.profile_id = auth.uid())
  );

create policy points_history_select on public.license_points_history for select
  using (citizen_id = auth.uid() or public.is_police_authorized() or public.is_admin());

create policy wanted_persons_select on public.wanted_persons for select
  using (citizen_id = auth.uid() or public.is_police_authorized() or public.is_admin());

-- radio_messages ------------------------------------------------------------
create policy radio_messages_select on public.radio_messages for select
  using (public.is_police_authorized() or public.is_admin());
create policy radio_messages_insert on public.radio_messages for insert
  with check (sender_id = auth.uid() and (public.is_police_authorized() or public.is_admin()));

-- app_config ------------------------------------------------------------------
create policy app_config_admin_only on public.app_config for select using (public.is_admin());
create policy app_config_admin_write on public.app_config for all
  using (public.is_admin()) with check (public.is_admin());

-- audit_logs --------------------------------------------------------------------
create policy audit_logs_admin_select on public.audit_logs for select using (public.is_admin());
-- Sin policies de insert/update/delete para clientes: solo write_audit_log() (definer) puede escribir,
-- y nadie puede editar/borrar jamás, ni siquiera un admin desde la API.

-- rate_limits: sin policies para clientes (solo accesible via función definer)
