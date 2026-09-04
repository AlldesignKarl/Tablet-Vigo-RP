import { createServerSupabaseClient } from '@/lib/supabase/server';
import PoliceUsersAdminPanel from '@/components/admin/PoliceUsersAdminPanel';

export default async function AdminPolicePage() {
  const supabase = createServerSupabaseClient();
  const { data: policeUsers } = await supabase.from('police_users').select('*').order('created_at', { ascending: false });

  const profileIds = (policeUsers ?? []).map((p) => p.profile_id);
  const { data: dnis } = profileIds.length
    ? await supabase.from('dnis').select('profile_id, first_name, last_name, dni_number').in('profile_id', profileIds)
    : { data: [] };

  return (
    <div className="space-y-10">
      <div className="hud-panel p-5">
        <h2 className="mb-1 font-semibold text-white">Acceso a la cuenta de policía</h2>
        <p className="text-xs text-slate-400">
          El acceso ya no se pide con un código: se concede automáticamente al asignarle a un
          ciudadano un empleo policial (CNP, Guardia Civil, UIP o UPR, o sus altos mandos) desde{' '}
          <span className="font-mono text-slate-300">Empleos</span> o el Panel Admin de la tablet, y se
          retira si se le cambia a otro empleo. Desde aquí también puedes autorizar o revocar el acceso
          a mano y editar el indicativo/rango de cada agente.
        </p>
      </div>
      <PoliceUsersAdminPanel policeUsers={policeUsers ?? []} dnis={dnis ?? []} />
    </div>
  );
}
