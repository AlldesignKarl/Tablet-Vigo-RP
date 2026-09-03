'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
  ]);
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter() {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Al llegar aquí nunca hay ya una sesión válida: la página de inicio
      // y el middleware solo mandan a /login cuando no la hay. Creamos una
      // sesión anónima directamente, sin llamadas previas innecesarias.
      const { error: signInError } = await withTimeout(supabase.auth.signInAnonymously(), 10000);

      if (signInError) {
        console.error('[login] signInAnonymously error', signInError);
        if (signInError.message.toLowerCase().includes('anonymous')) {
          setError(
            'El acceso está mal configurado: hay que activar "Allow anonymous sign-ins" en Supabase (Authentication → Sign In / Providers).',
          );
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      const next = searchParams.get('next') ?? '/';
      router.push(next);
      router.refresh();
    } catch (err) {
      console.error('[login] unexpected error', err);
      const timedOut = err instanceof Error && err.message === 'TIMEOUT';
      setError(
        timedOut
          ? 'El servidor de Supabase no responde. Comprueba que el proyecto esté activo e inténtalo de nuevo.'
          : 'No se pudo conectar. Comprueba tu conexión a internet e inténtalo de nuevo.',
      );
      setLoading(false);
    }
  }

  return (
    <div className="hud-panel w-full max-w-sm p-8 text-center">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-accent-500/40 bg-accent-500/10 text-2xl">
        🛡️
      </div>
      <h1 className="font-display text-xl font-bold tracking-wide text-white">Acceso a la tablet</h1>
      <p className="mt-2 text-sm text-slate-400">
        Entra en la tablet de Vigo RP. Si es tu primera vez, se te pedirá crear tu DNI a continuación.
      </p>

      <button
        onClick={enter}
        disabled={loading}
        className="mt-8 w-full rounded-xl bg-accent-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-500 disabled:opacity-60"
      >
        {loading ? 'Entrando…' : 'Entrar en la tablet'}
      </button>

      {error && <p className="mt-4 text-sm text-danger-500">{error}</p>}

      <p className="mt-6 text-xs text-slate-500">
        Tus datos (DNI, banco, vehículos) quedan guardados permanentemente y ligados a este
        navegador. No cierres sesión ni borres los datos del sitio, o perderás el acceso a tu
        personaje.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="grid-overlay flex min-h-dvh items-center justify-center bg-base-950 px-4">
      <Suspense fallback={null}>
        <LoginContent />
      </Suspense>
    </main>
  );
}
