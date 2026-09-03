import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/auth-helpers';

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Envuelve un handler de API para centralizar el manejo de errores:
 * ApiError -> código HTTP correspondiente, ZodError -> 400 con detalle,
 * cualquier otro error -> 500 genérico (sin filtrar detalles internos).
 */
export function withErrorHandling(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (err) {
      if (err instanceof ApiError) {
        return jsonError(err.message, err.status);
      }
      if (err instanceof ZodError) {
        return jsonError(err.issues.map((i) => i.message).join(' '), 400);
      }
      console.error('[api-error]', err);
      return jsonError('Error interno del servidor.', 500);
    }
  };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? 'desconocida';
}
