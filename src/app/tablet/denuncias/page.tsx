import { createServerSupabaseClient } from '@/lib/supabase/server';
import DenunciasPanel from '@/components/denuncias/DenunciasPanel';

export default async function DenunciasPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: myComplaints } = await supabase
    .from('complaints_view')
    .select('*')
    .eq('reporter_id', user.id)
    .order('created_at', { ascending: false });

  return <DenunciasPanel myComplaints={myComplaints ?? []} />;
}
