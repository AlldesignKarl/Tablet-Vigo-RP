import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { publicEnv } from '@/lib/env';

/**
 * Cliente Supabase para Server Components / Route Handlers / Server
 * Actions. Usa la clave anónima y respeta RLS según la sesión del
 * usuario autenticado (cookies). Es el cliente que debe usarse para
 * cualquier lectura/escritura que dependa de "quién soy".
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Se llama desde un Server Component sin permiso de escritura;
          // el middleware se encarga de refrescar la sesión en ese caso.
        }
      },
    },
  });
}
