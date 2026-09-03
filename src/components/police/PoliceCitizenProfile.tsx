'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { centsToEuros, formatDate, formatDateTime } from '@/lib/format';
import { useToast } from '@/components/ui/ToastProvider';
import Portal from '@/components/ui/Portal';
import type { CitizenProfile } from '@/lib/data/citizen';
import type { Database } from '@/types/database';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type Arrest = Database['public']['Tables']['arrests']['Row'];
type Fine = Database['public']['Tables']['fines']['Row'];
type Confiscation = Database['public']['Tables']['confiscations']['Row'];
type PointsEntry = Database['public']['Tables']['license_points_history']['Row'];

type ModalKind = 'arrest' | 'fine' | 'confiscate' | 'points' | 'wanted' | null;

export default function PoliceCitizenProfile({
  profile,
  vehicles,
  arrests,
  fines,
  confiscations,
  pointsHistory,
}: {
  profile: CitizenProfile;
  vehicles: Vehicle[];
  arrests: Arrest[];
  fines: Fine[];
  confiscations: Confiscation[];
  pointsHistory: PointsEntry[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [modal, setModal] = useState<ModalKind>(null);
  const [loading, setLoading] = useState(false);

  async function call(url: string, body: Record<string, unknown>, successMsg: string) {
    setLoading(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: 'error', title: 'Acción no realizada', message: json.error });
        return false;
      }
      push({ kind: 'success', title: successMsg });
      setModal(null);
      router.refresh();
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function impound(vehicleId: string) {
    const reason = window.prompt('Motivo de la incautación del vehículo:');
    if (!reason) return;
    await call('/api/police/impound-vehicle', { vehicleId, reason }, 'Vehículo incautado');
  }

  async function release(vehicleId: string) {
    await call('/api/police/release-vehicle', { vehicleId }, 'Vehículo liberado');
  }

  async function clearWanted() {
    await call('/api/police/clear-wanted', { citizenId: profile.profile_id }, 'Busca y captura retirada');
  }

  return (
    <div className="space-y-6">
      <div className="hud-panel flex flex-wrap items-center gap-4 p-5">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-base-700">
          {profile.roblox_avatar_url && (
            <Image src={profile.roblox_avatar_url} alt={profile.first_name} fill className="object-cover" unoptimized />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-white">
            {profile.first_name} {profile.last_name}
          </h1>
          <p className="text-sm text-slate-400">
            {profile.dni_number} · @{profile.roblox_username} · Nacimiento {formatDate(profile.birth_date)}
          </p>
        </div>
        {profile.is_wanted ? (
          <div className="flex items-center gap-2 rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2">
            <span className="text-sm font-bold text-danger-500">🚨 BUSCA Y CAPTURA</span>
            <button onClick={clearWanted} className="text-xs underline text-slate-300">
              Retirar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setModal('wanted')}
            className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs font-bold text-danger-500 transition hover:bg-danger-500/20"
          >
            🚨 Poner en busca y captura
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Puntos carnet" value={String(profile.license_points)} />
        <MiniStat label="Multas pendientes" value={centsToEuros(profile.fines_pending_amount_cents)} />
        <MiniStat label="Arrestos" value={String(profile.arrests_count)} />
        <MiniStat label="Vehículos" value={String(profile.vehicles_count)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton icon="🚔" label="Arrestar" onClick={() => setModal('arrest')} />
        <ActionButton icon="💸" label="Multar" onClick={() => setModal('fine')} />
        <ActionButton icon="📦" label="Incautar material" onClick={() => setModal('confiscate')} />
        <ActionButton icon="🪪" label="Quitar puntos" onClick={() => setModal('points')} />
      </div>

      <Section title="Vehículos">
        {vehicles.length === 0 ? (
          <Empty text="Sin vehículos registrados." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {vehicles.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm">
                <div>
                  <p className="font-mono font-bold text-white">{v.plate}</p>
                  <p className="text-xs text-slate-400">
                    {v.brand} {v.model} · {v.color}
                  </p>
                  <p className="mt-1 text-xs">
                    Vehículo incautado:{' '}
                    <span className={v.impounded ? 'font-bold text-success-500' : 'font-bold text-danger-500'}>
                      {v.impounded ? 'Sí' : 'No'}
                    </span>
                  </p>
                </div>
                {v.impounded ? (
                  <button onClick={() => release(v.id)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20">
                    Liberar
                  </button>
                ) : (
                  <button
                    onClick={() => impound(v.id)}
                    className="rounded-lg bg-danger-600/80 px-3 py-1.5 text-xs text-white hover:bg-danger-600"
                  >
                    Incautar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Historial de arrestos">
        {arrests.length === 0 ? (
          <Empty text="Sin arrestos." />
        ) : (
          arrests.map((a) => <HistoryRow key={a.id} title={a.reason} detail={`${a.duration_minutes} min`} date={a.created_at} />)
        )}
      </Section>

      <Section title="Multas">
        {fines.length === 0 ? (
          <Empty text="Sin multas." />
        ) : (
          fines.map((f) => (
            <HistoryRow key={f.id} title={f.reason} detail={`${centsToEuros(f.amount_cents)} · ${f.status}`} date={f.created_at} />
          ))
        )}
      </Section>

      <Section title="Incautaciones de material">
        {confiscations.length === 0 ? (
          <Empty text="Sin incautaciones." />
        ) : (
          confiscations.map((c) => (
            <HistoryRow key={c.id} title={`${c.material} (${c.quantity})`} detail={c.reason} date={c.created_at} />
          ))
        )}
      </Section>

      <Section title="Puntos del carnet">
        {pointsHistory.length === 0 ? (
          <Empty text="Sin sanciones de puntos." />
        ) : (
          pointsHistory.map((p) => (
            <HistoryRow key={p.id} title={`-${p.points_removed} puntos`} detail={`${p.reason} · quedan ${p.points_after}`} date={p.created_at} />
          ))
        )}
      </Section>

      {modal === 'arrest' && (
        <ArrestModal citizenId={profile.profile_id} loading={loading} onSubmit={call} onClose={() => setModal(null)} />
      )}
      {modal === 'fine' && (
        <FineModal citizenId={profile.profile_id} loading={loading} onSubmit={call} onClose={() => setModal(null)} />
      )}
      {modal === 'confiscate' && (
        <ConfiscateModal citizenId={profile.profile_id} loading={loading} onSubmit={call} onClose={() => setModal(null)} />
      )}
      {modal === 'points' && (
        <PointsModal
          citizenId={profile.profile_id}
          currentPoints={profile.license_points}
          loading={loading}
          onSubmit={call}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'wanted' && (
        <WantedModal citizenId={profile.profile_id} loading={loading} onSubmit={call} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hud-panel p-5">
      <h2 className="mb-3 font-semibold text-white">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-500">{text}</p>;
}

function HistoryRow({ title, detail, date }: { title: string; detail: string; date: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
      <div>
        <p className="text-white">{title}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
      <span className="text-xs text-slate-500">{formatDateTime(date)}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hud-panel p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold text-white">{value}</p>
    </div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-police-500/40 bg-police-500/10 px-4 py-2.5 text-sm font-medium text-police-glow transition hover:bg-police-500/20"
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

interface ModalProps {
  citizenId: string;
  loading: boolean;
  onSubmit: (url: string, body: Record<string, unknown>, successMsg: string) => Promise<boolean>;
  onClose: () => void;
}

function ModalShell({ title, onClose, children, onSubmit, loading }: {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
        <form onSubmit={onSubmit} className="hud-panel my-auto w-full max-w-md space-y-4 p-6">
          <h3 className="font-display text-lg font-bold text-white">{title}</h3>
          {children}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="rounded-lg bg-police-500 px-4 py-2 text-sm font-semibold text-white hover:bg-police-500/80 disabled:opacity-60">
              {loading ? 'Procesando…' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </Portal>
  );
}

function inputCls() {
  return 'w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-accent-500/60';
}

function ArrestModal({ citizenId, loading, onSubmit, onClose }: ModalProps) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(10);
  return (
    <ModalShell
      title="🚔 Arrestar ciudadano"
      onClose={onClose}
      loading={loading}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit('/api/police/arrest', { citizenId, reason, durationMinutes: duration }, 'Arresto registrado');
      }}
    >
      <label className="block text-xs text-slate-400">Motivo</label>
      <input required value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls()} />
      <label className="block text-xs text-slate-400">Duración (minutos)</label>
      <input
        required
        type="number"
        min={1}
        max={1440}
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value))}
        className={inputCls()}
      />
    </ModalShell>
  );
}

function FineModal({ citizenId, loading, onSubmit, onClose }: ModalProps) {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState(100);
  return (
    <ModalShell
      title="💸 Multar ciudadano"
      onClose={onClose}
      loading={loading}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit('/api/police/fine', { citizenId, reason, amountEuros: amount }, 'Multa registrada');
      }}
    >
      <label className="block text-xs text-slate-400">Motivo</label>
      <input required value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls()} />
      <label className="block text-xs text-slate-400">Importe (€)</label>
      <input
        required
        type="number"
        min={1}
        step={0.01}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className={inputCls()}
      />
    </ModalShell>
  );
}

function ConfiscateModal({ citizenId, loading, onSubmit, onClose }: ModalProps) {
  const [material, setMaterial] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  return (
    <ModalShell
      title="📦 Incautar material"
      onClose={onClose}
      loading={loading}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit('/api/police/confiscate', { citizenId, material, quantity, reason }, 'Material incautado');
      }}
    >
      <label className="block text-xs text-slate-400">Material</label>
      <input required value={material} onChange={(e) => setMaterial(e.target.value)} className={inputCls()} />
      <label className="block text-xs text-slate-400">Cantidad</label>
      <input required value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls()} />
      <label className="block text-xs text-slate-400">Motivo</label>
      <input required value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls()} />
    </ModalShell>
  );
}

function PointsModal({
  citizenId,
  currentPoints,
  loading,
  onSubmit,
  onClose,
}: ModalProps & { currentPoints: number }) {
  const [points, setPoints] = useState(2);
  const [reason, setReason] = useState('');
  return (
    <ModalShell
      title="🪪 Quitar puntos del carnet"
      onClose={onClose}
      loading={loading}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit('/api/police/remove-points', { citizenId, points, reason }, 'Puntos actualizados');
      }}
    >
      <p className="text-xs text-slate-400">Puntos actuales: {currentPoints}</p>
      <label className="block text-xs text-slate-400">Puntos a restar</label>
      <input
        required
        type="number"
        min={1}
        max={20}
        value={points}
        onChange={(e) => setPoints(Number(e.target.value))}
        className={inputCls()}
      />
      <label className="block text-xs text-slate-400">Motivo</label>
      <input required value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls()} />
    </ModalShell>
  );
}

function WantedModal({ citizenId, loading, onSubmit, onClose }: ModalProps) {
  const [reason, setReason] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  return (
    <ModalShell
      title="🚨 Poner en busca y captura"
      onClose={onClose}
      loading={loading}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit('/api/police/set-wanted', { citizenId, reason, vehiclePlate: vehiclePlate || undefined }, 'Busca y captura activada');
      }}
    >
      <label className="block text-xs text-slate-400">Motivo</label>
      <input required value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls()} />
      <label className="block text-xs text-slate-400">Matrícula del vehículo (opcional)</label>
      <input
        value={vehiclePlate}
        onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
        placeholder="Ej. 1234ABC"
        className={inputCls() + ' font-mono uppercase'}
      />
    </ModalShell>
  );
}
