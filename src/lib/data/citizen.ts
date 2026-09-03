import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type CitizenProfile = Database['public']['Views']['citizen_profile_view']['Row'];

export async function getCitizenProfile(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<CitizenProfile | null> {
  const { data } = await supabase.from('citizen_profile_view').select('*').eq('profile_id', profileId).maybeSingle();
  return data ?? null;
}
