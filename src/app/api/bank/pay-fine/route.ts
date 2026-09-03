import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { payFineSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requireUser();
  await enforceRateLimit(supabase, `pay_fine:${user.id}`, 30, 300);
  const body = payFineSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('pay_fine', { p_fine_id: body.fineId });
  if (error) throw new ApiError(400, error.message);

  const result = data?.[0];
  if (!result) throw new ApiError(500, 'Respuesta inesperada del servidor.');
  if (!result.success) throw new ApiError(400, result.message);

  return jsonOk(result);
});
