import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCitizenProfile } from '@/lib/data/citizen';
import DniCard from '@/components/dni/DniCard';
import PatrimonioPanel from '@/components/dni/PatrimonioPanel';

export default async function DniPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getCitizenProfile(supabase, user.id) : null;

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-white">Mi DNI</h1>
        <p className="text-sm text-slate-400">Documento oficial de identidad de Vigo RP</p>
      </div>

      <DniCard
        dni={{
          dniNumber: profile.dni_number,
          firstName: profile.first_name,
          lastName: profile.last_name,
          birthDate: profile.birth_date,
          robloxUsername: profile.roblox_username,
          robloxAvatarUrl: profile.roblox_avatar_url,
          issuedAt: profile.issued_at,
        }}
      />

      <PatrimonioPanel
        balanceCents={profile.balance_cents ?? 0}
        vehiclesCount={profile.vehicles_count}
        isWanted={profile.is_wanted}
      />
    </div>
  );
}
