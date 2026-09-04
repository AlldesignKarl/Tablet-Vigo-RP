'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Crosshair, Plus, X, ChevronRight } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import Portal from '@/components/ui/Portal';
import type { Database } from '@/types/database';

type Raid = Database['public']['Tables']['raids']['Row'];

export default function RaidsListPanel({ initialRaids }: { initialRaids: Raid[] }) {
  const router = useRouter();
  const [raids, setRaids] = useState<Raid[]>(initialRaids);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRaid(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/police/redadas/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo crear la redada.');
        return;
      }
      const created = json.data as Raid;
      setRaids((prev) => [created, ...prev]);
      setTitle('');
      setShowForm(false);
      router.push(`/tablet/policia/redadas/${created.id}`);
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-police-500/40 bg-police-500/10 text-police-glow">
            <Crosshair className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-white">Redadas</h1>
            <p className="text-xs text-slate-500">Planifica operativos: escribe notas y dibuja sobre el mapa con el resto del cuerpo.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Nueva redada
        </button>
      </div>

      {raids.length === 0 && (
        <div className="hud-panel border-dashed p-8 text-center text-sm text-slate-500">Todavía no hay redadas planificadas.</div>
      )}

      <div className="space-y-2">
        {raids.map((r) => (
          <Link
            key={r.id}
            href={`/tablet/policia/redadas/${r.id}`}
            className="hud-panel flex items-center justify-between gap-3 p-4 transition hover:border-accent-500/30"
          >
            <div>
              <p className="font-semibold text-white">{r.title}</p>
              <p className="text-xs text-slate-500">
                {r.callsign} · {formatDateTime(r.created_at)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.75} />
          </Link>
        ))}
      </div>

      {showForm && (
        <Portal>
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowForm(false)}>
            <form
              onSubmit={createRaid}
              className="hud-panel w-full max-w-sm space-y-3 p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Nueva redada</h2>
                <button type="button" onClick={() => setShowForm(false)} className="no-glow text-slate-500 hover:text-white">
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título (ej. Redada en el puerto)"
                autoFocus
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
              />
              {error && <p className="text-xs font-medium text-danger-500">{error}</p>}
              <button
                type="submit"
                disabled={creating || !title.trim()}
                className="w-full rounded-xl bg-accent-600 py-2.5 text-sm font-bold text-white transition hover:bg-accent-500 disabled:opacity-50"
              >
                {creating ? 'Creando…' : 'Crear y abrir'}
              </button>
            </form>
          </div>
        </Portal>
      )}
    </div>
  );
}
