import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import BootScreen from '@/components/boot/BootScreen';

export default async function HomePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: dni } = await supabase.from('dnis').select('id').eq('profile_id', user.id).maybeSingle();
    redirect(dni ? '/tablet' : '/onboarding');
  }

  return <BootScreen />;
}
