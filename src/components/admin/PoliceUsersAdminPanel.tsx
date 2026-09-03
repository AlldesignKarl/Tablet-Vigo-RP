'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/ToastProvider';
import type { Database } from '@/types/database';

type PoliceUser = Database['public']['Tables']['police_users']['Row'];
type DniInfo = { profile_id: string; first_name: string; last_name: string; dni_number: string };

export default function PoliceUsersAdminPanel({ policeUsers, dnis }: { policeUsers: PoliceUser[]; dnis: DniInfo[] }) {
  const router = useRouter();
  const { push } = useToast();
  const supabase = createClient();
  const dniMap = new Map(dnis.map((d) => [d.profile_id, d]));

  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<DniInfo[]>([]);
  const [callsign, setCallsign] = useState('');

  async function search() {
    if (query.trim().length < 2) return;
    const { data } = await supabase
      .from('dnis')
      .select('profile_id, first_name, last_name, dni_number')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,dni_number.ilike.%${query}%`)
      .limit(10);
    setCandidates(data ?? []);
  }

  async function addPoliceUser(profileId: string) {
    const { error } = await supabase.from('police_users').upsert({
      profile_id: profileId,
      callsign: callsign.trim() || `Z-${Math.floor(Math.random() * 90 + 10)}`,
      authorized: true,
    });
    if (error) {
      push({ kind: 'error', title: 'No se pudo autorizar', message: error.message });
      return;
    }
    // También se asegura que el rol refleje su nuevo acceso policial.
    await supabase.rpc('admin_set_role', { p_profile_id: profileId, p_role: 'policia' });
    push({ kind: 'success', title: 'Usuario autorizado como policía' });
    setCandidates([]);
    setQuery('');
    setCallsign('');
    router.refresh();
  }

  async function toggleAuthorized(pu: PoliceUser) {
    const { error } = await supabase.from('police_users').update({ authorized: !pu.authorized }).eq('profile_id', pu.profile_id);
    if (error) {
      push({ kind: 'error', title: 'No se pudo actualizar', message: error.message });
      return;
    }
    router.refresh();
  }

  async function updateField(pu: PoliceUser, patch: Partial<PoliceUser>) {
    const { error } = await supabase.from('police_users').update(patch).eq('profile_id', pu.profile_id);
    if (error) {
      push({ kind: 'error', title: 'No se pudo actualizar', message: error.message });
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Usuarios policiales</h2>

      <div className="hud-panel space-y-3 p-4">
        <p className="text-xs text-slate-400">Buscar ciudadano por nombre o DNI para darle acceso policial:</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre, apellidos o nº DNI"
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
          />
          <input
            value={callsign}
            onChange={(e) => setCallsign(e.target.value)}
            placeholder="Indicativo (ej. Z-10)"
            className="w-40 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
          />
          <button onClick={search} type="button" className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500">
            Buscar
          </button>
        </div>
        {candidates.length > 0 && (
          <div className="space-y-1">
            {candidates.map((c) => (
              <div key={c.profile_id} className="flex items-center justify-between rounded-lg bg-white/[0.03] p-2 text-sm">
                <span className="text-white">
                  {c.first_name} {c.last_name} · {c.dni_number}
                </span>
                <button onClick={() => addPoliceUser(c.profile_id)} className="rounded-md bg-police-500 px-3 py-1 text-xs font-semibold text-white hover:bg-police-500/80">
                  Autorizar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {policeUsers.map((pu) => {
          const dni = dniMap.get(pu.profile_id);
          return (
            <div key={pu.profile_id} className="hud-panel flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-[160px] flex-1">
                <p className="font-medium text-white">{dni ? `${dni.first_name} ${dni.last_name}` : pu.profile_id}</p>
                <p className="text-xs text-slate-500">{dni?.dni_number}</p>
              </div>
              <input
                defaultValue={pu.callsign}
                onBlur={(e) => updateField(pu, { callsign: e.target.value })}
                className="w-28 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center font-mono text-sm text-white outline-none"
              />
              <input
                defaultValue={pu.rank}
                onBlur={(e) => updateField(pu, { rank: e.target.value })}
                className="w-32 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-white outline-none"
              />
              <button
                onClick={() => toggleAuthorized(pu)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  pu.authorized ? 'bg-success-500/20 text-success-500' : 'bg-danger-500/20 text-danger-500'
                }`}
              >
                {pu.authorized ? 'Autorizado' : 'Revocado'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
