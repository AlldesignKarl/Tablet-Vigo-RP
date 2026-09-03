'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/ToastProvider';
import type { Database } from '@/types/database';

type LicenseType = Database['public']['Tables']['license_types']['Row'];

export default function LicenseTypesAdminPanel({ licenseTypes }: { licenseTypes: LicenseType[] }) {
  const router = useRouter();
  const { push } = useToast();
  const supabase = createClient();
  const [form, setForm] = useState({ code: '', name: '', description: '', icon: '🪪', priceEuros: 0, renewable: false });

  async function updateField(lt: LicenseType, patch: Partial<LicenseType>) {
    const { error } = await supabase.from('license_types').update(patch).eq('id', lt.id);
    if (error) {
      push({ kind: 'error', title: 'No se pudo actualizar', message: error.message });
      return;
    }
    router.refresh();
  }

  async function addLicenseType(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('license_types').insert({
      code: form.code.trim().toLowerCase().replace(/\s+/g, '_'),
      name: form.name.trim(),
      description: form.description.trim(),
      icon: form.icon || '🪪',
      price_cents: Math.round(form.priceEuros * 100),
      renewable: form.renewable,
      active: true,
    });
    if (error) {
      push({ kind: 'error', title: 'No se pudo crear la licencia', message: error.message });
      return;
    }
    push({ kind: 'success', title: 'Licencia creada' });
    setForm({ code: '', name: '', description: '', icon: '🪪', priceEuros: 0, renewable: false });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-white">Licencias de la tienda</h2>

      <div className="space-y-3">
        {licenseTypes.map((lt) => (
          <div key={lt.id} className="hud-panel flex flex-wrap items-center gap-3 p-4">
            <span className="text-xl">{lt.icon}</span>
            <div className="min-w-[160px] flex-1">
              <p className="font-medium text-white">{lt.name}</p>
              <p className="text-xs text-slate-500">{lt.code}</p>
            </div>
            <input
              type="number"
              min={0}
              defaultValue={lt.price_cents / 100}
              onBlur={(e) => updateField(lt, { price_cents: Math.round(Number(e.target.value) * 100) })}
              className="w-24 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-right text-sm text-white outline-none"
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <input type="checkbox" defaultChecked={lt.renewable} onChange={(e) => updateField(lt, { renewable: e.target.checked })} />
              Renovable
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <input type="checkbox" defaultChecked={lt.active} onChange={(e) => updateField(lt, { active: e.target.checked })} />
              Activa
            </label>
          </div>
        ))}
      </div>

      <form onSubmit={addLicenseType} className="hud-panel grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <input required placeholder="Código" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none" />
        <input required placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none" />
        <input required type="number" min={0} placeholder="Precio (€)" value={form.priceEuros} onChange={(e) => setForm({ ...form, priceEuros: Number(e.target.value) })} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none" />
        <input placeholder="Icono (emoji)" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none" />
        <textarea placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none sm:col-span-2" />
        <button type="submit" className="rounded-lg bg-accent-600 py-2 text-sm font-semibold text-white hover:bg-accent-500 sm:col-span-3">
          + Añadir licencia
        </button>
      </form>
    </div>
  );
}
