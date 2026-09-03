import { createServerSupabaseClient } from '@/lib/supabase/server';
import GeneralConfigPanel from '@/components/admin/GeneralConfigPanel';

export default async function AdminConfigPage() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('app_config').select('value').eq('key', 'general').maybeSingle();

  return (
    <GeneralConfigPanel initialPoints={Number((data?.value as { initial_license_points?: number })?.initial_license_points ?? 12)} />
  );
}
