import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { fileComplaintSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requireUser();
  const body = fileComplaintSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('file_complaint', {
    p_accused_description: body.accusedDescription,
    p_reason: body.reason,
  });
  if (error) throw new ApiError(400, error.message);

  const result = data?.[0];
  if (!result) throw new ApiError(500, 'Respuesta inesperada del servidor.');
  if (!result.success) throw new ApiError(400, result.message);

  return jsonOk(result);
});
