import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { searchPlateSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requirePolice();
  await enforceRateLimit(supabase, `police_search:${user.id}`, 60, 60);
  const body = searchPlateSchema.parse(await req.json());

  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*')
    .ilike('plate', `%${body.plate.toUpperCase()}%`)
    .limit(25);
  if (error) throw new ApiError(500, error.message);

  const ownerIds = [...new Set((vehicles ?? []).map((v) => v.profile_id))];
  const { data: owners } = ownerIds.length
    ? await supabase.from('citizen_profile_view').select('*').in('profile_id', ownerIds)
    : { data: [] };

  const ownerMap = new Map((owners ?? []).map((o) => [o.profile_id, o]));

  const results = (vehicles ?? []).map((v) => ({
    vehicle: v,
    owner: ownerMap.get(v.profile_id) ?? null,
  }));

  return jsonOk(results);
});
