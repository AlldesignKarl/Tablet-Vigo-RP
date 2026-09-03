'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Search, Car, Radio, FileWarning, type LucideIcon } from 'lucide-react';

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/tablet/policia', label: 'Panel', icon: LayoutDashboard },
  { href: '/tablet/policia/buscar-persona', label: 'Buscar persona', icon: Search },
  { href: '/tablet/policia/buscar-matricula', label: 'Buscar matrícula', icon: Car },
  { href: '/tablet/policia/denuncias', label: 'Denuncias', icon: FileWarning },
  { href: '/tablet/policia/radio', label: 'Radio', icon: Radio },
];

export default function PoliceSubNav({ callsign, rank }: { callsign?: string; rank?: string }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-police-500/20 bg-police-500/[0.04] p-3">
      <div className="flex flex-wrap gap-1">
        {ITEMS.map((item) => {
          const active = item.href === '/tablet/policia' ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                active
                  ? 'bg-police-500/25 text-police-glow shadow-[0_0_14px_rgba(59,130,246,0.3)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </div>
      {callsign && (
        <span className="flex items-center gap-1.5 rounded-lg border border-police-500/40 bg-police-500/10 px-3 py-1.5 font-mono text-xs font-bold text-police-glow">
          <span className="h-1.5 w-1.5 rounded-full bg-police-glow shadow-[0_0_6px_theme(colors.police.glow)]" />
          {callsign} · {rank ?? 'Agente'}
        </span>
      )}
    </div>
  );
}
