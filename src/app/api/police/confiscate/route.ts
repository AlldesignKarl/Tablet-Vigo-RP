import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { confiscateSchema } from '@/lib/validation';
import { sendDiscordLog } from '@/lib/discord';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requirePolice();
  await enforceRateLimit(supabase, `police_action:${user.id}`, 60, 300);
  const body = confiscateSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('police_confiscate', {
    p_citizen_id: body.citizenId,
    p_material: body.material,
    p_quantity: body.quantity,
    p_reason: body.reason,
  });
  if (error) throw new ApiError(403, error.message);

  await sendDiscordLog({
    channel: 'webhook_policia',
    title: '📦 Material incautado',
    description: `${body.material} (${body.quantity}) · ${body.reason}`,
    color: 0xf97316,
  });

  return jsonOk({ id: data }, 201);
});
