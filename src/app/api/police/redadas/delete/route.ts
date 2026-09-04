import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { deleteRaidSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requirePolice();
  const body = deleteRaidSchema.parse(await req.json());

  const { error } = await supabase.rpc('delete_raid', { p_raid_id: body.raidId });
  if (error) throw new ApiError(400, error.message);

  return jsonOk({ deleted: true });
});
