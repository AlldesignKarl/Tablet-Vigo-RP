import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { searchCitizenSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requirePolice();
  await enforceRateLimit(supabase, `police_search:${user.id}`, 60, 60);
  const body = searchCitizenSchema.parse(await req.json());
  const q = `%${body.query.toLowerCase()}%`;

  let query = supabase.from('citizen_profile_view').select('*').limit(25);

  if (body.by === 'dni') {
    query = query.ilike('dni_number', q);
  } else if (body.by === 'roblox') {
    query = query.ilike('roblox_username', q);
  } else {
    query = query.or(`first_name.ilike.${q},last_name.ilike.${q},full_name.ilike.${q}`);
  }

  const { data, error } = await query;
  if (error) throw new ApiError(500, error.message);

  return jsonOk(data ?? []);
});
