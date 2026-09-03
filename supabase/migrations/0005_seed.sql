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

insert into public.jobs (code, name, salary_cents) values
  ('desempleado', 'Desempleado', 0),
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
