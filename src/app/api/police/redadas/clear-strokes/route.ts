import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { clearRaidStrokesSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requirePolice();
  const body = clearRaidStrokesSchema.parse(await req.json());

  const { error } = await supabase.rpc('clear_raid_strokes', { p_raid_id: body.raidId });
  if (error) throw new ApiError(400, error.message);

  return jsonOk({ cleared: true });
});
