import { createServerSupabaseClient } from '@/lib/supabase/server';
import PoliceWeaponsPanel from '@/components/police/PoliceWeaponsPanel';

export default async function PoliceArmasPage() {
  const supabase = createServerSupabaseClient();
  const { data: weapons } = await supabase.rpc('police_list_weapons');

  return <PoliceWeaponsPanel weapons={weapons ?? []} />;
}
