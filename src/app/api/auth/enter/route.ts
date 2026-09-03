import { createServerSupabaseClient } from '@/lib/supabase/server';
import { jsonOk, jsonError, withErrorHandling } from '@/lib/api-helpers';

/**
 * Crea (o reutiliza) la sesión anónima del ciudadano.
 *
 * Se hace desde el servidor, no desde el navegador, a propósito: una
 * llamada del navegador directamente a la API de Supabase Auth es una
 * petición cross-origin sujeta a CORS y a la red del propio visitante;
 * una llamada del navegador a esta misma ruta (mismo origen que la
 * tablet) nunca tiene ese problema, y aquí dentro hablamos con Supabase
 * servidor-a-servidor, donde CORS no existe.
 */
export const POST = withErrorHandling(async () => {
  const supabase = createServerSupabaseClient();

  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  if (existingUser) {
    return jsonOk({ alreadySignedIn: true });
  }

  const { error } = await supabase.auth.signInAnonymously();

  if (error) {
    console.error('[api/auth/enter] signInAnonymously failed', error);
    return jsonError(error.message, 400);
  }

  return jsonOk({ alreadySignedIn: false });
});
