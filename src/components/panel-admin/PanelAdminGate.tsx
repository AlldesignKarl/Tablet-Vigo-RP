'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import PanelAdminContent from './PanelAdminContent';

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

interface Job {
  id: string;
  code: string;
  name: string;
  salary_cents: number;
}

// La contraseña correcta solo se sabe con certeza tras verificarla en el
// servidor; una vez comprobada se guarda en memoria (nunca en
// localStorage/sessionStorage) para poder reenviarla en cada acción del
// panel, que también la vuelve a comprobar server-side.
export default function PanelAdminGate({ jobs, initialTheme }: { jobs: Job[]; initialTheme: 'dark' | 'light' }) {
  const [password, setPassword] = useState<string | null>(null);
  const [entry, setEntry] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  function press(key: string) {
    if (verifying) return;
    setError(null);
    if (key === 'clear') return setEntry('');
    if (key === 'back') return setEntry((c) => c.slice(0, -1));
    setEntry((c) => (c.length >= 12 ? c : c + key));
  }

  async function unlock(e?: React.FormEvent) {
    e?.preventDefault();
    if (!entry || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/panel-admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: entry }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.data?.correct) {
        setError((!res.ok || !json.ok ? json.error : null) ?? 'Contraseña incorrecta.');
        setShake(true);
        setEntry('');
        setTimeout(() => setShake(false), 500);
        return;
      }
      setPassword(entry);
    } finally {
      setVerifying(false);
    }
  }

  if (password) {
    return <PanelAdminContent password={password} jobs={jobs} initialTheme={initialTheme} onLock={() => setPassword(null)} />;
  }

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-sm items-center justify-center">
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.16),transparent_60%)] bg-base-900 shadow-hud">
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
          <Lock className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">Panel Admin</p>
        </div>
        <form onSubmit={unlock} className="flex flex-col items-center gap-6 px-6 py-8">
          <p className="text-center text-xs text-slate-400">Introduce la contraseña numérica del Panel Admin.</p>

          <div className={`flex flex-wrap items-center justify-center gap-2 ${shake ? 'animate-[shake_0.4s]' : ''}`}>
            {Array.from({ length: Math.max(entry.length, 4) }).map((_, i) => (
              <span
                key={i}
                className={`flex h-11 w-9 items-center justify-center rounded-lg border text-lg font-bold text-white transition ${
                  i < entry.length
                    ? 'border-accent-500/60 bg-accent-500/15 shadow-[0_0_12px_rgba(59,130,246,0.35)]'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                {i < entry.length ? '●' : ''}
              </span>
            ))}
          </div>

          {error && <p className="-mt-2 text-xs font-medium text-danger-500">{error}</p>}

          <div className="grid grid-cols-3 gap-2.5">
            {KEYPAD.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                disabled={verifying}
                className={`flex h-12 w-16 items-center justify-center rounded-xl text-base font-semibold transition disabled:opacity-40 ${
                  key === 'clear' || key === 'back'
                    ? 'border border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
                    : 'border border-white/10 bg-white/[0.04] text-white hover:border-accent-500/50'
                }`}
              >
                {key === 'clear' ? 'C' : key === 'back' ? '⌫' : key}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={verifying || !entry}
            className="w-full rounded-xl bg-accent-600 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {verifying ? 'Comprobando…' : 'Desbloquear'}
          </button>
        </form>
      </div>
    </div>
  );
}
