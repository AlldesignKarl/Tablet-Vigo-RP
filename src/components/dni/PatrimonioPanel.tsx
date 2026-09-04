import Link from 'next/link';
import { Landmark, Car, ShieldCheck, ShieldAlert, IdCard, Package, FileText, type LucideIcon } from 'lucide-react';
import { centsToEuros } from '@/lib/format';

export default function PatrimonioPanel({
  balanceCents,
  vehiclesCount,
  isWanted,
}: {
  balanceCents: number;
  vehiclesCount: number;
  isWanted: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Resumen de patrimonio e inventario</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Landmark} label="Saldo en banco" value={centsToEuros(balanceCents)} />
        <StatCard icon={Car} label="Vehículos" value={`${vehiclesCount} ${vehiclesCount === 1 ? 'registrado' : 'registrados'}`} />
        <StatCard
          icon={isWanted ? ShieldAlert : ShieldCheck}
          label="Situación"
          value={isWanted ? 'Buscado' : 'No buscado'}
          tone={isWanted ? 'danger' : 'success'}
        />
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Accesos directos del dispositivo</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickLink href="/tablet/tienda" icon={IdCard} title="Mis Licencias" subtitle="Permisos y armas" />
          <QuickLink href="/tablet/banco" icon={Landmark} title="Cuentas Bancarias" subtitle="Saldo y movimientos" />
          <QuickLink href="/tablet/inventario" icon={Package} title="Inventario" subtitle="Productos comprados" />
          <QuickLink href="/tablet/historial" icon={FileText} title="Expediente" subtitle="Antecedentes y multas" />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger';
}) {
  const toneClass = { default: 'text-white', success: 'text-success-500', danger: 'text-danger-500' }[tone];
  return (
    <div className="hud-panel p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
      </div>
      <p className={`mt-1.5 text-lg font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function QuickLink({ href, icon: Icon, title, subtitle }: { href: string; icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <Link href={href} className="hud-panel flex flex-col gap-2 p-4 transition hover:border-accent-500/40">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-300">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Acceso rápido</p>
        <p className="truncate text-sm font-semibold text-white">{title}</p>
        <p className="truncate text-[10px] text-slate-500">{subtitle}</p>
      </div>
    </Link>
  );
}
