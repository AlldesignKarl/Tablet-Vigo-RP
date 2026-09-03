import { createServerSupabaseClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function PoliceDashboardPage() {
  const supabase = createServerSupabaseClient();
  const { data: stats } = await supabase.from('police_stats_view').select('*').single();
  const { data: wantedList } = await supabase
    .from('wanted_persons')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-police-500/40 bg-police-500/10 text-xl">
          👮
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Panel policial</h1>
          <p className="text-xs text-slate-500">Vigo RP · Cuerpo Nacional de Policía</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon="👤" label="Personas registradas" value={stats?.total_citizens ?? 0} />
        <StatCard icon="🚗" label="Vehículos registrados" value={stats?.total_vehicles ?? 0} />
        <StatCard icon="🔫" label="Licencias de armas" value={stats?.total_weapon_licenses ?? 0} />
        <StatCard icon="🚨" label="En busca y captura" value={stats?.total_wanted ?? 0} danger />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/tablet/policia/buscar-persona"
          className="hud-panel flex items-center gap-3 border-l-2 border-l-police-500/50 p-5 transition hover:border-police-500/50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-police-500/10 text-2xl">🔎</span>
          <div>
            <p className="font-semibold text-white">Buscar persona</p>
            <p className="text-xs text-slate-400">Por DNI, nombre o usuario de Roblox</p>
          </div>
        </Link>
        <Link
          href="/tablet/policia/buscar-matricula"
          className="hud-panel flex items-center gap-3 border-l-2 border-l-police-500/50 p-5 transition hover:border-police-500/50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-police-500/10 text-2xl">🚘</span>
          <div>
            <p className="font-semibold text-white">Buscar matrícula</p>
            <p className="text-xs text-slate-400">Consulta vehículos registrados</p>
          </div>
        </Link>
      </div>

      <div className="hud-panel p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-danger-500" />
          Busca y captura activas
        </h2>
        {!wantedList || wantedList.length === 0 ? (
          <p className="text-sm text-slate-500">No hay nadie en busca y captura actualmente.</p>
        ) : (
          <div className="space-y-2">
            {wantedList.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border border-danger-500/20 bg-danger-500/5 p-3 text-sm">
                <span className="text-slate-300">{w.reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, danger }: { icon: string; label: string; value: number; danger?: boolean }) {
  const isAlert = danger && value > 0;
  return (
    <div className={`hud-panel p-4 ${isAlert ? 'border-danger-500/40 bg-danger-500/[0.04]' : ''}`}>
      <p className="text-2xl">{icon}</p>
      <p className={`mt-2 text-2xl font-bold ${isAlert ? 'text-danger-500' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
