import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCitizenProfile } from '@/lib/data/citizen';
import DashboardCard from '@/components/tablet/DashboardCard';
import { centsToEuros } from '@/lib/format';

export default async function TabletHomePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getCitizenProfile(supabase, user.id) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">
          Bienvenido, {profile?.first_name} {profile?.last_name}
        </h1>
        <p className="text-sm text-slate-400">DNI {profile?.dni_number} · Panel principal de la tablet</p>
      </div>

      {profile?.is_wanted && (
        <div className="hud-panel flex items-center gap-3 border-danger-500/40 bg-danger-500/10 p-4">
          <span className="text-xl">🚨</span>
          <div>
            <p className="text-sm font-bold text-danger-500">Estás en busca y captura</p>
            <p className="text-xs text-slate-300">{profile.wanted_reason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MiniStat label="Saldo" value={centsToEuros(profile?.balance_cents ?? 0)} />
        <MiniStat label="Puntos carnet" value={String(profile?.license_points ?? '—')} />
        <MiniStat label="Multas pendientes" value={centsToEuros(profile?.fines_pending_amount_cents ?? 0)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard href="/tablet/dni" icon="🪪" title="DNI" description="Consulta tu documento de identidad." />
        <DashboardCard href="/tablet/banco" icon="🏦" title="Banco" description="Saldo, sueldo y movimientos." />
        <DashboardCard href="/tablet/vehiculos" icon="🚗" title="Vehículos" description="Registra y consulta tus vehículos." />
        <DashboardCard href="/tablet/tienda" icon="🛒" title="Tienda y licencias" description="Compra licencias oficiales." />
        <DashboardCard href="/tablet/historial" icon="⚖️" title="Historial" description="Arrestos, multas e incautaciones." />
        <DashboardCard
          href="/tablet/policia"
          icon="👮"
          title="Cuenta de policía"
          description="Introduce el código de acceso para entrar."
          accent
        />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hud-panel p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}
