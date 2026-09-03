'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
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
    { href: '/tablet', label: 'Inicio', icon: '🏠', show: true },
    { href: '/tablet/dni', label: 'DNI', icon: '🪪', show: true },
    { href: '/tablet/banco', label: 'Banco', icon: '🏦', show: true },
    { href: '/tablet/vehiculos', label: 'Vehículos', icon: '🚗', show: true },
    { href: '/tablet/tienda', label: 'Tienda', icon: '🛒', show: true },
    { href: '/tablet/historial', label: 'Historial', icon: '⚖️', show: true },
    { href: '/tablet/policia', label: 'Policía', icon: '👮', show: true },
    { href: '/admin', label: 'Admin', icon: '⚙️', show: isAdmin },
  ];

  return (
    <div className="grid-overlay min-h-dvh bg-base-950">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col p-2 sm:p-4">
        <div className="hud-panel flex flex-1 flex-col overflow-hidden border-2 border-white/10 sm:rounded-[2rem]">
          <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <div>
                <p className="font-display text-xs font-bold tracking-[0.25em] text-accent-400">VIGO RP</p>
                <p className="hidden text-[10px] text-slate-500 sm:block">Sistema administrativo</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-white">{citizenName}</p>
                <p className="text-[10px] text-slate-500">Ciudadano de Vigo RP</p>
              </div>
              <div className="relative h-9 w-9 overflow-hidden rounded-full border border-white/20 bg-base-700">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={citizenName} fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm">👤</div>
                )}
              </div>
            </div>
          </header>

          <nav className="scrollbar-none flex gap-1 overflow-x-auto border-b border-white/10 bg-white/[0.015] px-2 py-2 sm:px-4">
            {navItems
              .filter((n) => n.show)
              .map((item) => {
                const active = item.href === '/tablet' ? pathname === '/tablet' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                      active
                        ? 'bg-accent-500/15 text-accent-400'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
          </nav>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
