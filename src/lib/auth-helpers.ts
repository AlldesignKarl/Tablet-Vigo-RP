import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Devuelve el usuario autenticado o lanza un ApiError 401.
 * Nunca confíes en un id de usuario que venga en el body de la
 * petición: siempre usa el que devuelve getUser() a partir de la
 * cookie de sesión verificada por Supabase.
 */
export async function requireUser() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError(401, 'No autenticado.');
  }

  return { supabase, user };
}

export async function requireProfileRole() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile) {
    throw new ApiError(403, 'Perfil no encontrado.');
  }
  return { supabase, user, role: profile.role };
}

/**
 * Comprueba autorización policial consultando la función de servidor
 * is_police_authorized(), que es la MISMA que usan las policies de RLS.
 * No duplicamos la lógica de "quién es policía" en JS: preguntamos a
 * la base de datos, que es la única fuente de verdad.
 */
export async function requirePolice() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.rpc('is_police_authorized');
  if (error || !data) {
    throw new ApiError(403, 'No tienes autorización policial.');
  }
  return { supabase, user };
}

export async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.rpc('is_admin');
  if (error || !data) {
    throw new ApiError(403, 'No tienes permisos de administrador.');
  }
  return { supabase, user };
}
