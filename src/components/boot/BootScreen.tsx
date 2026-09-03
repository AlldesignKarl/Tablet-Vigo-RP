'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function BootScreen() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1900);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-base-950">
      <div className="grid-overlay absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-accent-500/20 blur-[120px]" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-accent-500/40 bg-accent-500/10 shadow-glow animate-bootPulse">
          <span className="text-3xl">🛡️</span>
        </div>

        <div>
          <h1 className="font-display text-4xl font-bold tracking-[0.35em] text-white sm:text-5xl">VIGO RP</h1>
          <p className="mt-3 font-mono text-xs tracking-[0.5em] text-accent-400 sm:text-sm">
            SISTEMA ADMINISTRATIVO
          </p>
        </div>

        <div className="mt-4 h-px w-56 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-full origin-left animate-[bootPulse_1.9s_ease-in-out] bg-gradient-to-r from-transparent via-accent-400 to-transparent" />
        </div>

        <div
          className={`mt-6 flex flex-col items-center gap-3 transition-opacity duration-700 ${
            ready ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <p className="max-w-xs text-sm text-slate-400">
            Tablet oficial de administración y policía de Spanish Vigo Roleplay.
          </p>
          <Link
            href="/login"
            className="rounded-xl border border-accent-500/50 bg-accent-500/15 px-8 py-3 text-sm font-semibold tracking-wide text-accent-400 transition hover:bg-accent-500/25"
          >
            INICIAR SESIÓN
          </Link>
        </div>
      </div>
    </main>
  );
}
