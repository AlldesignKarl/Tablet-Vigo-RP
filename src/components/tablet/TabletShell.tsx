'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Home,
  IdCard,
  Landmark,
  Car,
  ShoppingBag,
  Package,
  Scale,
  Shield,
  Settings,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  show: boolean;
}

export default function TabletShell({
  citizenName,
  avatarUrl,
  isAdmin,
  children,
}: {
  citizenName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // El botón de Policía siempre está visible para cualquier ciudadano con
  // DNI: la propia sección /tablet/policia es la que pide el código de
  // acceso y comprueba los permisos en el servidor. Ocultar el botón NO
  // es una medida de seguridad real, así que no lo usamos como tal.
  const navItems: NavItem[] = [
    { href: '/tablet/dni', label: 'DNI', icon: IdCard, show: true },
    { href: '/tablet/banco', label: 'Banco', icon: Landmark, show: true },
    { href: '/tablet/vehiculos', label: 'Vehículos', icon: Car, show: true },
    { href: '/tablet/tienda', label: 'Tienda', icon: ShoppingBag, show: true },
    { href: '/tablet/inventario', label: 'Inventario', icon: Package, show: true },
    { href: '/tablet/historial', label: 'Historial', icon: Scale, show: true },
    { href: '/tablet/policia', label: 'Policía', icon: Shield, show: true },
    { href: '/admin', label: 'Admin', icon: Settings, show: isAdmin },
  ];

  return (
    <div className="grid-overlay min-h-dvh bg-base-950">
      <div className="mx-auto flex min-h-dvh max-w-6xl gap-2 p-2 sm:gap-4 sm:p-4">
        <div className="hud-panel scan-overlay flex flex-1 flex-col overflow-hidden border-2 border-white/10 sm:rounded-[2rem]">
          <header className="relative flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-accent-500/[0.06] via-transparent to-transparent px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent-500/30 bg-accent-500/10 text-lg shadow-[0_0_16px_rgba(59,130,246,0.25)]">
                🛡️
              </span>
              <div>
                <p className="font-display text-glow text-xs font-extrabold tracking-[0.3em] text-accent-400">VIGO RP</p>
                <p className="hidden text-[10px] uppercase tracking-wider text-slate-500 sm:block">Sistema administrativo</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-white">{citizenName}</p>
                <p className="text-[10px] text-slate-500">Ciudadano de Vigo RP</p>
              </div>
              <div className="relative h-9 w-9 overflow-hidden rounded-full border border-accent-500/40 bg-base-700 shadow-[0_0_12px_rgba(59,130,246,0.3)]">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={citizenName} fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm">👤</div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>

        <nav className="hud-panel scrollbar-none flex w-14 shrink-0 flex-col items-center gap-1 overflow-y-auto border-2 border-white/10 py-4 sm:w-16 sm:rounded-[2rem]">
          {navItems
            .filter((n) => n.show)
            .map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`no-glow flex h-11 w-11 items-center justify-center rounded-xl transition ${
                    active
                      ? 'bg-accent-500/15 text-accent-400 shadow-[0_0_14px_rgba(59,130,246,0.3)]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                  <span className="sr-only">{item.label}</span>
                </Link>
              );
            })}

          <div className="mt-auto pt-2">
            <Link
              href="/tablet"
              title="Inicio"
              className={`no-glow flex h-11 w-11 items-center justify-center rounded-xl border-t border-white/10 pt-1 transition ${
                pathname === '/tablet'
                  ? 'text-accent-400'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Home className="h-5 w-5" strokeWidth={1.75} />
              <span className="sr-only">Inicio</span>
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
