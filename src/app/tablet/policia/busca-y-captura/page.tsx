import { createServerSupabaseClient } from '@/lib/supabase/server';
import PoliceWantedListPanel from '@/components/police/PoliceWantedListPanel';

export default async function PoliceWantedListPage() {
  const supabase = createServerSupabaseClient();
  const { data: wanted } = await supabase.from('wanted_active_view').select('*').order('created_at', { ascending: false });

  return <PoliceWantedListPanel wanted={wanted ?? []} />;
}
