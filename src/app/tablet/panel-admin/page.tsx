import { createServerSupabaseClient } from '@/lib/supabase/server';
import PanelAdminGate from '@/components/panel-admin/PanelAdminGate';

export default async function PanelAdminPage() {
  const supabase = createServerSupabaseClient();
  const [{ data: jobs }, { data: theme }] = await Promise.all([
    supabase.from('jobs').select('id, code, name, salary_cents').order('name'),
    supabase.rpc('get_tablet_theme'),
  ]);

  return <PanelAdminGate jobs={jobs ?? []} initialTheme={theme === 'light' ? 'light' : 'dark'} />;
}
