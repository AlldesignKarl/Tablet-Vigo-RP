import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { updateComplaintStatusSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requirePolice();
  const body = updateComplaintStatusSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('police_update_complaint_status', {
    p_complaint_id: body.complaintId,
    p_status: body.status,
  });
  if (error) throw new ApiError(400, error.message);

  const result = data?.[0];
  if (!result) throw new ApiError(500, 'Respuesta inesperada del servidor.');
  if (!result.success) throw new ApiError(400, result.message);

  return jsonOk(result);
});
