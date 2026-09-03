-- Sueldo de "Desempleado" (rango civil, sin trabajo): 400€ cada 48h.
update public.jobs set salary_cents = 40000 where code = 'desempleado';
