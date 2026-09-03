'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { CitizenProfile } from '@/lib/data/citizen';

export default function SearchCitizenPanel() {
  const [query, setQuery] = useState('');
  const [by, setBy] = useState<'nombre' | 'dni' | 'roblox'>('nombre');
  const [results, setResults] = useState<CitizenProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch('/api/police/search-citizen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, by }),
      });
      const json = await res.json();
      setResults(res.ok && json.ok ? json.data : []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">🔎 Buscar persona</h1>

      <form onSubmit={handleSearch} className="hud-panel flex flex-col gap-3 p-5 sm:flex-row">
        <select
          value={by}
          onChange={(e) => setBy(e.target.value as typeof by)}
          className="rounded-lg border border-white/10 bg-base-800 px-3 py-2.5 text-sm text-white outline-none"
        >
          <option value="nombre">Nombre / apellidos</option>
          <option value="dni">Nº de DNI</option>
          <option value="roblox">Usuario Roblox</option>
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Introduce el término de búsqueda…"
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-accent-500/60"
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
        <p className="text-sm text-slate-500">No se han encontrado resultados.</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {results.map((r) => (
          <Link
            key={r.profile_id}
            href={`/tablet/policia/perfil/${r.profile_id}`}
            className="hud-panel flex items-center gap-3 p-4 transition hover:border-accent-500/40"
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-base-700">
              {r.roblox_avatar_url && (
                <Image src={r.roblox_avatar_url} alt={r.first_name} fill className="object-cover" unoptimized />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">
                {r.first_name} {r.last_name}
              </p>
              <p className="text-xs text-slate-500">
                {r.dni_number} · @{r.roblox_username}
              </p>
            </div>
            {r.is_wanted && <span className="text-lg">🚨</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
