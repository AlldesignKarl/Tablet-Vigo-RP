import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { deleteVehicleSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requireUser();
  await enforceRateLimit(supabase, `vehicle_delete:${user.id}`, 20, 3600);
  const body = deleteVehicleSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('delete_vehicle', { p_vehicle_id: body.vehicleId });
  if (error) throw new ApiError(400, error.message);

  const result = data?.[0];
  if (!result) throw new ApiError(500, 'Respuesta inesperada del servidor.');
  if (!result.success) throw new ApiError(400, result.message);

  return jsonOk(result);
});
