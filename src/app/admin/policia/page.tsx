import { createServerSupabaseClient } from '@/lib/supabase/server';
import PoliceUsersAdminPanel from '@/components/admin/PoliceUsersAdminPanel';
import PoliceCodeForm from '@/components/admin/PoliceCodeForm';

export default async function AdminPolicePage() {
  const supabase = createServerSupabaseClient();
  const { data: policeUsers } = await supabase.from('police_users').select('*').order('created_at', { ascending: false });

  const profileIds = (policeUsers ?? []).map((p) => p.profile_id);
  const { data: dnis } = profileIds.length
    ? await supabase.from('dnis').select('profile_id, first_name, last_name, dni_number').in('profile_id', profileIds)
    : { data: [] };

  return (
    <div className="space-y-10">
      <PoliceCodeForm />
      <PoliceUsersAdminPanel policeUsers={policeUsers ?? []} dnis={dnis ?? []} />
    </div>
  );
}
