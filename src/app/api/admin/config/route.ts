import { requireAdmin, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { adminConfigSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requireAdmin();
  const body = adminConfigSchema.parse(await req.json());

  const { error } = await supabase.rpc('admin_set_config', { p_key: body.key, p_value: body.value });
  if (error) throw new ApiError(400, error.message);

  return jsonOk({ updated: true });
});
