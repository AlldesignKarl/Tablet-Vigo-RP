import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCitizenProfile } from '@/lib/data/citizen';
import BankPanel from '@/components/bank/BankPanel';

export default async function BankPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, { data: transactions }, { data: pendingFines }] = await Promise.all([
    getCitizenProfile(supabase, user.id),
    supabase
      .from('bank_transactions')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('fines').select('*').eq('citizen_id', user.id).eq('status', 'pendiente').order('created_at', { ascending: false }),
  ]);

  if (!profile) return null;

  return (
    <BankPanel
      profile={{
        balanceCents: profile.balance_cents ?? 0,
        jobName: profile.job_name,
        salaryCents: profile.salary_cents ?? 0,
        nextSalaryPayment: profile.next_salary_payment,
        lastSalaryPayment: profile.last_salary_payment,
      }}
      transactions={transactions ?? []}
      pendingFines={pendingFines ?? []}
    />
  );
}
