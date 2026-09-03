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

const ROLES: AppRole[] = ['ciudadano', 'policia', 'admin', 'fundador'];

export default function UsersAdminPanel({ profiles, dnis }: { profiles: ProfileRow[]; dnis: DniInfo[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  const dniMap = new Map(dnis.map((d) => [d.profile_id, d]));

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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Usuarios y roles</h2>
      <div className="hud-panel divide-y divide-white/5">
        {profiles.map((p) => {
          const dni = dniMap.get(p.id);
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-[200px] flex-1">
                <p className="font-medium text-white">{dni ? `${dni.first_name} ${dni.last_name}` : p.display_name ?? 'Sin DNI'}</p>
                <p className="text-xs text-slate-500">{dni ? `${dni.dni_number} · @${dni.roblox_username}` : p.id}</p>
              </div>
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
