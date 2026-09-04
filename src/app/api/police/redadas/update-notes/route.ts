import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { updateRaidNotesSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (req) => {
  const { supabase } = await requirePolice();
  const body = updateRaidNotesSchema.parse(await req.json());

  const { error } = await supabase.rpc('update_raid_notes', { p_raid_id: body.raidId, p_notes: body.notes });
  if (error) throw new ApiError(400, error.message);

  return jsonOk({ saved: true });
});
