'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';

export default function GeneralConfigPanel({ initialPoints }: { initialPoints: number }) {
  const { push } = useToast();
  const [points, setPoints] = useState(initialPoints);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'general', value: { initial_license_points: points } }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: 'error', title: 'No se pudo guardar', message: json.error });
        return;
      }
      push({ kind: 'success', title: 'Configuración actualizada' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Configuración general</h2>
      <div className="hud-panel max-w-sm space-y-3 p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Puntos iniciales del carnet</span>
          <input
            type="number"
            min={0}
            max={20}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
          />
          <span className="mt-1 block text-[11px] text-slate-500">
            Se aplica a los DNI creados a partir de ahora, no modifica los ya existentes.
          </span>
        </label>
        <button onClick={save} disabled={saving} className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500 disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
