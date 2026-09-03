import { requireAdmin, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { adminAssignJobSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requireAdmin();
  const body = adminAssignJobSchema.parse(await req.json());

  const { error } = await supabase.rpc('admin_set_job', { p_profile_id: body.profileId, p_job_id: body.jobId });
  if (error) throw new ApiError(400, error.message);

  return jsonOk({ updated: true });
});
