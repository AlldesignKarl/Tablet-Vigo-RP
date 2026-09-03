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
          Ya no hay un código fijo. Cada ciudadano que pide entrar en la sección de policía genera un
          código de un solo uso que se envía por email a{' '}
          <span className="font-mono text-slate-300">jc.expressdesigner@gmail.com</span>. Comparte ese
          código solo con la persona a la que quieras autorizar como policía.
        </p>
      </div>
      <PoliceUsersAdminPanel policeUsers={policeUsers ?? []} dnis={dnis ?? []} />
    </div>
  );
}
