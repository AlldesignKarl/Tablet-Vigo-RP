'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Database } from '@/types/database';
import type { CitizenProfile } from '@/lib/data/citizen';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
interface PlateResult {
  vehicle: Vehicle;
  owner: CitizenProfile | null;
}

export default function SearchPlatePanel() {
  const [plate, setPlate] = useState('');
  const [results, setResults] = useState<PlateResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (plate.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch('/api/police/search-plate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate }),
      });
      const json = await res.json();
      setResults(res.ok && json.ok ? json.data : []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">🚘 Buscar matrícula</h1>

      <form onSubmit={handleSearch} className="hud-panel flex flex-col gap-3 p-5 sm:flex-row">
        <input
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="Ej. 1234-ABC"
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm uppercase text-white outline-none focus:border-accent-500/60"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-500 disabled:opacity-50"
        >
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {searched && !loading && results.length === 0 && (
        <p className="text-sm text-slate-500">No se han encontrado vehículos con esa matrícula.</p>
      )}

      <div className="space-y-3">
        {results.map(({ vehicle, owner }) => (
          <div key={vehicle.id} className="hud-panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-sm font-bold text-white">
                  {vehicle.plate}
                </span>
                {vehicle.impounded && (
                  <span className="rounded-full bg-danger-500/20 px-2 py-0.5 text-[10px] font-semibold text-danger-500">
                    INCAUTADO
                  </span>
                )}
                <span className={vehicle.insured ? 'text-xs text-success-500' : 'text-xs text-slate-500'}>
                  {vehicle.insured ? '✓ Asegurado' : 'Sin seguro'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-300">
                {vehicle.brand} {vehicle.model} · {vehicle.color}
              </p>
              {owner && (
                <p className="text-xs text-slate-500">
                  Propietario: {owner.first_name} {owner.last_name} ({owner.dni_number})
                </p>
              )}
            </div>
            {owner && (
              <Link
                href={`/tablet/policia/perfil/${owner.profile_id}`}
                className="rounded-lg border border-accent-500/40 bg-accent-500/10 px-3 py-1.5 text-xs font-medium text-accent-400 transition hover:bg-accent-500/20"
              >
                Ver propietario
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
