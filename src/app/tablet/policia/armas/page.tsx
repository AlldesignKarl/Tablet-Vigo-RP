import { createServerSupabaseClient } from '@/lib/supabase/server';
import PoliceWeaponsPanel from '@/components/police/PoliceWeaponsPanel';
import type { Database } from '@/types/database';

export default async function PoliceArmasPage() {
  const supabase = createServerSupabaseClient();

  // Envuelto en try/catch a propósito: si la función todavía no existe
  // en la base de datos (falta aplicar una migración reciente) esto no
  // debe tumbar la página, solo dejar la lista vacía.
  let weapons: Database['public']['Functions']['police_list_weapons']['Returns'] = [];
  try {
    const { data } = await supabase.rpc('police_list_weapons');
    if (data) weapons = data;
  } catch (err) {
    console.error('[armas] no se pudo cargar el listado de armas registradas', err);
  }

  return <PoliceWeaponsPanel weapons={weapons} />;
}
