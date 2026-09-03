'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileWarning, Hourglass, Eye, CircleCheck } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/components/ui/ToastProvider';
import type { Database } from '@/types/database';

type Complaint = Database['public']['Views']['complaints_view']['Row'];
type SearchResult = {
  profile_id: string;
  first_name: string;
  last_name: string;
  dni_number: string;
  roblox_avatar_url: string | null;
};

const STATUS_META: Record<Complaint['status'], { label: string; icon: typeof Hourglass; className: string }> = {
  pendiente: { label: 'Pendiente', icon: Hourglass, className: 'bg-yellow-500/15 text-yellow-500' },
  en_inspeccion: { label: 'En inspección', icon: Eye, className: 'bg-accent-500/15 text-accent-400' },
  cerrada: { label: 'Cerrada', icon: CircleCheck, className: 'bg-success-500/15 text-success-500' },
};

export default function DenunciasPanel({ myComplaints }: { myComplaints: Complaint[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [query, setQuery] = useState('');
  const [searchBy, setSearchBy] = useState<'nombre' | 'roblox'>('nombre');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [accused, setAccused] = useState<SearchResult | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) {
      push({ kind: 'error', title: 'Escribe al menos 2 letras para buscar' });
      return;
    }
    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch('/api/denuncias/search-citizen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, by: searchBy }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: 'error', title: 'No se pudo buscar', message: json.error });
        setResults([]);
        return;
      }
      setResults(json.data ?? []);
    } catch {
      push({ kind: 'error', title: 'No se pudo conectar con el servidor', message: 'Revisa tu conexión e inténtalo de nuevo.' });
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accused || reason.trim().length < 5) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/denuncias/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accusedId: accused.profile_id, reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: 'error', title: 'No se pudo registrar la denuncia', message: json.error });
        return;
      }
      push({ kind: 'success', title: 'Denuncia registrada', message: `Se ha registrado tu denuncia contra ${accused.first_name} ${accused.last_name}.` });
      setAccused(null);
      setReason('');
      setQuery('');
      setResults([]);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200">
          <FileWarning className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-white">Denuncias</h1>
          <p className="text-xs text-slate-500">Pon una denuncia contra otro ciudadano para que la revise la policía.</p>
        </div>
      </div>

      <div className="hud-panel space-y-4 p-5">
        <h2 className="font-semibold text-white">Nueva denuncia</h2>

        {!accused ? (
          <>
            <div className="flex gap-1.5">
              {(
                [
                  { value: 'nombre', label: 'Nombre y apellidos' },
                  { value: 'roblox', label: 'Usuario de Roblox' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSearchBy(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    searchBy === opt.value
                      ? 'bg-accent-500/20 text-accent-400'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchBy === 'roblox' ? 'Usuario de Roblox...' : 'Nombre y apellidos...'}
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-accent-500/60"
              />
              <button
                type="submit"
                disabled={searching}
                className="flex items-center gap-1.5 rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-500 disabled:opacity-50"
              >
                <Search className="h-4 w-4" strokeWidth={1.75} />
                {searching ? 'Buscando…' : 'Buscar'}
              </button>
            </form>

            {results.length > 0 ? (
              <div className="space-y-1.5">
                {results.map((r) => (
                  <button
                    key={r.profile_id}
                    onClick={() => setAccused(r)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-accent-500/40"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        {r.first_name} {r.last_name}
                      </p>
                      <p className="font-mono text-xs text-slate-500">DNI {r.dni_number}</p>
                    </div>
                    <span className="text-xs font-medium text-accent-400">Denunciar →</span>
                  </button>
                ))}
              </div>
            ) : (
              searched &&
              !searching && <p className="text-sm text-slate-500">No se ha encontrado a nadie con esos datos.</p>
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-accent-500/40 bg-accent-500/10 p-3">
              <div>
                <p className="text-xs text-slate-400">Vas a denunciar a:</p>
                <p className="text-sm font-semibold text-white">
                  {accused.first_name} {accused.last_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAccused(null)}
                className="no-glow text-xs font-medium text-slate-400 underline hover:text-white"
              >
                Cambiar
              </button>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo de la denuncia (qué ha pasado, dónde, etc.)"
              rows={4}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-accent-500/60"
            />
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 5}
              className="w-full rounded-lg bg-accent-600 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Enviando…' : 'Registrar denuncia'}
            </button>
          </form>
        )}
      </div>

      <div className="hud-panel p-5">
        <h2 className="mb-3 font-semibold text-white">Mis denuncias</h2>
        {myComplaints.length === 0 ? (
          <p className="text-sm text-slate-500">No has puesto ninguna denuncia todavía.</p>
        ) : (
          <div className="space-y-2">
            {myComplaints.map((c) => {
              const meta = STATUS_META[c.status];
              const StatusIcon = meta.icon;
              return (
                <div key={c.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-white">
                        Contra <span className="font-semibold">{c.accused_first_name} {c.accused_last_name}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{c.reason}</p>
                    </div>
                    <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${meta.className}`}>
                      <StatusIcon className="h-3 w-3" strokeWidth={2} />
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-500">{formatDateTime(c.created_at)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
