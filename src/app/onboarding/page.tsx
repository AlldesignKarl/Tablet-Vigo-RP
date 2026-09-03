import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import OnboardingForm from '@/components/dni/OnboardingForm';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: dni } = await supabase.from('dnis').select('id').eq('profile_id', user.id).maybeSingle();
  if (dni) redirect('/tablet');

  return (
    <main className="grid-overlay flex min-h-dvh items-center justify-center bg-base-950 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <p className="font-display text-xs font-bold tracking-[0.3em] text-accent-400">VIGO RP</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Creación de DNI</h1>
          <p className="mt-2 text-sm text-slate-400">
            Necesitas registrar tu DNI antes de poder usar el resto de funciones de la tablet.
          </p>
        </div>
        <OnboardingForm />
      </div>
    </main>
  );
}
