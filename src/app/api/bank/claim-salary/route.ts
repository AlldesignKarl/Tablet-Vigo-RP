import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { sendDiscordLog } from '@/lib/discord';
import { centsToEuros } from '@/lib/format';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async () => {
  const { supabase, user } = await requireUser();
  await enforceRateLimit(supabase, `claim_salary:${user.id}`, 20, 300);

  // claim_salary() es SECURITY DEFINER y hace la comprobación de
  // "¿han pasado 48h?" de forma atómica en la base de datos (row lock),
  // así que no importa cuántas veces se llame ni desde cuántas
  // pestañas: nunca se paga dos veces el mismo sueldo.
  const { data, error } = await supabase.rpc('claim_salary');
  if (error) throw new ApiError(400, error.message);

  const result = data?.[0];
  if (!result) throw new ApiError(500, 'Respuesta inesperada del servidor.');

  if (result.paid && result.amount_cents > 0) {
    await sendDiscordLog({
      channel: 'webhook_sueldos',
      title: '💶 Sueldo pagado',
      description: `Se ha abonado ${centsToEuros(result.amount_cents)} a un ciudadano.`,
    });
  }

  return jsonOk(result);
});
