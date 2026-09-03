'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { publicEnv } from '@/lib/env';

// Un único cliente por pestaña del navegador. Antes cada componente que
// llamaba a createClient() creaba una instancia nueva de golpe; con el
// layout de /tablet montando un componente que vive toda la sesión
// (el efecto de busca y captura) además de la página de turno, eso deja
// varias instancias de GoTrueClient activas a la vez en la misma pestaña,
// algo que Supabase desaconseja explícitamente porque puede provocar
// fallos al competir por el mismo storage de sesión.
let client: SupabaseClient<Database> | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  }
  return client;
}
