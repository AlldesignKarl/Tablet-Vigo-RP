import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { addRaidStrokeSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requirePolice();
  const body = addRaidStrokeSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('add_raid_stroke', {
    p_raid_id: body.raidId,
    p_points: body.points,
    p_color: body.color,
  });
  if (error) throw new ApiError(400, error.message);

  const stroke = data?.[0];
  if (!stroke) throw new ApiError(500, 'Respuesta inesperada del servidor.');

  return jsonOk(stroke, 201);
});
