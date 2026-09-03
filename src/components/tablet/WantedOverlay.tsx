'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Efecto visual cuando la policía pone a este ciudadano en busca y
// captura: luces azules fuertes parpadeando por toda la tablet, como si
// le persiguiera un coche patrulla. Es solo visual (pointer-events-none)
// para que se siga viendo y pudiendo usar todo debajo. Se activa/desactiva
// en tiempo real: no hace falta recargar la página cuando un agente lo
// marca o se lo quita.
export default function WantedOverlay({ profileId, initialWanted }: { profileId: string; initialWanted: boolean }) {
  const [wanted, setWanted] = useState(initialWanted);

  useEffect(() => {
    if (!profileId) return;
    let supabase: ReturnType<typeof createClient>;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      supabase = createClient();
      channel = supabase
        .channel(`wanted-${profileId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'wanted_persons', filter: `citizen_id=eq.${profileId}` },
          (payload) => {
            try {
              const row = payload.new as { active: boolean };
              if (row.active) setWanted(true);
            } catch (err) {
              console.error('[wanted-overlay] fallo procesando INSERT', err);
            }
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'wanted_persons', filter: `citizen_id=eq.${profileId}` },
          (payload) => {
            try {
              const row = payload.new as { active: boolean };
              setWanted(Boolean(row.active));
            } catch (err) {
              console.error('[wanted-overlay] fallo procesando UPDATE', err);
            }
          },
        )
        .subscribe();
    } catch (err) {
      console.error('[wanted-overlay] no se pudo activar el aviso en vivo (no afecta al resto de la tablet)', err);
    }

    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {
        // Ignorar: la tablet no debe romperse por un fallo al desconectar.
      }
    };
  }, [profileId]);

  // Comprobación periódica además del realtime: así el efecto aparece y
  // desaparece de forma fiable aunque el "postgres_changes" no llegue
  // (redes raras, reconexión, etc.) sin depender solo de la conexión en
  // directo ni de recargar la página.
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    async function poll() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('wanted_persons')
          .select('active')
          .eq('citizen_id', profileId)
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        if (!cancelled) setWanted(Boolean(data));
      } catch (err) {
        console.error('[wanted-overlay] fallo comprobando estado (se reintentará)', err);
      }
    }

    const id = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [profileId]);

  if (!wanted) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]" aria-hidden="true">
      <div className="absolute inset-0 animate-[wanted-ring_1.1s_ease-in-out_infinite] rounded-none sm:rounded-[1.75rem]" />
      <div className="absolute inset-0 bg-blue-500 mix-blend-screen [animation:wanted-strobe-a_1.1s_linear_infinite]" />
      <div className="absolute inset-0 bg-sky-400 mix-blend-screen [animation:wanted-strobe-b_1.1s_linear_infinite]" />
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-full border border-blue-300/60 bg-blue-950/80 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-200 shadow-[0_0_30px_rgba(59,130,246,0.8)] [animation:pulse-glow_1.1s_ease-in-out_infinite]">
        <AlertTriangle className="h-4 w-4" strokeWidth={2} />
        Busca y captura
      </div>
    </div>
  );
}
