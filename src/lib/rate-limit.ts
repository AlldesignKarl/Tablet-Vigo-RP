import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { ApiError } from '@/lib/auth-helpers';

/**
 * Limitador de tasa respaldado por Postgres (tabla rate_limits +
 * función check_rate_limit, ver 0002_functions.sql). Es intencionadamente
 * simple (ventana fija) pero suficiente para frenar abuso básico de
 * endpoints sensibles sin depender de infraestructura externa (Redis).
 */
export async function enforceRateLimit(
  supabase: SupabaseClient<Database>,
  key: string,
  maxCount: number,
  windowSeconds: number,
) {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: key,
    p_max_count: maxCount,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    // Si el limitador falla por cualquier motivo, no bloqueamos la
    // petición (fail-open) para no tumbar la app por un problema de
    // infraestructura secundario, pero sí lo registramos.
    console.error('[rate-limit] error al comprobar límite', error);
    return;
  }

  if (!data) {
    throw new ApiError(429, 'Demasiadas peticiones. Inténtalo de nuevo en unos minutos.');
  }
}
