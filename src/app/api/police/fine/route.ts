import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { fineSchema } from '@/lib/validation';
import { sendDiscordLog } from '@/lib/discord';
import { centsToEuros, eurosToCents } from '@/lib/format';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requirePolice();
  await enforceRateLimit(supabase, `police_action:${user.id}`, 60, 300);
  const body = fineSchema.parse(await req.json());
  const amountCents = eurosToCents(body.amountEuros);

  const { data, error } = await supabase.rpc('police_fine', {
    p_citizen_id: body.citizenId,
    p_reason: body.reason,
    p_amount_cents: amountCents,
  });
  if (error) throw new ApiError(403, error.message);

  await sendDiscordLog({
    channel: 'webhook_policia',
    title: '💸 Multa registrada',
    description: `Motivo: ${body.reason}`,
    fields: [{ name: 'Importe', value: centsToEuros(amountCents), inline: true }],
    color: 0xf59e0b,
  });

  return jsonOk({ id: data }, 201);
});
