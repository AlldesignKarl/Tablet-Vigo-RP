import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { panelAdminSetJobSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requireUser();
  const body = panelAdminSetJobSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('panel_admin_set_job', {
    p_password: body.password,
    p_profile_id: body.profileId,
    p_job_id: body.jobId,
  });
  if (error) throw new ApiError(400, error.message);

  const result = data?.[0];
  if (!result) throw new ApiError(500, 'Respuesta inesperada del servidor.');
  if (!result.success) throw new ApiError(403, result.message);

  return jsonOk(result);
});
