import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { releaseVehicleSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requirePolice();
  await enforceRateLimit(supabase, `police_action:${user.id}`, 60, 300);
  const body = releaseVehicleSchema.parse(await req.json());

  const { error } = await supabase.rpc('police_release_vehicle', { p_vehicle_id: body.vehicleId });
  if (error) throw new ApiError(403, error.message);

  return jsonOk({ released: true });
});
