import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function AdminOverviewPage() {
  const supabase = createServerSupabaseClient();
  const [{ data: stats }, { count: totalUsers }, { count: totalAudit }] = await Promise.all([
    supabase.from('police_stats_view').select('*').single(),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('audit_logs').select('*', { count: 'exact', head: true }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Usuarios totales" value={totalUsers ?? 0} />
        <Stat label="Ciudadanos con DNI" value={stats?.total_citizens ?? 0} />
        <Stat label="Vehículos" value={stats?.total_vehicles ?? 0} />
        <Stat label="Registros de auditoría" value={totalAudit ?? 0} />
      </div>
      <p className="text-sm text-slate-400">
        Usa el menú superior para configurar sueldos, precios de licencias, productos de la tienda,
        usuarios policiales, el código de acceso policial, los webhooks de Discord y los roles de
        cada usuario.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="hud-panel p-4">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
