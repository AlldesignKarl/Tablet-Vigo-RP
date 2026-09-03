'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/components/ui/ToastProvider';

interface RobloxPreview {
  userId: number;
  username: string;
  avatarUrl: string | null;
}

export default function OnboardingForm() {
  const router = useRouter();
  const { push } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [robloxUsername, setRobloxUsername] = useState('');

  const [preview, setPreview] = useState<RobloxPreview | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [robloxError, setRobloxError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function verifyRoblox() {
    if (robloxUsername.trim().length < 3) return;
    setVerifying(true);
    setRobloxError(null);
    setPreview(null);
    try {
      const res = await fetch('/api/roblox/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: robloxUsername.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setRobloxError(json.error ?? 'Usuario de Roblox no encontrado');
        return;
      }
      setPreview(json.data);
    } catch {
      setRobloxError('No se pudo contactar con Roblox. Inténtalo de nuevo.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!preview) {
      setRobloxError('Verifica tu usuario de Roblox antes de continuar.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/dni/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, birthDate, robloxUsername }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: 'error', title: 'No se pudo crear el DNI', message: json.error });
        return;
      }
      push({ kind: 'success', title: 'DNI creado', message: `Bienvenido a Vigo RP, ${firstName}.` });
      router.push('/tablet');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="hud-panel space-y-5 p-6">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre">
          <input
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="input"
            placeholder="Alejandro"
          />
        </Field>
        <Field label="Apellidos">
          <input
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="input"
            placeholder="García López"
          />
        </Field>
      </div>

      <Field label="Fecha de nacimiento">
        <input
          required
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="input"
          max={new Date().toISOString().slice(0, 10)}
        />
      </Field>

      <Field label="Usuario de Roblox">
        <div className="flex gap-2">
          <input
            required
            value={robloxUsername}
            onChange={(e) => {
              setRobloxUsername(e.target.value);
              setPreview(null);
            }}
            className="input flex-1"
            placeholder="MiUsuarioRoblox"
          />
          <button
            type="button"
            onClick={verifyRoblox}
            disabled={verifying || robloxUsername.trim().length < 3}
            className="shrink-0 rounded-lg border border-accent-500/40 bg-accent-500/10 px-4 text-sm font-medium text-accent-400 transition hover:bg-accent-500/20 disabled:opacity-50"
          >
            {verifying ? 'Buscando…' : 'Verificar'}
          </button>
        </div>
        {robloxError && <p className="mt-2 text-xs text-danger-500">{robloxError}</p>}
      </Field>

      {preview && (
        <div className="flex items-center gap-3 rounded-xl border border-success-500/30 bg-success-500/5 p-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-base-700">
            {preview.avatarUrl && (
              <Image src={preview.avatarUrl} alt={preview.username} fill className="object-cover" unoptimized />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">@{preview.username}</p>
            <p className="text-xs text-success-500">✓ Usuario de Roblox verificado</p>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !preview}
        className="w-full rounded-xl bg-accent-600 py-3 text-sm font-semibold text-white transition hover:bg-accent-500 disabled:opacity-50"
      >
        {submitting ? 'Creando DNI…' : 'Crear mi DNI'}
      </button>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          padding: 0.65rem 0.9rem;
          font-size: 0.875rem;
          color: white;
        }
        .input:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.6);
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}
