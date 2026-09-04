import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { publicEnv } from '@/lib/env';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith('/tablet') || path.startsWith('/admin');

  // Todo envuelto en try/catch a propósito: si Supabase (o cualquier
  // cosa de aquí) falla de forma inesperada, esto NO debe tumbar toda la
  // ruta con un 500 de "Routing Middleware crashed". Cada página
  // protegida vuelve a comprobar el usuario y el rol en servidor de
  // todas formas (ver comentario más abajo), así que lo peor que puede
  // pasar si esto falla es perder ese primer filtro, no dejar de estar
  // protegido de verdad.
  try {
    let response = NextResponse.next({ request });

    const supabase = createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (isProtected && !user) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('next', path);
      return NextResponse.redirect(redirectUrl);
    }

    // La comprobación de ROL (policía/admin) se hace siempre en servidor
    // dentro de cada página/API con la clave anónima + RLS, nunca aquí,
    // para no duplicar lógica de permisos en dos sitios distintos.

    return response;
  } catch (err) {
    console.error('[middleware] fallo inesperado comprobando la sesión', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/tablet/:path*', '/admin/:path*'],
};
