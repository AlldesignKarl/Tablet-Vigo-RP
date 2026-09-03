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
