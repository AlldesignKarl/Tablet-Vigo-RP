import { createServerSupabaseClient } from '@/lib/supabase/server';
import PoliceMapaPanel from '@/components/police/PoliceMapaPanel';

export default async function PoliceMapaPage() {
  const supabase = createServerSupabaseClient();
  const { data: markers } = await supabase.from('map_markers').select('*').order('created_at', { ascending: false });

  return <PoliceMapaPanel initialMarkers={markers ?? []} />;
}
