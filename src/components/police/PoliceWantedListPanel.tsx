'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Siren, Car, Search, RotateCw, UserCheck } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import type { Database } from '@/types/database';

type WantedRow = Database['public']['Views']['wanted_active_view']['Row'];

export default function PoliceWantedListPanel({ wanted }: { wanted: WantedRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return wanted;
    return wanted.filter((w) =>
      [w.first_name, w.last_name, w.dni_number, w.reason, w.vehicle_plate ?? ''].join(' ').toLowerCase().includes(q),
    );
  }, [wanted, query]);

  function refresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <div className="space-y-4">
      <div className="hud-panel space-y-4 border-t-2 border-t-danger-500/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-danger-500/40 bg-danger-500/10 text-danger-500">
              <Siren className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-lg font-bold uppercase tracking-wide text-white">Requisitorias activas y búsquedas en vigor</h1>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Registro central de órdenes judiciales de captura · Cuerpo Nacional de Policía
              </p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-danger-500/40 bg-danger-500/10 px-3 py-1.5 text-xs font-bold text-danger-500">
            <span className="h-1.5 w-1.5 rounded-full bg-danger-500" />
            {wanted.length} EN BUSCA
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={1.75} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar por ciudadano, DNI, motivo o matrícula..."
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-danger-500/50"
            />
          </div>
          <button
            onClick={refresh}
            className="no-glow flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-accent-500/40 hover:text-white"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            Refrescar lista
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-14 text-center">
            <UserCheck className="h-10 w-10 text-success-500" strokeWidth={1.5} />
            <p className="text-sm font-bold uppercase tracking-wide text-white">
              {wanted.length === 0 ? 'Sin órdenes de búsqueda vigentes' : 'Sin resultados'}
            </p>
            <p className="max-w-sm text-xs text-slate-500">
              {wanted.length === 0
                ? 'No hay ciudadanos registrados en situación de búsqueda y captura en esta jurisdicción.'
                : 'Ningún registro coincide con ese filtro.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((w) => (
              <Link
                key={w.id}
                href={`/tablet/policia/perfil/${w.citizen_id}`}
                className="hud-panel flex items-center gap-3 p-4 transition hover:border-danger-500/40"
              >
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-danger-500/40 bg-base-700">
                  {w.roblox_avatar_url ? (
                    <Image src={w.roblox_avatar_url} alt={w.first_name} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg">👤</div>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">
                    {w.first_name} {w.last_name}
                  </p>
                  <p className="font-mono text-xs text-slate-500">{w.dni_number}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{w.reason}</p>
                </div>
                {w.vehicle_plate && (
                  <span className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-xs font-bold text-white">
                    <Car className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {w.vehicle_plate}
                  </span>
                )}
                <span className="shrink-0 text-[10px] text-slate-500">{formatDateTime(w.created_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
