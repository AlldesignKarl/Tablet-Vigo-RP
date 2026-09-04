'use client';

import { useEffect, useState } from 'react';
import { Wifi } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

type OnlineCitizen = Database['public']['Functions']['police_online_citizens']['Returns'][number];

const POLL_MS = 20_000;

export default function OnlineCitizensPanel({ initialCitizens }: { initialCitizens: OnlineCitizen[] }) {
  const [citizens, setCitizens] = useState<OnlineCitizen[]>(initialCitizens);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const supabase = createClient();
        const { data } = await supabase.rpc('police_online_citizens');
        if (!cancelled && data) setCitizens(data);
      } catch (err) {
        console.error('[conectados] fallo al refrescar la lista', err);
      }
    }

    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="hud-panel p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
        <span className="h-2 w-2 animate-pulse rounded-full bg-success-500" />
        Conectados ahora en la tablet ({citizens.length})
      </h2>
      {citizens.length === 0 ? (
        <p className="text-sm text-slate-500">Nadie más tiene la tablet abierta ahora mismo.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {citizens.map((c) => (
            <div key={c.profile_id} className="flex items-center gap-2 rounded-lg border border-success-500/20 bg-success-500/5 p-2.5 text-sm">
              <Wifi className="h-3.5 w-3.5 shrink-0 text-success-500" strokeWidth={2} />
              <span className="min-w-0 flex-1 truncate text-slate-200">
                {c.first_name} {c.last_name}
              </span>
              <span className="shrink-0 font-mono text-xs text-slate-500">{c.dni_number}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
