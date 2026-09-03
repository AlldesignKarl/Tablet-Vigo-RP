import { createServerSupabaseClient } from '@/lib/supabase/server';
import RadioPanel from '@/components/police/RadioPanel';

export default async function RadioPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myCallsign } = await supabase
    .from('police_users')
    .select('callsign')
    .eq('profile_id', user?.id ?? '')
    .maybeSingle();

  return <RadioPanel callsign={myCallsign?.callsign ?? 'DESCONOCIDO'} />;
}
