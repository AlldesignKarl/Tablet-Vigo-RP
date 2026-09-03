-- =====================================================================
-- Sueldo de "Desempleado" (rango civil, sin trabajo): 400€ cada 48h.
-- Es idempotente: se puede ejecutar varias veces sin problema.
-- =====================================================================
update public.jobs set salary_cents = 40000 where code = 'desempleado';
