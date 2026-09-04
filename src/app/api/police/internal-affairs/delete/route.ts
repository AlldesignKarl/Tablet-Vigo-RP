import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { deleteInternalAffairsPostSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requirePolice();
  const body = deleteInternalAffairsPostSchema.parse(await req.json());

  const { error } = await supabase.rpc('delete_internal_affairs_message', { p_id: body.postId });
  if (error) throw new ApiError(400, error.message);

  return jsonOk({ deleted: true });
});
