import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCitizenProfile } from '@/lib/data/citizen';
import TabletShell from '@/components/tablet/TabletShell';

export default async function TabletLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const profile = await getCitizenProfile(supabase, user.id);
  if (!profile) redirect('/onboarding');

  const [{ data: isPolice }, { data: profileRow }] = await Promise.all([
    supabase.rpc('is_police_authorized'),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ]);

  const isAdmin = profileRow?.role === 'admin' || profileRow?.role === 'fundador';

  return (
    <TabletShell
      citizenName={`${profile.first_name} ${profile.last_name}`}
      avatarUrl={profile.roblox_avatar_url}
      isPolice={Boolean(isPolice)}
      isAdmin={isAdmin}
    >
      {children}
    </TabletShell>
  );
}
