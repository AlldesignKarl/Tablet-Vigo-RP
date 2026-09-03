'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

export default function PoliceUnlockForm() {
  const router = useRouter();
  const { push } = useToast();
  const [code, setCode] = useState('');
  const [callsign, setCallsign] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/police/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, callsign }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Código incorrecto');
        return;
      }
      push({ kind: 'success', title: 'Acceso concedido', message: 'Bienvenido al panel policial.' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="hud-panel p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-accent-500/40 bg-accent-500/10 text-2xl">
          👮
        </div>
        <h1 className="font-display text-lg font-bold text-white">Acceso restringido</h1>
        <p className="mt-2 text-sm text-slate-400">
          Introduce el código de autorización policial para acceder a esta sección.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3 text-left">
          <input
            required
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código de acceso"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-accent-500/60"
          />
          <input
            value={callsign}
            onChange={(e) => setCallsign(e.target.value)}
            placeholder="Indicativo (opcional, ej. Z-10)"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-accent-500/60"
          />
          {error && <p className="text-xs text-danger-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent-600 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-500 disabled:opacity-50"
          >
            {loading ? 'Verificando…' : 'Desbloquear'}
          </button>
        </form>
      </div>
    </div>
  );
}
