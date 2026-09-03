import { createServerSupabaseClient } from '@/lib/supabase/server';
import DiscordConfigPanel from '@/components/admin/DiscordConfigPanel';

export default async function AdminDiscordPage() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('app_config').select('value').eq('key', 'discord').maybeSingle();

  return <DiscordConfigPanel initialValue={(data?.value as Record<string, string | null>) ?? {}} />;
}
