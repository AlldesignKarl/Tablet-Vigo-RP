-- =====================================================================
-- Arreglo puntual: fuerza el código policial a 1212, borra bloqueos por
-- intentos fallidos anteriores, y añade las licencias de armas +
-- equipamiento nuevos si esta base de datos aún no los tenía (idempotente,
-- se puede ejecutar varias veces sin problema).
-- =====================================================================

-- 1) El código de acceso policial vuelve a ser exactamente "1212"
update public.app_config
set value = jsonb_set(value, '{police_code_hash}', to_jsonb(crypt('1212', gen_salt('bf'))))
where key = 'security';

insert into public.app_config (key, value)
values ('security', jsonb_build_object('police_code_hash', crypt('1212', gen_salt('bf'))))
on conflict (key) do nothing;

-- 2) Borra cualquier bloqueo por intentos fallidos (máx. 5 cada 5 min)
delete from public.rate_limits where key like 'police_code:%';

-- 3) Licencias de armas específicas por modelo + equipamiento de la tienda
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
