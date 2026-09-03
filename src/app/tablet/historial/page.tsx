import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatDateTime, centsToEuros } from '@/lib/format';

interface TimelineEntry {
  id: string;
  icon: string;
  title: string;
  detail: string;
  createdAt: string;
  color: string;
}

export default async function HistorialPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [arrests, fines, confiscations, points, wanted] = await Promise.all([
    supabase.from('arrests').select('*').eq('citizen_id', user.id).order('created_at', { ascending: false }),
    supabase.from('fines').select('*').eq('citizen_id', user.id).order('created_at', { ascending: false }),
    supabase.from('confiscations').select('*').eq('citizen_id', user.id).order('created_at', { ascending: false }),
    supabase.from('license_points_history').select('*').eq('citizen_id', user.id).order('created_at', { ascending: false }),
    supabase.from('wanted_persons').select('*').eq('citizen_id', user.id).order('created_at', { ascending: false }),
  ]);

  const entries: TimelineEntry[] = [
    ...(arrests.data ?? []).map((a) => ({
      id: `arrest-${a.id}`,
      icon: '🚔',
      title: 'Arresto',
      detail: `${a.reason} · ${a.duration_minutes} min`,
      createdAt: a.created_at,
      color: 'border-danger-500/30',
    })),
    ...(fines.data ?? []).map((f) => ({
      id: `fine-${f.id}`,
      icon: '💸',
      title: `Multa (${f.status})`,
      detail: `${f.reason} · ${centsToEuros(f.amount_cents)}`,
      createdAt: f.created_at,
      color: 'border-yellow-500/30',
    })),
    ...(confiscations.data ?? []).map((c) => ({
      id: `conf-${c.id}`,
      icon: '📦',
      title: 'Incautación de material',
      detail: `${c.material} (${c.quantity}) · ${c.reason}`,
      createdAt: c.created_at,
      color: 'border-orange-500/30',
    })),
    ...(points.data ?? []).map((p) => ({
      id: `points-${p.id}`,
      icon: '🪪',
      title: `-${p.points_removed} puntos del carnet`,
      detail: `${p.reason} · quedan ${p.points_after}`,
      createdAt: p.created_at,
      color: 'border-accent-500/30',
    })),
    ...(wanted.data ?? []).map((w) => ({
      id: `wanted-${w.id}`,
      icon: '🚨',
      title: w.active ? 'Busca y captura activada' : 'Busca y captura retirada',
      detail: w.reason,
      createdAt: w.created_at,
      color: 'border-danger-500/40',
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">⚖️ Historial</h1>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">Sin antecedentes registrados.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className={`hud-panel flex items-start gap-3 border p-4 ${e.color}`}>
              <span className="text-xl">{e.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{e.title}</p>
                <p className="text-sm text-slate-400">{e.detail}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-500">{formatDateTime(e.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
