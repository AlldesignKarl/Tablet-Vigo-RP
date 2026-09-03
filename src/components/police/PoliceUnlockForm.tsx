'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

const DIGITS = 6;
const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

export default function PoliceUnlockForm() {
  const router = useRouter();
  const { push } = useToast();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [code, setCode] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  async function requestCode() {
    setRequesting(true);
    setError(null);
    try {
      const res = await fetch('/api/police/request-code', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'No se pudo solicitar el código.');
        return;
      }
      push({
        kind: 'success',
        title: 'Código enviado',
        message: 'Se ha enviado un código de un solo uso al administrador. Pídeselo para continuar.',
      });
      setStep('verify');
    } finally {
      setRequesting(false);
    }
  }

  function press(key: string) {
    if (verifying) return;
    setError(null);
    if (key === 'clear') return setCode('');
    if (key === 'back') return setCode((c) => c.slice(0, -1));
    setCode((c) => (c.length >= DIGITS ? c : c + key));
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.length !== DIGITS || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/police/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Código incorrecto');
        setShake(true);
        setCode('');
        setTimeout(() => setShake(false), 500);
        return;
      }
      push({ kind: 'success', title: 'Acceso concedido', message: 'Bienvenido al panel policial.' });
      router.refresh();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="relative overflow-hidden rounded-2xl border border-police-500/30 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.16),transparent_60%)] bg-base-900 shadow-hud">
        <div className="flex items-center gap-2 border-b border-police-500/20 bg-police-500/10 px-4 py-2.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-police-glow shadow-[0_0_8px_theme(colors.police.glow)]" />
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-police-glow">
            Terminal de acceso · Cuerpo de Policía
          </p>
        </div>

        {step === 'request' ? (
          <div className="flex flex-col items-center gap-5 px-6 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-police-500/40 bg-police-500/10 text-3xl shadow-[0_0_24px_rgba(59,130,246,0.25)]">
              👮
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-white">Acceso restringido</h1>
              <p className="mt-2 text-xs text-slate-400">
                Se generará un código de un solo uso que se enviará por email al administrador del
                servidor. Pídeselo para poder introducirlo aquí.
              </p>
            </div>

            {error && <p className="text-xs font-medium text-danger-500">{error}</p>}

            <button
              type="button"
              onClick={requestCode}
              disabled={requesting}
              className="w-full rounded-xl bg-police-500 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {requesting ? 'Enviando…' : 'Solicitar código de acceso'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6 px-6 py-8">
            <p className="text-center text-xs text-slate-400">
              Introduce el código de 6 dígitos que te ha dado el administrador.
            </p>

            <div className={`flex flex-wrap items-center justify-center gap-2 ${shake ? 'animate-[shake_0.4s]' : ''}`}>
              {Array.from({ length: DIGITS }).map((_, i) => (
                <span
                  key={i}
                  className={`flex h-11 w-9 items-center justify-center rounded-lg border text-lg font-bold text-white transition ${
                    i < code.length
                      ? 'border-police-500/60 bg-police-500/15 shadow-[0_0_12px_rgba(59,130,246,0.35)]'
                      : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  {i < code.length ? '●' : ''}
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
                      : 'border border-white/10 bg-white/[0.04] text-white hover:border-police-500/50'
                  }`}
                >
                  {key === 'clear' ? 'C' : key === 'back' ? '⌫' : key}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={verifying || code.length !== DIGITS}
              className="w-full rounded-xl bg-police-500 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {verifying ? 'Verificando…' : 'Desbloquear acceso'}
            </button>

            <button
              type="button"
              onClick={requestCode}
              disabled={requesting}
              className="no-glow text-xs font-medium text-slate-500 underline decoration-dotted underline-offset-4 hover:text-slate-300"
            >
              {requesting ? 'Enviando…' : 'Pedir un código nuevo'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
