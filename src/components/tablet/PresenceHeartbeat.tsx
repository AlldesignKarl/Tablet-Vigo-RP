'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const HEARTBEAT_MS = 30_000;

// Avisa cada 30s de que este ciudadano sigue con la tablet abierta, para
// que la policía pueda ver quién está conectado ahora mismo (y si una
// persona concreta lo está o no en su expediente). No renderiza nada.
export default function PresenceHeartbeat() {
  useEffect(() => {
    let cancelled = false;

    async function ping() {
      try {
        const supabase = createClient();
        await supabase.rpc('touch_presence');
      } catch (err) {
        console.error('[presencia] fallo al avisar de que sigo conectado (se reintentará)', err);
      }
    }

    if (!cancelled) ping();
    const id = setInterval(ping, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return null;
}
