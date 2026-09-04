import { ShieldOff } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import PoliceSubNav from '@/components/police/PoliceSubNav';

export default async function PoliceLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient();
  const { data: isPolice } = await supabase.rpc('is_police_authorized');

  // Ya no existe un código de acceso: el permiso lo concede automáticamente
  // un admin al asignar un empleo policial (CNP, GC, altos mandos, UIP,
  // UPR). Comprobación real en servidor: visitar la URL directamente sin
  // ese empleo asignado no da acceso al panel.
  if (!isPolice) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <ShieldOff className="h-10 w-10 text-slate-600" strokeWidth={1.5} />
        <h1 className="font-display text-lg font-bold text-white">Acceso restringido</h1>
        <p className="max-w-sm text-sm text-slate-400">
          Solo pueden entrar aquí los ciudadanos con un empleo policial asignado (CNP, Guardia Civil, UIP o UPR).
          Pide a un administrador que te asigne el empleo correspondiente.
        </p>
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
