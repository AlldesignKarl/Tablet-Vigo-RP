'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { centsToEuros, formatDateTime, timeUntil } from '@/lib/format';
import { useToast } from '@/components/ui/ToastProvider';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { Database } from '@/types/database';

type Transaction = Database['public']['Tables']['bank_transactions']['Row'];
type Fine = Database['public']['Tables']['fines']['Row'];

const TX_LABELS: Record<Transaction['type'], string> = {
  salario: 'Sueldo',
  compra_tienda: 'Compra en tienda',
  compra_licencia: 'Compra de licencia',
  pago_multa: 'Pago de multa',
  ajuste_admin: 'Ajuste administrativo',
};

export default function BankPanel({
  profile,
  transactions,
  pendingFines,
}: {
  profile: {
    balanceCents: number;
    jobName: string | null;
    salaryCents: number;
    nextSalaryPayment: string | null;
    lastSalaryPayment: string | null;
  };
  transactions: Transaction[];
  pendingFines: Fine[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [claiming, setClaiming] = useState(false);
  const [fineToPay, setFineToPay] = useState<Fine | null>(null);
  const [payAll, setPayAll] = useState(false);
  const [paying, setPaying] = useState(false);
  const salaryReady = profile.nextSalaryPayment ? new Date(profile.nextSalaryPayment).getTime() <= Date.now() : false;
  const totalFinesCents = pendingFines.reduce((sum, f) => sum + f.amount_cents, 0);

  // Comprobación silenciosa al entrar: si el sueldo ya está vencido, se
  // cobra automáticamente. La operación es atómica en el servidor, así
  // que recargar la página o llamarla varias veces nunca duplica el pago.
  useEffect(() => {
    if (salaryReady) claimSalary(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function claimSalary(silent = false) {
    setClaiming(true);
    try {
      const res = await fetch('/api/bank/claim-salary', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        if (!silent) push({ kind: 'error', title: 'No se pudo cobrar el sueldo', message: json.error });
        return;
      }
      if (json.data.paid) {
        push({
          kind: 'success',
          title: 'Sueldo cobrado',
          message: `Se han añadido ${centsToEuros(json.data.amount_cents)} a tu banco.`,
        });
        router.refresh();
      } else if (!silent) {
        push({ kind: 'info', title: 'Sueldo no disponible todavía', message: 'Vuelve a intentarlo más tarde.' });
      }
    } finally {
      setClaiming(false);
    }
  }

  async function payOneFine(fineId: string) {
    const res = await fetch('/api/bank/pay-fine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fineId }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error ?? 'No se pudo pagar la multa.');
  }

  async function payFine() {
    if (!fineToPay) return;
    setPaying(true);
    try {
      await payOneFine(fineToPay.id);
      push({ kind: 'success', title: 'Multa pagada', message: `Se han descontado ${centsToEuros(fineToPay.amount_cents)}.` });
      setFineToPay(null);
      router.refresh();
    } catch (err) {
      push({ kind: 'error', title: 'No se pudo pagar la multa', message: err instanceof Error ? err.message : undefined });
    } finally {
      setPaying(false);
    }
  }

  async function payAllFines() {
    setPaying(true);
    try {
      // Se pagan una a una (cada llamada es atómica en servidor) para que,
      // si el saldo no llega para todas, las que sí se puedan pagar queden
      // pagadas en vez de perderse por un fallo de todo-o-nada.
      let paidCount = 0;
      for (const fine of pendingFines) {
        try {
          await payOneFine(fine.id);
          paidCount += 1;
        } catch {
          break;
        }
      }
      if (paidCount === 0) {
        push({ kind: 'error', title: 'No se pudo pagar ninguna multa', message: 'Comprueba tu saldo disponible.' });
      } else if (paidCount < pendingFines.length) {
        push({
          kind: 'info',
          title: 'Pago parcial',
          message: `Se pagaron ${paidCount} de ${pendingFines.length} multas. El saldo no llegó para el resto.`,
        });
      } else {
        push({ kind: 'success', title: 'Todas las multas pagadas', message: `Se han descontado ${centsToEuros(totalFinesCents)}.` });
      }
      setPayAll(false);
      router.refresh();
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200">
          <Landmark className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-xl font-bold text-white">Banco</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="hud-panel p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Saldo disponible</p>
          <p className="mt-1 text-2xl font-bold text-white">{centsToEuros(profile.balanceCents)}</p>
        </div>
        <div className="hud-panel p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Empleo actual</p>
          <p className="mt-1 text-lg font-semibold text-white">{profile.jobName ?? 'Desempleado'}</p>
          <p className="text-xs text-slate-400">{centsToEuros(profile.salaryCents)} / 48h</p>
        </div>
        <div className="hud-panel flex flex-col justify-between p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Próximo sueldo</p>
            <p className="mt-1 text-lg font-semibold text-white">{timeUntil(profile.nextSalaryPayment)}</p>
          </div>
          <button
            onClick={() => claimSalary(false)}
            disabled={claiming}
            className="mt-3 rounded-lg bg-accent-600 py-2 text-xs font-semibold text-white transition hover:bg-accent-500 disabled:opacity-50"
          >
            {claiming ? 'Comprobando…' : 'Cobrar sueldo'}
          </button>
        </div>
      </div>

      {pendingFines.length > 0 && (
        <div className="hud-panel p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-white">Multas pendientes</h2>
            {pendingFines.length > 1 && (
              <button
                onClick={() => setPayAll(true)}
                className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-1.5 text-xs font-semibold text-danger-500 transition hover:bg-danger-500/20"
              >
                Pagar todas ({centsToEuros(totalFinesCents)})
              </button>
            )}
          </div>
          <div className="space-y-2">
            {pendingFines.map((fine) => (
              <div key={fine.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div>
                  <p className="text-sm text-white">{fine.reason}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(fine.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-danger-500">{centsToEuros(fine.amount_cents)}</span>
                  <button
                    onClick={() => setFineToPay(fine)}
                    className="rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-500"
                  >
                    Pagar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="hud-panel p-5">
        <h2 className="mb-3 font-semibold text-white">Movimientos</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay movimientos.</p>
        ) : (
          <div className="space-y-1">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
                <div>
                  <p className="text-white">{TX_LABELS[tx.type] ?? tx.type}</p>
                  <p className="text-xs text-slate-500">{tx.description}</p>
                </div>
                <div className="text-right">
                  <p className={tx.amount_cents >= 0 ? 'font-semibold text-success-500' : 'font-semibold text-danger-500'}>
                    {tx.amount_cents >= 0 ? '+' : ''}
                    {centsToEuros(tx.amount_cents)}
                  </p>
                  <p className="text-[10px] text-slate-500">{formatDateTime(tx.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!fineToPay}
        title="Pagar multa"
        description={fineToPay ? `Se descontarán ${centsToEuros(fineToPay.amount_cents)} de tu banco.` : ''}
        confirmLabel="Pagar"
        loading={paying}
        onConfirm={payFine}
        onCancel={() => setFineToPay(null)}
      />

      <ConfirmDialog
        open={payAll}
        title="Pagar todas las multas"
        description={`Se intentarán pagar ${pendingFines.length} multas por un total de ${centsToEuros(totalFinesCents)}. Si no te llega el saldo para todas, se pagarán las que puedas permitirte.`}
        confirmLabel="Pagar todas"
        loading={paying}
        onConfirm={payAllFines}
        onCancel={() => setPayAll(false)}
      />
    </div>
  );
}
