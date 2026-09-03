import { createServerSupabaseClient } from '@/lib/supabase/server';
import UsersAdminPanel from '@/components/admin/UsersAdminPanel';

export default async function AdminUsersPage() {
  const supabase = createServerSupabaseClient();
  const { data: profiles } = await supabase.from('profiles').select('id, role, display_name, created_at').order('created_at', { ascending: false });

  const ids = (profiles ?? []).map((p) => p.id);
  const { data: dnis } = ids.length
    ? await supabase.from('dnis').select('profile_id, first_name, last_name, dni_number, roblox_username').in('profile_id', ids)
    : { data: [] };

  return <UsersAdminPanel profiles={profiles ?? []} dnis={dnis ?? []} />;
}
