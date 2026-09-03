import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { removePointsSchema } from '@/lib/validation';
import { sendDiscordLog } from '@/lib/discord';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requirePolice();
  await enforceRateLimit(supabase, `police_action:${user.id}`, 60, 300);
  const body = removePointsSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('police_remove_points', {
    p_citizen_id: body.citizenId,
    p_points: body.points,
    p_reason: body.reason,
  });
  if (error) throw new ApiError(403, error.message);

  await sendDiscordLog({
    channel: 'webhook_policia',
    title: '🪪 Puntos del carnet retirados',
    description: `-${body.points} puntos · ${body.reason}`,
    color: 0x3b82f6,
  });

  return jsonOk({ pointsAfter: data });
});
