import { createServerSupabaseClient } from '@/lib/supabase/server';
import PoliceComplaintsPanel from '@/components/police/PoliceComplaintsPanel';

export default async function PoliceComplaintsPage() {
  const supabase = createServerSupabaseClient();
  const { data: complaints } = await supabase
    .from('complaints_view')
    .select('*')
    .order('created_at', { ascending: false });

  return <PoliceComplaintsPanel complaints={complaints ?? []} />;
}
