'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileWarning, Hourglass, Eye, CircleCheck } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/components/ui/ToastProvider';
import type { Database } from '@/types/database';

type Complaint = Database['public']['Views']['complaints_view']['Row'];
type Status = Complaint['status'];

const STATUS_META: Record<Status, { label: string; icon: typeof Hourglass; className: string }> = {
  pendiente: { label: 'Pendiente', icon: Hourglass, className: 'bg-yellow-500/15 text-yellow-500' },
  en_inspeccion: { label: 'En inspección', icon: Eye, className: 'bg-accent-500/15 text-accent-400' },
  cerrada: { label: 'Cerrada', icon: CircleCheck, className: 'bg-success-500/15 text-success-500' },
};

export default function PoliceComplaintsPanel({ complaints }: { complaints: Complaint[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(complaints[0]?.id ?? null);
  const [updating, setUpdating] = useState(false);

  const selected = complaints.find((c) => c.id === selectedId) ?? null;

  async function updateStatus(status: Status) {
    if (!selected) return;
    setUpdating(true);
    try {
      const res = await fetch('/api/police/update-complaint-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaintId: selected.id, status }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: 'error', title: 'No se pudo actualizar la denuncia', message: json.error });
        return;
      }
      push({ kind: 'success', title: 'Denuncia actualizada', message: `Ahora está ${STATUS_META[status].label.toLowerCase()}.` });
      router.refresh();
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-police-500/40 bg-police-500/10 text-police-glow">
          <FileWarning className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-white">Denuncias</h1>
          <p className="text-xs text-slate-500">Gestiona las denuncias registradas por los ciudadanos</p>
        </div>
      </div>

      {complaints.length === 0 ? (
        <div className="hud-panel p-6 text-center text-sm text-slate-500">No hay denuncias registradas.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          <div className="hud-panel scrollbar-none max-h-[70vh] space-y-1.5 overflow-y-auto p-3">
            {complaints.map((c) => {
              const meta = STATUS_META[c.status];
              const StatusIcon = meta.icon;
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`no-glow flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition ${
                    active ? 'border-police-500/50 bg-police-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {c.accused_first_name} {c.accused_last_name}
                    </p>
                    <span className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${meta.className}`}>
                      <StatusIcon className="h-2.5 w-2.5" strokeWidth={2} />
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    Por {c.reporter_first_name} {c.reporter_last_name}
                  </p>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="hud-panel space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Denunciado</p>
                  <p className="text-lg font-bold text-white">
                    {selected.accused_first_name} {selected.accused_last_name}
                  </p>
                  <p className="font-mono text-xs text-slate-500">DNI {selected.accused_dni_number}</p>
                </div>
                {(() => {
                  const meta = STATUS_META[selected.status];
                  const StatusIcon = meta.icon;
                  return (
                    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase ${meta.className}`}>
                      <StatusIcon className="h-3.5 w-3.5" strokeWidth={2} />
                      {meta.label}
                    </span>
                  );
                })()}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Denunciante</p>
                <p className="text-sm text-white">
                  {selected.reporter_first_name} {selected.reporter_last_name}{' '}
                  <span className="font-mono text-xs text-slate-500">(DNI {selected.reporter_dni_number})</span>
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Motivo</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{selected.reason}</p>
              </div>

              <p className="text-xs text-slate-500">
                Registrada el {formatDateTime(selected.created_at)}
                {selected.updated_at !== selected.created_at && ` · Actualizada el ${formatDateTime(selected.updated_at)}`}
              </p>

              <div className="grid grid-cols-1 gap-2 border-t border-white/10 pt-4 sm:grid-cols-3">
                <button
                  onClick={() => updateStatus('pendiente')}
                  disabled={updating || selected.status === 'pendiente'}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 py-2.5 text-xs font-semibold text-yellow-500 transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Hourglass className="h-4 w-4" strokeWidth={1.75} />
                  Pendiente
                </button>
                <button
                  onClick={() => updateStatus('en_inspeccion')}
                  disabled={updating || selected.status === 'en_inspeccion'}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-accent-500/40 bg-accent-500/10 py-2.5 text-xs font-semibold text-accent-400 transition hover:bg-accent-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Eye className="h-4 w-4" strokeWidth={1.75} />
                  En inspección
                </button>
                <button
                  onClick={() => updateStatus('cerrada')}
                  disabled={updating || selected.status === 'cerrada'}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-success-500/40 bg-success-500/10 py-2.5 text-xs font-semibold text-success-500 transition hover:bg-success-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CircleCheck className="h-4 w-4" strokeWidth={1.75} />
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
