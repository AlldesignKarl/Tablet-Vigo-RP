import { createServerSupabaseClient } from '@/lib/supabase/server';
import PoliceUnlockForm from '@/components/police/PoliceUnlockForm';
import PoliceSubNav from '@/components/police/PoliceSubNav';

export default async function PoliceLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient();
  const { data: isPolice } = await supabase.rpc('is_police_authorized');

  // Comprobación real en servidor. Ocultar el enlace en el menú NO es
  // suficiente: si alguien visita la URL directamente sin autorización,
  // se le muestra el formulario de código en lugar del panel.
  if (!isPolice) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <PoliceUnlockForm />
      </div>
    );
  }

  const { data: policeUser } = await supabase.from('police_users').select('callsign, rank').single();

  return (
    <div className="space-y-6">
      <PoliceSubNav callsign={policeUser?.callsign} rank={policeUser?.rank} />
      {children}
    </div>
  );
}
