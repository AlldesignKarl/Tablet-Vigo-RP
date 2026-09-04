import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';

export const POST = withErrorHandling(async () => {
  const { supabase } = await requirePolice();

  const { error } = await supabase.rpc('police_clear_all_map_markers');
  if (error) throw new ApiError(400, error.message);

  return jsonOk({ cleared: true });
});
