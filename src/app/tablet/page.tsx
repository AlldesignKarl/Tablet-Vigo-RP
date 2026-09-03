import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCitizenProfile } from '@/lib/data/citizen';
import DashboardCard from '@/components/tablet/DashboardCard';
import { centsToEuros } from '@/lib/format';
import { IdCard, Landmark, Car, ShoppingBag, Package, Scale, Shield, Siren, Gavel, FileWarning, type LucideIcon } from 'lucide-react';

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
          <Siren className="h-5 w-5 shrink-0 text-danger-500" strokeWidth={1.75} />
          <div>
            <p className="text-sm font-bold text-danger-500">Estás en busca y captura</p>
            <p className="text-xs text-slate-300">{profile.wanted_reason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniStat icon={Landmark} label="Saldo" value={centsToEuros(profile?.balance_cents ?? 0)} />
        <MiniStat icon={IdCard} label="Puntos carnet" value={String(profile?.license_points ?? '—')} />
        <MiniStat
          icon={Gavel}
          label="Multas pendientes"
          value={centsToEuros(profile?.fines_pending_amount_cents ?? 0)}
          alert={(profile?.fines_pending_amount_cents ?? 0) > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard href="/tablet/dni" icon={IdCard} title="DNI" description="Consulta tu documento de identidad." />
        <DashboardCard href="/tablet/banco" icon={Landmark} title="Banco" description="Saldo, sueldo y movimientos." />
        <DashboardCard href="/tablet/vehiculos" icon={Car} title="Vehículos" description="Registra y consulta tus vehículos." />
        <DashboardCard href="/tablet/tienda" icon={ShoppingBag} title="Tienda y licencias" description="Compra licencias oficiales." />
        <DashboardCard href="/tablet/inventario" icon={Package} title="Inventario" description="Objetos y equipamiento que has comprado." />
        <DashboardCard href="/tablet/denuncias" icon={FileWarning} title="Denuncias" description="Pon una denuncia contra otro ciudadano." />
        <DashboardCard href="/tablet/historial" icon={Scale} title="Historial" description="Arrestos, multas e incautaciones." />
        <DashboardCard
          href="/tablet/policia"
          icon={Shield}
          title="Cuenta de policía"
          description="Introduce el código de acceso para entrar."
          accent
        />
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  alert,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={`hud-panel flex items-center justify-between gap-3 p-4 ${alert ? 'border-danger-500/40 bg-danger-500/[0.04]' : ''}`}>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`mt-1 text-xl font-bold ${alert ? 'text-danger-500' : 'text-white'}`}>{value}</p>
      </div>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
          alert ? 'border-danger-500/40 bg-danger-500/10 text-danger-500' : 'border-white/10 bg-white/5 text-slate-300'
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
    </div>
  );
}
