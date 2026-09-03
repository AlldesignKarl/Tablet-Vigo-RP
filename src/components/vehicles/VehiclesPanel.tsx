'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/ToastProvider';
import type { Database } from '@/types/database';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];

export default function VehiclesPanel({ vehicles }: { vehicles: Vehicle[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [showForm, setShowForm] = useState(vehicles.length === 0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ plate: '', brand: '', model: '', color: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/vehiculos/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: 'error', title: 'No se pudo registrar el vehículo', message: json.error });
        return;
      }
      push({ kind: 'success', title: 'Vehículo registrado', message: `Matrícula ${form.plate.toUpperCase()} añadida.` });
      setForm({ plate: '', brand: '', model: '', color: '' });
      setShowForm(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">🚗 Vehículos</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg border border-accent-500/40 bg-accent-500/10 px-4 py-2 text-sm font-medium text-accent-400 transition hover:bg-accent-500/20"
        >
          {showForm ? 'Cancelar' : '+ Registrar vehículo'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="hud-panel grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <TextInput label="Matrícula" value={form.plate} onChange={(v) => setForm({ ...form, plate: v })} placeholder="1234-ABC" />
          <TextInput label="Marca" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} placeholder="Ford" />
          <TextInput label="Modelo" value={form.model} onChange={(v) => setForm({ ...form, model: v })} placeholder="Focus" />
          <TextInput label="Color" value={form.color} onChange={(v) => setForm({ ...form, color: v })} placeholder="Azul" />
          <button
            type="submit"
            disabled={submitting}
            className="col-span-full rounded-lg bg-accent-600 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-500 disabled:opacity-50"
          >
            {submitting ? 'Registrando…' : 'Registrar vehículo'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((v) => (
          <div key={v.id} className="hud-panel space-y-2 p-5">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-sm font-bold text-white">{v.plate}</span>
              {v.impounded && <span className="rounded-full bg-danger-500/20 px-2 py-0.5 text-[10px] font-semibold text-danger-500">INCAUTADO</span>}
            </div>
            <p className="text-sm text-white">
              {v.brand} {v.model}
            </p>
            <p className="text-xs text-slate-400">Color: {v.color}</p>
            <div className="flex items-center justify-between text-xs">
              <span className={v.insured ? 'text-success-500' : 'text-slate-500'}>
                {v.insured ? '✓ Asegurado' : 'Sin seguro'}
              </span>
              <span className="text-slate-500">{formatDate(v.registered_at)}</span>
            </div>
          </div>
        ))}
        {vehicles.length === 0 && !showForm && (
          <p className="text-sm text-slate-500">Todavía no has registrado ningún vehículo.</p>
        )}
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-accent-500/60"
      />
    </label>
  );
}
