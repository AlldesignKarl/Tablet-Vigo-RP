import Image from 'next/image';
import Link from 'next/link';
import { Siren, Car } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import type { Database } from '@/types/database';

type WantedRow = Database['public']['Views']['wanted_active_view']['Row'];

export default function PoliceWantedListPanel({ wanted }: { wanted: WantedRow[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-danger-500/40 bg-danger-500/10 text-danger-500">
          <Siren className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-white">Busca y captura</h1>
          <p className="text-xs text-slate-500">Personas actualmente en busca y captura, con su vehículo si se indicó.</p>
        </div>
      </div>

      {wanted.length === 0 ? (
        <div className="hud-panel p-6 text-center text-sm text-slate-500">Nadie está en busca y captura ahora mismo.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {wanted.map((w) => (
            <Link
              key={w.id}
              href={`/tablet/policia/perfil/${w.citizen_id}`}
              className="hud-panel flex items-center gap-3 p-4 transition hover:border-danger-500/40"
            >
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-danger-500/40 bg-base-700">
                {w.roblox_avatar_url ? (
                  <Image src={w.roblox_avatar_url} alt={w.first_name} fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg">👤</div>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">
                  {w.first_name} {w.last_name}
                </p>
                <p className="font-mono text-xs text-slate-500">{w.dni_number}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">{w.reason}</p>
              </div>
              {w.vehicle_plate && (
                <span className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-xs font-bold text-white">
                  <Car className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {w.vehicle_plate}
                </span>
              )}
              <span className="shrink-0 text-[10px] text-slate-500">{formatDateTime(w.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
