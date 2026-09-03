import { z } from 'zod';
import { requireUser } from '@/lib/auth-helpers';
import { jsonOk, jsonError, withErrorHandling } from '@/lib/api-helpers';
import { lookupRobloxUser } from '@/lib/roblox';
import { enforceRateLimit } from '@/lib/rate-limit';

const schema = z.object({ username: z.string().trim().min(3).max(30) });

export const POST = withErrorHandling(async (req) => {
  // Requiere sesión (evita que la app se use como proxy anónimo abierto
  // hacia la API de Roblox).
  const { supabase, user } = await requireUser();
  await enforceRateLimit(supabase, `roblox_lookup:${user.id}`, 15, 300);

  const body = schema.parse(await req.json());
  const profile = await lookupRobloxUser(body.username);

  if (!profile) {
    return jsonError('Usuario de Roblox no encontrado', 404);
  }

  return jsonOk(profile);
});
