import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { enforceRateLimit } from '@/lib/rate-limit';
import { createInternalAffairsPostSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requirePolice();
  await enforceRateLimit(supabase, `internal_affairs_post:${user.id}`, 30, 60);
  const body = createInternalAffairsPostSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('post_internal_affairs_message', { p_message: body.message });
  if (error) throw new ApiError(400, error.message);

  const post = data?.[0];
  if (!post) throw new ApiError(500, 'Respuesta inesperada del servidor.');

  return jsonOk(post, 201);
});
