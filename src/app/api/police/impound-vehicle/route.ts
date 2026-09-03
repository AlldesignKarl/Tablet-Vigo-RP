import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { impoundVehicleSchema } from '@/lib/validation';
import { sendDiscordLog } from '@/lib/discord';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requirePolice();
  await enforceRateLimit(supabase, `police_action:${user.id}`, 60, 300);
  const body = impoundVehicleSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('police_impound_vehicle', {
    p_vehicle_id: body.vehicleId,
    p_reason: body.reason,
  });
  if (error) throw new ApiError(403, error.message);

  await sendDiscordLog({
    channel: 'webhook_policia',
    title: '🚗 Vehículo incautado',
    description: body.reason,
    color: 0xdc2626,
  });

  return jsonOk({ id: data }, 201);
});
