'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const ONLINE_THRESHOLD_MS = 90_000;
const POLL_MS = 15_000;

function isRecentlySeen(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

// Se comprueba cada pocos segundos (no basta con calcularlo una vez al
// cargar la página): un agente puede tener el expediente abierto un buen
// rato, y el ciudadano puede conectarse o desconectarse mientras tanto.
export default function OnlineStatusBadge({
  profileId,
  initialLastSeenAt,
}: {
  profileId: string;
  initialLastSeenAt: string | null;
}) {
  const [lastSeenAt, setLastSeenAt] = useState(initialLastSeenAt);
  const [online, setOnline] = useState(() => isRecentlySeen(initialLastSeenAt));

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const supabase = createClient();
        const { data } = await supabase.from('profiles').select('last_seen_at').eq('id', profileId).maybeSingle();
        if (!cancelled) {
          setLastSeenAt(data?.last_seen_at ?? null);
        }
      } catch (err) {
        console.error('[online-status] fallo comprobando conexión (se reintentará)', err);
      }
    }

    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [profileId]);

  useEffect(() => {
    setOnline(isRecentlySeen(lastSeenAt));
    // Vuelve a comprobar el umbral aunque no llegue ningún dato nuevo:
    // el tiempo pasa igual y puede hacer que pase a "no está en línea".
    const id = setInterval(() => setOnline(isRecentlySeen(lastSeenAt)), 5000);
    return () => clearInterval(id);
  }, [lastSeenAt]);

  if (online) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-success-500/40 bg-success-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-success-500">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-500" />
        En línea en la tablet
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 rounded-full border border-danger-500/40 bg-danger-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-danger-500">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger-500" />
      No está en línea
    </span>
  );
}
