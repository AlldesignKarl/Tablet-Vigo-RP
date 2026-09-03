import { createServerSupabaseClient } from '@/lib/supabase/server';
import JobsAdminPanel from '@/components/admin/JobsAdminPanel';

export default async function AdminJobsPage() {
  const supabase = createServerSupabaseClient();
  const { data: jobs } = await supabase.from('jobs').select('*').order('salary_cents');
  return <JobsAdminPanel jobs={jobs ?? []} />;
}
