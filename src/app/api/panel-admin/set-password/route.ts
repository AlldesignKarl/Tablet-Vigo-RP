import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling, getClientIp } from '@/lib/api-helpers';
import { panelAdminSetPasswordSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requireUser();
  const body = panelAdminSetPasswordSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('panel_admin_set_password', {
    p_current_password: body.currentPassword,
    p_new_password: body.newPassword,
    p_client_key: getClientIp(req),
  });
  if (error) throw new ApiError(400, error.message);

  const result = data?.[0];
  if (!result) throw new ApiError(500, 'Respuesta inesperada del servidor.');
  if (!result.success) throw new ApiError(403, result.message);

  return jsonOk(result);
});
