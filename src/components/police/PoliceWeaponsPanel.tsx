'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, Search, RotateCw, PackageSearch } from 'lucide-react';
import { formatDate, centsToEuros } from '@/lib/format';
import type { Database } from '@/types/database';

type Weapon = Database['public']['Functions']['police_list_weapons']['Returns'][number];

export default function PoliceWeaponsPanel({ weapons }: { weapons: Weapon[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return weapons;
    return weapons.filter((w) =>
      [w.weapon_model, w.serial_number, w.first_name, w.last_name, w.dni_number].join(' ').toLowerCase().includes(q),
    );
  }, [weapons, query]);

  function refresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-police-500/40 bg-police-500/10 text-police-glow">
          <ShieldAlert className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-white">Armas registradas</h1>
          <p className="text-xs text-slate-500">Todas las armas dadas de alta en el sistema, con su número de serie y propietario.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por modelo, nº de serie, nombre o DNI..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-accent-500/50"
          />
        </div>
        <button
          onClick={refresh}
          className="no-glow flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-accent-500/40 hover:text-white"
        >
          <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.75} />
          Refrescar
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="hud-panel flex flex-col items-center justify-center gap-2 border-dashed py-14 text-center">
          <PackageSearch className="h-10 w-10 text-slate-600" strokeWidth={1.5} />
          <p className="text-sm font-bold uppercase tracking-wide text-white">
            {weapons.length === 0 ? 'Sin armas registradas' : 'Sin resultados'}
          </p>
          <p className="max-w-sm text-xs text-slate-500">
            {weapons.length === 0 ? 'Nadie ha comprado una licencia de armas todavía.' : 'Ningún registro coincide con ese filtro.'}
          </p>
        </div>
      ) : (
        <div className="hud-panel divide-y divide-white/5 overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-5 gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <span>Arma</span>
            <span>Nº de serie</span>
            <span>Propietario</span>
            <span>DNI</span>
            <span className="text-right">Precio pagado</span>
          </div>
          {filtered.map((w) => (
            <Link
              key={w.weapon_id}
              href={`/tablet/policia/perfil/${w.profile_id}`}
              className="grid min-w-[640px] grid-cols-5 items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/[0.03]"
            >
              <span className="font-semibold text-white">{w.weapon_model}</span>
              <span className="font-mono text-xs text-accent-400">{w.serial_number}</span>
              <span className="truncate text-slate-200">
                {w.first_name} {w.last_name}
              </span>
              <span className="font-mono text-xs text-slate-400">{w.dni_number}</span>
              <span className="text-right font-mono text-xs text-slate-300">{centsToEuros(w.price_cents)} €</span>
              <span className="col-span-5 text-[10px] text-slate-600">Registrada el {formatDate(w.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
