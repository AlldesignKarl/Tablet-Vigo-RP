import { createServerSupabaseClient } from '@/lib/supabase/server';
import VehiclesPanel from '@/components/vehicles/VehiclesPanel';

export default async function VehiclesPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .eq('profile_id', user.id)
    .order('registered_at', { ascending: false });

  return <VehiclesPanel vehicles={vehicles ?? []} />;
}
