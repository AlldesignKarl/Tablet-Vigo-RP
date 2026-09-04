import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { panelAdminPasswordSchema } from '@/lib/validation';

// Solo comprueba si la contraseña es correcta (para la pantalla de
// desbloqueo). La contraseña en sí nunca se guarda en el cliente: cada
// acción posterior del panel (cambiar tema, contraseña, rol...) vuelve a
// enviarla y a verificarla en el servidor.
export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requireUser();
  const body = panelAdminPasswordSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('verify_panel_admin_password', { p_password: body.password });
  if (error) throw new ApiError(400, error.message);

  return jsonOk({ correct: Boolean(data) });
});
