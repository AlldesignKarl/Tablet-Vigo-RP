'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Home,
  IdCard,
  Landmark,
  Car,
  ShoppingBag,
  Package,
  Scale,
  Shield,
  FileWarning,
  Map,
  Settings,
  Wifi,
  Signal,
  BatteryFull,
  RotateCw,
  Lock,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  show: boolean;
}

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function TabletShell({
  citizenName,
  dniNumber,
  avatarUrl,
  isAdmin,
  children,
}: {
  citizenName: string;
  dniNumber: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const now = useClock();
  const [refreshing, setRefreshing] = useState(false);

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
    { href: '/tablet/mapa', label: 'Mapa', icon: Map, show: true },
    { href: '/tablet/denuncias', label: 'Denuncias', icon: FileWarning, show: true },
    { href: '/tablet/historial', label: 'Historial', icon: Scale, show: true },
    { href: '/tablet/policia', label: 'Policía', icon: Shield, show: true },
    { href: '/admin', label: 'Admin', icon: Settings, show: isAdmin },
    { href: '/tablet/panel-admin', label: 'Panel Admin', icon: Lock, show: true },
  ];

  function refresh() {
    // Recarga la página de verdad (no solo router.refresh(), que solo
    // revalida los datos del servidor y puede no notarse si nada ha
    // cambiado): así el botón siempre hace algo visible al pulsarlo.
    setRefreshing(true);
    window.location.reload();
  }

  const timeLabel = now?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) ?? '--:--:--';
  const dateLabel = now
    ? now.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
    : '';

  return (
    <div className="grid-overlay min-h-dvh bg-base-950">
      <div className="mx-auto flex min-h-dvh max-w-7xl flex-col p-2 sm:p-4">
        <div className="hud-panel scan-overlay flex flex-1 flex-col overflow-hidden border-2 border-white/10 sm:rounded-[1.75rem]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-accent-500/[0.06] via-transparent to-transparent px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-accent-500/30 shadow-[0_0_16px_rgba(59,130,246,0.25)]">
                <Image src="/logo.webp" alt="Vigo RP" fill className="object-cover" />
              </span>
              <div>
                <p className="font-display text-glow text-xs font-extrabold tracking-[0.3em] text-accent-400">VIGO RP</p>
                <p className="hidden text-[10px] uppercase tracking-wider text-slate-500 sm:block">Tablet administrativa</p>
              </div>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 md:flex">
              <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-accent-500/40 bg-base-700">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={citizenName} fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs">👤</div>
                )}
              </span>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-white">{citizenName}</p>
                <p className="font-mono text-[10px] text-slate-500">DNI {dniNumber}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="font-mono text-sm font-bold text-white">{timeLabel}</p>
                <p className="font-mono text-[9px] tracking-wide text-slate-500">{dateLabel}</p>
              </div>
              <div className="hidden items-center gap-1.5 text-slate-500 sm:flex">
                <Wifi className="h-3.5 w-3.5" strokeWidth={1.75} />
                <Signal className="h-3.5 w-3.5" strokeWidth={1.75} />
                <BatteryFull className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <button
                onClick={refresh}
                title="Recargar"
                className="no-glow flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 transition hover:border-accent-500/40 hover:text-accent-400"
              >
                <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.75} />
              </button>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            <nav className="scrollbar-none flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/10 p-2 sm:w-56 sm:p-3">
              <p className="hidden px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:block">
                Ciudadano
              </p>
              <Link
                href="/tablet"
                title="Principal"
                className={`no-glow flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition sm:px-3 ${
                  pathname === '/tablet'
                    ? 'bg-accent-500/15 text-accent-400 shadow-[0_0_14px_rgba(59,130,246,0.2)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Home className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                <span className="hidden sm:inline">Principal</span>
              </Link>
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
                      className={`no-glow flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition sm:px-3 ${
                        active
                          ? 'bg-accent-500/15 text-accent-400 shadow-[0_0_14px_rgba(59,130,246,0.2)]'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                      <span className="hidden sm:inline">{item.label}</span>
                    </Link>
                  );
                })}

              <div className="mt-auto flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-2 sm:p-2.5">
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-accent-500/40 bg-base-700">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt={citizenName} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm">👤</div>
                  )}
                </span>
                <div className="hidden min-w-0 leading-tight sm:block">
                  <p className="truncate text-xs font-semibold text-white">{citizenName}</p>
                  <p className="font-mono text-[10px] text-slate-500">DNI {dniNumber}</p>
                </div>
              </div>
            </nav>

            <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
