import { createServerSupabaseClient } from '@/lib/supabase/server';
import ShopProductsAdminPanel from '@/components/admin/ShopProductsAdminPanel';

export default async function AdminShopPage() {
  const supabase = createServerSupabaseClient();
  const { data: products } = await supabase.from('shop_products').select('*').order('price_cents');
  return <ShopProductsAdminPanel products={products ?? []} />;
}
