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
