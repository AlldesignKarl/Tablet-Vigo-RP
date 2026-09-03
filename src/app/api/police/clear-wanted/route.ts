import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { clearWantedSchema } from '@/lib/validation';
import { sendDiscordLog } from '@/lib/discord';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requirePolice();
  await enforceRateLimit(supabase, `police_action:${user.id}`, 60, 300);
  const body = clearWantedSchema.parse(await req.json());

  const { error } = await supabase.rpc('police_clear_wanted', { p_citizen_id: body.citizenId });
  if (error) throw new ApiError(403, error.message);

  await sendDiscordLog({
    channel: 'webhook_policia',
    title: '✅ Busca y captura retirada',
    description: 'Se ha retirado la busca y captura de un ciudadano.',
    color: 0x22c55e,
  });

  return jsonOk({ cleared: true });
});
