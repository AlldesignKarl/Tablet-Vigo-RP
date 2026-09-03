import { requireAdmin, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { adminPoliceCodeSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requireAdmin();
  const body = adminPoliceCodeSchema.parse(await req.json());

  const { error } = await supabase.rpc('admin_set_police_code', { p_code: body.code });
  if (error) throw new ApiError(400, error.message);

  return jsonOk({ updated: true });
});
