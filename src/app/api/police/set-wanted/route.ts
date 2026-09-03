import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { wantedSchema } from '@/lib/validation';
import { sendDiscordLog } from '@/lib/discord';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requirePolice();
  await enforceRateLimit(supabase, `police_action:${user.id}`, 60, 300);
  const body = wantedSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('police_set_wanted', {
    p_citizen_id: body.citizenId,
    p_reason: body.reason,
    p_vehicle_plate: body.vehiclePlate || null,
  });
  if (error) throw new ApiError(403, error.message);

  await sendDiscordLog({
    channel: 'webhook_policia',
    title: '🚨 BUSCA Y CAPTURA activada',
    description: body.reason,
    color: 0xdc2626,
  });

  return jsonOk({ id: data }, 201);
});
