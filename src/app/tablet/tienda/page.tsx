import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCitizenProfile } from '@/lib/data/citizen';
import ShopPanel from '@/components/shop/ShopPanel';

export default async function ShopPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, { data: licenseTypes }, { data: myLicenses }, { data: products }] = await Promise.all([
    getCitizenProfile(supabase, user.id),
    supabase.from('license_types').select('*').eq('active', true).order('price_cents'),
    supabase.from('licenses').select('*').eq('profile_id', user.id),
    supabase.from('shop_products').select('*').eq('active', true).order('price_cents'),
  ]);

  return (
    <ShopPanel
      balanceCents={profile?.balance_cents ?? 0}
      licenseTypes={licenseTypes ?? []}
      myLicenses={myLicenses ?? []}
      products={products ?? []}
    />
  );
}
