import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';

// Nunca debe pre-renderizarse/cachearse: cada invocación debe ejecutar el
// pago de sueldos en tiempo real.
export const dynamic = 'force-dynamic';

/**
 * Endpoint pensado para ser invocado por un cron (Vercel Cron u otro
 * programador externo) para pagar automáticamente el sueldo a todos
 * los ciudadanos cuyo `next_salary_payment` ya haya vencido, sin que
 * nadie necesite abrir la tablet. Ver vercel.json.
 *
 * Protegido por CRON_SECRET: sin ese secreto, nadie puede disparar
 * pagos masivos desde fuera.
 */
export async function GET(request: Request) {
  if (serverEnv.cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${serverEnv.cronSecret}`) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc('pay_all_due_salaries');

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, paidAccounts: data });
}
