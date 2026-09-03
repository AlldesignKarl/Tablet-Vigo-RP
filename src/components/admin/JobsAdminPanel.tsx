'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/ToastProvider';
import type { Database } from '@/types/database';

type Job = Database['public']['Tables']['jobs']['Row'];

export default function JobsAdminPanel({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const { push } = useToast();
  const supabase = createClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [newJob, setNewJob] = useState({ code: '', name: '', salaryEuros: 0 });

  async function updateSalary(job: Job, salaryEuros: number) {
    setSaving(job.id);
    // Escritura directa protegida por RLS (jobs_admin_write: solo is_admin()).
    const { error } = await supabase.from('jobs').update({ salary_cents: Math.round(salaryEuros * 100) }).eq('id', job.id);
    setSaving(null);
    if (error) {
      push({ kind: 'error', title: 'No se pudo actualizar', message: error.message });
      return;
    }
    push({ kind: 'success', title: 'Sueldo actualizado' });
    router.refresh();
  }

  async function addJob(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('jobs').insert({
      code: newJob.code.trim().toLowerCase().replace(/\s+/g, '_'),
      name: newJob.name.trim(),
      salary_cents: Math.round(newJob.salaryEuros * 100),
    });
    if (error) {
      push({ kind: 'error', title: 'No se pudo crear el empleo', message: error.message });
      return;
    }
    push({ kind: 'success', title: 'Empleo creado' });
    setNewJob({ code: '', name: '', salaryEuros: 0 });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-white">Empleos y sueldos (cada 48h)</h2>
      <div className="hud-panel divide-y divide-white/5 p-2">
        {jobs.map((job) => (
          <div key={job.id} className="flex items-center justify-between gap-3 p-3">
            <div>
              <p className="font-medium text-white">{job.name}</p>
              <p className="text-xs text-slate-500">{job.code}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={1}
                defaultValue={job.salary_cents / 100}
                onBlur={(e) => updateSalary(job, Number(e.target.value))}
                disabled={saving === job.id}
                className="w-28 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-right text-sm text-white outline-none focus:border-accent-500/60"
              />
              <span className="text-xs text-slate-500">€</span>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={addJob} className="hud-panel grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
        <input
          required
          placeholder="Código (ej. bombero)"
          value={newJob.code}
          onChange={(e) => setNewJob({ ...newJob, code: e.target.value })}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
        />
        <input
          required
          placeholder="Nombre"
          value={newJob.name}
          onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
        />
        <input
          required
          type="number"
          min={0}
          placeholder="Sueldo (€)"
          value={newJob.salaryEuros}
          onChange={(e) => setNewJob({ ...newJob, salaryEuros: Number(e.target.value) })}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
        />
        <button type="submit" className="rounded-lg bg-accent-600 py-2 text-sm font-semibold text-white hover:bg-accent-500">
          + Añadir empleo
        </button>
      </form>
    </div>
  );
}
