import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { createMapMarkerSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requirePolice();
  await enforceRateLimit(supabase, `map_marker_create:${user.id}`, 30, 60);
  const body = createMapMarkerSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('police_create_map_marker', {
    p_type: body.type,
    p_x: body.x,
    p_y: body.y,
    p_note: body.note || null,
  });
  if (error) throw new ApiError(400, error.message);

  const marker = data?.[0];
  if (!marker) throw new ApiError(500, 'Respuesta inesperada del servidor.');

  return jsonOk(marker, 201);
});
