import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCitizenProfile } from '@/lib/data/citizen';
import TabletShell from '@/components/tablet/TabletShell';

// Sin esto, Next.js puede cachear las respuestas de Supabase (fetch) en el
// Data Cache de Vercel y servir datos desactualizados (saldo, licencias,
// productos de la tienda, etc.) entre peticiones. Se aplica a todo lo que
// cuelga de /tablet.
export const dynamic = 'force-dynamic';

export default async function TabletLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const profile = await getCitizenProfile(supabase, user.id);
  if (!profile) redirect('/onboarding');

  const { data: profileRow } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = profileRow?.role === 'admin' || profileRow?.role === 'fundador';

  return (
    <TabletShell
      citizenName={`${profile.first_name} ${profile.last_name}`}
      dniNumber={profile.dni_number}
      avatarUrl={profile.roblox_avatar_url}
      isAdmin={isAdmin}
      profileId={user.id}
      isWanted={profile.is_wanted}
    >
      {children}
    </TabletShell>
  );
}
