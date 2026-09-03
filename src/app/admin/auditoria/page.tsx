import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/format';

export default async function AdminAuditPage() {
  const supabase = createServerSupabaseClient();
  const { data: logs } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Auditoría</h2>
      <p className="text-sm text-slate-400">
        Registro de solo lectura. Nadie puede editar ni borrar estas entradas, ni siquiera desde
        este panel.
      </p>
      <div className="hud-panel divide-y divide-white/5">
        {(logs ?? []).map((log) => (
          <div key={log.id} className="p-3 text-sm">
            <p className="text-white">
              <span className="font-mono font-bold text-accent-400">{log.actor_label ?? 'Sistema'}</span> — {log.action}
              {log.target ? ` · ${log.target}` : ''}
            </p>
            <p className="text-xs text-slate-500">{formatDateTime(log.created_at)}</p>
          </div>
        ))}
        {(!logs || logs.length === 0) && <p className="p-4 text-sm text-slate-500">Sin registros todavía.</p>}
      </div>
    </div>
  );
}
