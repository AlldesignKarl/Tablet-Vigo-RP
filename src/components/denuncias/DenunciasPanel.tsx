'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileWarning, Hourglass, Eye, CircleCheck } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/components/ui/ToastProvider';
import Portal from '@/components/ui/Portal';
import type { Database } from '@/types/database';

type Complaint = Database['public']['Views']['complaints_view']['Row'];

const STATUS_META: Record<Complaint['status'], { label: string; icon: typeof Hourglass; className: string }> = {
  pendiente: { label: 'Pendiente', icon: Hourglass, className: 'bg-yellow-500/15 text-yellow-500' },
  en_inspeccion: { label: 'En inspección', icon: Eye, className: 'bg-accent-500/15 text-accent-400' },
  cerrada: { label: 'Cerrada', icon: CircleCheck, className: 'bg-success-500/15 text-success-500' },
};

export default function DenunciasPanel({ myComplaints }: { myComplaints: Complaint[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [accusedDescription, setAccusedDescription] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function closeForm() {
    setOpen(false);
    setAccusedDescription('');
    setReason('');
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (accusedDescription.trim().length < 2 || reason.trim().length < 5) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/denuncias/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accusedDescription, reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFormError(json.error || 'Error desconocido.');
        return;
      }
      push({ kind: 'success', title: 'Denuncia enviada', message: 'La policía la revisará en su canal de denuncias.' });
      closeForm();
      router.refresh();
    } catch {
      setFormError('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200">
            <FileWarning className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-white">Denuncias</h1>
            <p className="text-xs text-slate-500">Pon una denuncia para que la revise la policía.</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-500"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Crear denuncia
        </button>
      </div>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="hud-panel my-auto w-full max-w-md space-y-4 p-6">
              <h3 className="font-display text-lg font-bold text-white">Crear denuncia</h3>

              {formError && (
                <p className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-500">
                  Error: {formError}
                </p>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
                  ¿A quién denuncias?
                </label>
                <input
                  required
                  value={accusedDescription}
                  onChange={(e) => setAccusedDescription(e.target.value)}
                  placeholder="Nombre y apellidos, o si no lo sabes: vehículo, modelo, matrícula..."
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-accent-500/60"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Motivo</label>
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Qué ha pasado, dónde, cuándo..."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-accent-500/60"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || accusedDescription.trim().length < 2 || reason.trim().length < 5}
                  className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Enviando…' : 'Enviar denuncia'}
                </button>
              </div>
            </form>
          </div>
        </Portal>
      )}

      <div className="hud-panel p-5">
        <h2 className="mb-3 font-semibold text-white">Mis denuncias</h2>
        {myComplaints.length === 0 ? (
          <p className="text-sm text-slate-500">No has puesto ninguna denuncia todavía.</p>
        ) : (
          <div className="space-y-2">
            {myComplaints.map((c) => {
              const meta = STATUS_META[c.status];
              const StatusIcon = meta.icon;
              const accusedLabel =
                c.accused_id && c.accused_first_name ? `${c.accused_first_name} ${c.accused_last_name}` : c.accused_description;
              return (
                <div key={c.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-white">
                        Contra <span className="font-semibold">{accusedLabel}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{c.reason}</p>
                    </div>
                    <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${meta.className}`}>
                      <StatusIcon className="h-3 w-3" strokeWidth={2} />
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-500">{formatDateTime(c.created_at)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
