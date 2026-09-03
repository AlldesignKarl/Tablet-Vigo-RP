import { requireAdmin, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { adminRoleSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requireAdmin();
  const body = adminRoleSchema.parse(await req.json());

  const { error } = await supabase.rpc('admin_set_role', { p_profile_id: body.profileId, p_role: body.role });
  if (error) throw new ApiError(400, error.message);

  return jsonOk({ updated: true });
});
