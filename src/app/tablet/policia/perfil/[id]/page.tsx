import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import PoliceCitizenProfile from '@/components/police/PoliceCitizenProfile';

export default async function PoliceCitizenPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();

  const [{ data: profile }, { data: vehicles }, { data: arrests }, { data: fines }, { data: confiscations }, { data: points }] =
    await Promise.all([
      supabase.from('citizen_profile_view').select('*').eq('profile_id', params.id).maybeSingle(),
      supabase.from('vehicles').select('*').eq('profile_id', params.id).order('registered_at', { ascending: false }),
      supabase.from('arrests').select('*').eq('citizen_id', params.id).order('created_at', { ascending: false }),
      supabase.from('fines').select('*').eq('citizen_id', params.id).order('created_at', { ascending: false }),
      supabase.from('confiscations').select('*').eq('citizen_id', params.id).order('created_at', { ascending: false }),
      supabase.from('license_points_history').select('*').eq('citizen_id', params.id).order('created_at', { ascending: false }),
    ]);

  if (!profile) notFound();

  return (
    <PoliceCitizenProfile
      profile={profile}
      vehicles={vehicles ?? []}
      arrests={arrests ?? []}
      fines={fines ?? []}
      confiscations={confiscations ?? []}
      pointsHistory={points ?? []}
    />
  );
}
