import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { enforceRateLimit } from '@/lib/rate-limit';
import { searchCitizenSchema } from '@/lib/validation';

// Búsqueda de ciudadanos para elegir a quién denunciar. A diferencia de
// /api/police/search-citizen, cualquier ciudadano autenticado puede
// usarla, así que llama a search_citizens_public() (security definer),
// que solo expone campos mínimos para identificar a una persona (nombre,
// DNI, avatar) y nunca datos sensibles como saldo, puntos del carnet o si
// está en busca y captura.
export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requireUser();
  await enforceRateLimit(supabase, `denuncia_search:${user.id}`, 30, 60);
  const body = searchCitizenSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('search_citizens_public', {
    p_query: body.query,
    p_by: body.by,
  });
  if (error) throw new ApiError(500, error.message);

  return jsonOk(data ?? []);
});
