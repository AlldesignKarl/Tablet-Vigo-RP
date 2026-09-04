import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling, getClientIp } from '@/lib/api-helpers';
import { enforceRateLimit } from '@/lib/rate-limit';
import { panelAdminSearchSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requireUser();
  await enforceRateLimit(supabase, `panel_admin_search:${user.id}`, 60, 60);
  const body = panelAdminSearchSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('panel_admin_search_citizens', {
    p_password: body.password,
    p_query: body.query,
    p_client_key: getClientIp(req),
  });
  if (error) throw new ApiError(403, error.message);

  return jsonOk(data ?? []);
});
