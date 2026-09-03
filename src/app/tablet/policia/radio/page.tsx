import { createServerSupabaseClient } from '@/lib/supabase/server';
import RadioPanel from '@/components/police/RadioPanel';

export default async function RadioPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: messages }, { data: myCallsign }] = await Promise.all([
    supabase.from('radio_messages').select('*').eq('channel', 'general').order('created_at', { ascending: false }).limit(60),
    supabase.from('police_users').select('callsign').eq('profile_id', user?.id ?? '').maybeSingle(),
  ]);

  return <RadioPanel initialMessages={(messages ?? []).reverse()} callsign={myCallsign?.callsign ?? 'DESCONOCIDO'} />;
}
