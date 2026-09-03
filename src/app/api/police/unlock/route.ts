import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { policeCodeSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requireUser();
  const body = policeCodeSchema.parse(await req.json());

  // El código nunca se compara en el frontend: redeem_police_code()
  // lo verifica en servidor contra un hash guardado en app_config y
  // aplica rate limiting para evitar fuerza bruta.
  const { data, error } = await supabase.rpc('redeem_police_code', {
    p_code: body.code,
    p_callsign: body.callsign,
  });
  if (error) throw new ApiError(400, error.message);

  const result = data?.[0];
  if (!result) throw new ApiError(500, 'Respuesta inesperada del servidor.');
  if (!result.success) throw new ApiError(403, result.message);

  return jsonOk(result);
});
