'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';

export default function PoliceCodeForm() {
  const { push } = useToast();
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/police-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: 'error', title: 'No se pudo cambiar el código', message: json.error });
        return;
      }
      push({ kind: 'success', title: 'Código policial actualizado' });
      setCode('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hud-panel p-5">
      <h2 className="mb-1 font-semibold text-white">Código de acceso policial</h2>
      <p className="mb-3 text-xs text-slate-400">
        Se guarda como hash seguro en la base de datos. Nunca se expone en el código del frontend.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          required
          minLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Nuevo código"
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
        />
        <button type="submit" disabled={saving} className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500 disabled:opacity-50">
          {saving ? 'Guardando…' : 'Actualizar código'}
        </button>
      </form>
    </div>
  );
}
