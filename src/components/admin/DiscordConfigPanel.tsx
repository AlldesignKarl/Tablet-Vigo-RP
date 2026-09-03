'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';

const CHANNELS: Array<{ key: string; label: string }> = [
  { key: 'webhook_dni', label: 'Nuevos DNI' },
  { key: 'webhook_vehiculos', label: 'Vehículos' },
  { key: 'webhook_compras', label: 'Compras y licencias' },
  { key: 'webhook_policia', label: 'Acciones policiales' },
  { key: 'webhook_sueldos', label: 'Sueldos' },
];

export default function DiscordConfigPanel({ initialValue }: { initialValue: Record<string, string | null> }) {
  const { push } = useToast();
  const [value, setValue] = useState<Record<string, string>>(
    Object.fromEntries(CHANNELS.map((c) => [c.key, initialValue[c.key] ?? ''])),
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'discord', value }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: 'error', title: 'No se pudo guardar', message: json.error });
        return;
      }
      push({ kind: 'success', title: 'Webhooks de Discord actualizados' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Integración con Discord</h2>
      <p className="text-sm text-slate-400">
        Configura los webhooks de Discord donde se enviarán los logs de cada tipo de evento. Las
        URLs se guardan de forma segura en la base de datos y solo se usan desde el servidor.
      </p>
      <div className="hud-panel space-y-3 p-5">
        {CHANNELS.map((c) => (
          <label key={c.key} className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">{c.label}</span>
            <input
              value={value[c.key] ?? ''}
              onChange={(e) => setValue({ ...value, [c.key]: e.target.value })}
              placeholder="https://discord.com/api/webhooks/…"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
            />
          </label>
        ))}
        <button onClick={save} disabled={saving} className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500 disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar webhooks'}
        </button>
      </div>
    </div>
  );
}
