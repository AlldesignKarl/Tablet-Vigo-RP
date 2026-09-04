'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, IdCard, ShieldAlert, Package, type LucideIcon } from 'lucide-react';
import { centsToEuros, formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/ToastProvider';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { Database } from '@/types/database';

type LicenseType = Database['public']['Tables']['license_types']['Row'];
type License = Database['public']['Tables']['licenses']['Row'];
type Product = Database['public']['Tables']['shop_products']['Row'];

type PendingPurchase = { kind: 'license'; item: LicenseType } | { kind: 'product'; item: Product };

export default function ShopPanel({
  balanceCents,
  licenseTypes,
  myLicenses,
  products,
}: {
  balanceCents: number;
  licenseTypes: LicenseType[];
  myLicenses: License[];
  products: Product[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, setPending] = useState<PendingPurchase | null>(null);
  const [loading, setLoading] = useState(false);

  const ownedMap = new Map(myLicenses.map((l) => [l.license_type_id, l]));
  const weaponLicenses = licenseTypes.filter((lt) => lt.code.startsWith('arma_'));
  const generalLicenses = licenseTypes.filter((lt) => !lt.code.startsWith('arma_'));

  async function confirmPurchase() {
    if (!pending) return;
    setLoading(true);
    try {
      const isLicense = pending.kind === 'license';
      const res = await fetch(isLicense ? '/api/shop/purchase-license' : '/api/shop/purchase-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isLicense ? { licenseTypeId: pending.item.id } : { productId: pending.item.id },
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({
          kind: 'error',
          title: json.error === 'Fondos insuficientes.' ? 'Fondos insuficientes' : 'No se pudo completar la compra',
          message: json.error,
        });
        return;
      }
      push({
        kind: 'success',
        title: isLicense ? 'Licencia adquirida' : 'Compra realizada',
        message: `${pending.item.name} añadido a tu perfil.`,
      });
      setPending(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="hud-panel flex flex-wrap items-center justify-between gap-3 border-accent-500/20 bg-gradient-to-r from-accent-500/10 via-transparent to-transparent p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400">
            <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-white">Tienda</h1>
            <p className="text-xs text-slate-500">Licencias oficiales y equipamiento de rol</p>
          </div>
        </div>
        <div className="rounded-xl border border-accent-500/30 bg-base-900/80 px-4 py-2.5 text-right">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Saldo disponible</p>
          <p className="font-mono text-lg font-bold text-white">{centsToEuros(balanceCents)}</p>
        </div>
      </div>

      {generalLicenses.length > 0 && (
        <ShopSection title="Licencias generales" icon={IdCard} accent="accent">
          {generalLicenses.map((lt) => (
            <LicenseCard key={lt.id} lt={lt} owned={ownedMap.get(lt.id)} onBuy={() => setPending({ kind: 'license', item: lt })} />
          ))}
        </ShopSection>
      )}

      {weaponLicenses.length > 0 && (
        <ShopSection title="Licencias de armas" icon={ShieldAlert} accent="danger">
          {weaponLicenses.map((lt) => (
            <LicenseCard key={lt.id} lt={lt} owned={ownedMap.get(lt.id)} onBuy={() => setPending({ kind: 'license', item: lt })} />
          ))}
        </ShopSection>
      )}

      {products.length > 0 && (
        <ShopSection title="Equipamiento" icon={Package} accent="police">
          {products.map((p) => (
            <div key={p.id} className="hud-panel flex flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-police-500/10 text-2xl">{p.icon}</span>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-white">{p.name}</h3>
                  <p className="font-mono text-xs text-slate-500">{centsToEuros(p.price_cents)}</p>
                </div>
              </div>
              <p className="flex-1 text-xs text-slate-400">{p.description}</p>
              <button
                onClick={() => setPending({ kind: 'product', item: p })}
                className="rounded-lg bg-accent-600 py-2 text-sm font-semibold text-white transition hover:bg-accent-500"
              >
                Comprar
              </button>
            </div>
          ))}
        </ShopSection>
      )}

      <ConfirmDialog
        open={!!pending}
        title="Confirmar compra"
        description={
          pending
            ? balanceCents < pending.item.price_cents
              ? 'Fondos insuficientes para esta compra.'
              : `Se descontarán ${centsToEuros(pending.item.price_cents)} de tu banco.`
            : ''
        }
        confirmLabel="Comprar"
        loading={loading}
        onConfirm={confirmPurchase}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

function ShopSection({
  title,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  icon: LucideIcon;
  accent: 'accent' | 'danger' | 'police';
  children: React.ReactNode;
}) {
  const dot = { accent: 'bg-accent-500', danger: 'bg-danger-500', police: 'bg-police-500' }[accent];
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <Icon className="h-4 w-4" strokeWidth={1.75} /> {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function LicenseCard({ lt, owned, onBuy }: { lt: LicenseType; owned?: License; onBuy: () => void }) {
  const canBuy = !owned || lt.renewable;
  return (
    <div className={`hud-panel flex flex-col gap-3 p-5 ${owned ? 'border-success-500/25' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-2xl">{lt.icon}</span>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Licencia</p>
            <h3 className="truncate font-semibold text-white">{lt.name}</h3>
          </div>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
            owned ? 'bg-success-500/15 text-success-500' : 'bg-white/5 text-slate-500'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${owned ? 'bg-success-500' : 'bg-slate-500'}`} />
          {owned ? 'Obtenida' : 'No obtenida'}
        </span>
      </div>

      <p className="flex-1 text-xs text-slate-400">{lt.description}</p>

      <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[11px]">
        <div>
          <p className="text-slate-500">Precio</p>
          <p className="font-mono font-semibold text-white">{centsToEuros(lt.price_cents)}</p>
        </div>
        <div>
          <p className="text-slate-500">{owned ? 'Obtenida el' : 'Renovable'}</p>
          <p className="font-mono font-semibold text-white">{owned ? formatDate(owned.acquired_at) : lt.renewable ? 'Sí' : 'No'}</p>
        </div>
      </div>

      {owned && (
        <p className="flex items-center gap-1.5 rounded-lg bg-success-500/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-success-500">
          <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
          Estado centralizado: obtenida / activa
        </p>
      )}

      <button
        onClick={onBuy}
        disabled={!canBuy}
        className="rounded-lg bg-accent-600 py-2 text-sm font-semibold text-white transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
      >
        {owned ? (lt.renewable ? 'Renovar' : 'Ya la posees') : 'Comprar'}
      </button>
    </div>
  );
}
