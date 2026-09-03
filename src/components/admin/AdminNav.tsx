'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/usuarios', label: 'Usuarios y roles' },
  { href: '/admin/policia', label: 'Policía' },
  { href: '/admin/empleos', label: 'Empleos y sueldos' },
  { href: '/admin/licencias', label: 'Licencias' },
  { href: '/admin/tienda', label: 'Tienda' },
  { href: '/admin/discord', label: 'Discord' },
  { href: '/admin/configuracion', label: 'Configuración' },
  { href: '/admin/auditoria', label: 'Auditoría' },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b border-white/10 pb-3">
      {ITEMS.map((item) => {
        const active = item.href === '/admin' ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
              active ? 'bg-accent-500/15 text-accent-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
