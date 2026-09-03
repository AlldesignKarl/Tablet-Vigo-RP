import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { publicEnv, serverEnv, assertServerOnly } from '@/lib/env';

/**
 * Cliente con la Service Role Key. IGNORA RLS por completo.
 *
 * Reglas de uso (muy importante para la seguridad del proyecto):
 *  - Nunca importar este archivo desde un componente de cliente.
 *  - Solo usar para: (a) el cron de sueldos, (b) el proxy de Roblox
 *    (no toca datos de usuario) y (c) tareas administrativas donde ya
 *    se ha verificado el rol admin manualmente contra la sesión real.
 *  - Para todo lo demás, usa createServerSupabaseClient() y deja que
 *    RLS + las funciones SECURITY DEFINER hagan su trabajo.
 */
export function createAdminSupabaseClient() {
  assertServerOnly();
  if (!serverEnv.supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada.');
  }
  return createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
