import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling, getClientIp } from '@/lib/api-helpers';
import { panelAdminPasswordSchema } from '@/lib/validation';

// Solo comprueba si la contraseña es correcta (para la pantalla de
// desbloqueo). La contraseña en sí nunca se guarda en el cliente: cada
// acción posterior del panel (cambiar tema, contraseña, rol...) vuelve a
// enviarla y a verificarla en el servidor.
export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requireUser();
  const body = panelAdminPasswordSchema.parse(await req.json());

  // La IP se pasa como clave adicional de límite de intentos: el propio
  // uid de una sesión anónima se puede renovar sin esfuerzo (basta con
  // borrar cookies), así que atar el límite solo a él no frena de verdad
  // a quien prueba contraseñas al azar.
  const { data, error } = await supabase.rpc('verify_panel_admin_password', {
    p_password: body.password,
    p_client_key: getClientIp(req),
  });
  if (error) throw new ApiError(400, error.message);

  return jsonOk({ correct: Boolean(data) });
});
