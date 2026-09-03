import { createServerSupabaseClient } from '@/lib/supabase/server';
import LicenseTypesAdminPanel from '@/components/admin/LicenseTypesAdminPanel';

export default async function AdminLicensesPage() {
  const supabase = createServerSupabaseClient();
  const { data: licenseTypes } = await supabase.from('license_types').select('*').order('price_cents');
  return <LicenseTypesAdminPanel licenseTypes={licenseTypes ?? []} />;
}
