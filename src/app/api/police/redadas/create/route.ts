import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { createRaidSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requirePolice();
  const body = createRaidSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('create_raid', { p_title: body.title, p_notes: body.notes });
  if (error) throw new ApiError(400, error.message);

  const raid = data?.[0];
  if (!raid) throw new ApiError(500, 'Respuesta inesperada del servidor.');

  return jsonOk(raid, 201);
});
