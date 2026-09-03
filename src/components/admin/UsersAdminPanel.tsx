'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import type { AppRole } from '@/types/database';

interface ProfileRow {
  id: string;
  role: AppRole;
  display_name: string | null;
  created_at: string;
}
interface DniInfo {
  profile_id: string;
  first_name: string;
  last_name: string;
  dni_number: string;
  roblox_username: string;
}
interface BankAccountInfo {
  profile_id: string;
  job_id: string | null;
}
interface JobInfo {
  id: string;
  code: string;
  name: string;
  salary_cents: number;
}

const ROLES: AppRole[] = ['ciudadano', 'policia', 'admin', 'fundador'];

export default function UsersAdminPanel({
  profiles,
  dnis,
  bankAccounts,
  jobs,
}: {
  profiles: ProfileRow[];
  dnis: DniInfo[];
  bankAccounts: BankAccountInfo[];
  jobs: JobInfo[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  const dniMap = new Map(dnis.map((d) => [d.profile_id, d]));
  const jobByProfile = new Map(bankAccounts.map((b) => [b.profile_id, b.job_id]));

  async function changeRole(profileId: string, role: AppRole) {
    setSaving(profileId);
    try {
      const res = await fetch('/api/admin/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, role }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: 'error', title: 'No se pudo cambiar el rol', message: json.error });
        return;
      }
      push({ kind: 'success', title: 'Rol actualizado' });
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  async function changeJob(profileId: string, jobId: string) {
    setSaving(`job:${profileId}`);
    try {
      const res = await fetch('/api/admin/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, jobId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: 'error', title: 'No se pudo cambiar el empleo', message: json.error });
        return;
      }
      push({ kind: 'success', title: 'Empleo asignado' });
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Usuarios y roles</h2>
      <div className="hud-panel divide-y divide-white/5">
        {profiles.map((p) => {
          const dni = dniMap.get(p.id);
          const currentJobId = jobByProfile.get(p.id);
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-[200px] flex-1">
                <p className="font-medium text-white">{dni ? `${dni.first_name} ${dni.last_name}` : p.display_name ?? 'Sin DNI'}</p>
                <p className="text-xs text-slate-500">{dni ? `${dni.dni_number} · @${dni.roblox_username}` : p.id}</p>
              </div>
              {currentJobId !== undefined && (
                <select
                  defaultValue={currentJobId ?? ''}
                  disabled={saving === `job:${p.id}`}
                  onChange={(e) => changeJob(p.id, e.target.value)}
                  className="rounded-lg border border-white/10 bg-base-800 px-3 py-1.5 text-sm text-white outline-none"
                >
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name} ({(j.salary_cents / 100).toFixed(0)}€)
                    </option>
                  ))}
                </select>
              )}
              <select
                defaultValue={p.role}
                disabled={saving === p.id}
                onChange={(e) => changeRole(p.id, e.target.value as AppRole)}
                className="rounded-lg border border-white/10 bg-base-800 px-3 py-1.5 text-sm text-white outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
