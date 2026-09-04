import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { deleteMapMarkerSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requirePolice();
  const body = deleteMapMarkerSchema.parse(await req.json());

  const { error } = await supabase.rpc('police_delete_map_marker', { p_marker_id: body.markerId });
  if (error) throw new ApiError(400, error.message);

  return jsonOk({ deleted: true });
});
