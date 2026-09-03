'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithDiscord() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    }
  }

  return (
    <main className="grid-overlay flex min-h-dvh items-center justify-center bg-base-950 px-4">
      <div className="hud-panel w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-accent-500/40 bg-accent-500/10 text-2xl">
          🛡️
        </div>
        <h1 className="font-display text-xl font-bold tracking-wide text-white">Acceso a la tablet</h1>
        <p className="mt-2 text-sm text-slate-400">
          Inicia sesión con tu cuenta de Discord de Vigo RP para continuar.
        </p>

        <button
          onClick={signInWithDiscord}
          disabled={loading}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4752c4] disabled:opacity-60"
        >
          {loading ? 'Conectando…' : 'Continuar con Discord'}
        </button>

        {error && <p className="mt-4 text-sm text-danger-500">{error}</p>}

        <p className="mt-6 text-xs text-slate-500">
          Al continuar aceptas que tus datos de ciudadano (DNI, banco, vehículos) queden asociados
          permanentemente a tu cuenta de Discord dentro de Vigo RP.
        </p>
      </div>
    </main>
  );
}
