import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { searchCitizenSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';

// search_citizens_police() (security definer) compara por palabras
// sueltas y sin distinguir acentos, así que "Juan Perez" encuentra a
// "Juan Pérez" sin importar el orden de nombre/apellidos. Antes esto se
// filtraba aquí mismo con .ilike()/.or(), que fallaba en cuanto se
// buscaba el nombre completo de un tirón.
export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requirePolice();
  await enforceRateLimit(supabase, `police_search:${user.id}`, 60, 60);
  const body = searchCitizenSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('search_citizens_police', {
    p_query: body.query,
    p_by: body.by,
  });
  if (error) throw new ApiError(500, error.message);

  return jsonOk(data ?? []);
});
