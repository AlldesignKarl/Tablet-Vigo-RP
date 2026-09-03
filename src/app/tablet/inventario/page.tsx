import { Package } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';

export default async function InventarioPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: purchases } = await supabase
    .from('shop_purchases')
    .select('product_id, price_cents, created_at, shop_products(name, description, icon)')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false });

  const grouped = new Map<
    string,
    { name: string; description: string; icon: string; count: number; lastPurchase: string }
  >();

  for (const p of purchases ?? []) {
    const product = p.shop_products as unknown as { name: string; description: string; icon: string } | null;
    if (!product) continue;
    const existing = grouped.get(p.product_id);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(p.product_id, {
        name: product.name,
        description: product.description,
        icon: product.icon,
        count: 1,
        lastPurchase: p.created_at,
      });
    }
  }

  const items = Array.from(grouped.values());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200">
          <Package className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Inventario</h1>
          <p className="text-xs text-slate-500">Objetos y equipamiento que has comprado en la tienda</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="hud-panel p-6 text-center text-sm text-slate-500">
          Todavía no has comprado ningún objeto. Visita la tienda para conseguir equipamiento.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <div key={i} className="hud-panel flex flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-2xl">
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-white">{item.name}</h3>
                  <p className="text-xs text-slate-500">Última compra: {formatDate(item.lastPurchase)}</p>
                </div>
                {item.count > 1 && (
                  <span className="rounded-full bg-accent-500/15 px-2.5 py-1 text-xs font-bold text-accent-400">
                    x{item.count}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{item.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
