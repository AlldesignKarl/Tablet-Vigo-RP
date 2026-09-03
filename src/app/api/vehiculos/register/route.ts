import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { registerVehicleSchema } from '@/lib/validation';
import { sendDiscordLog } from '@/lib/discord';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requireUser();
  await enforceRateLimit(supabase, `vehicle_register:${user.id}`, 10, 3600);
  const body = registerVehicleSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('register_vehicle', {
    p_plate: body.plate,
    p_brand: body.brand,
    p_model: body.model,
    p_color: body.color,
  });
  if (error) throw new ApiError(400, error.message);

  const result = data?.[0];
  if (!result) throw new ApiError(500, 'Respuesta inesperada del servidor.');
  if (!result.success) throw new ApiError(400, result.message);

  await sendDiscordLog({
    channel: 'webhook_vehiculos',
    title: '🚗 Vehículo registrado',
    description: `Matrícula **${body.plate.toUpperCase()}** (${body.brand} ${body.model}) registrada.`,
  });

  return jsonOk(result, 201);
});
