'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/tablet/policia', label: 'Panel', icon: '📊' },
  { href: '/tablet/policia/buscar-persona', label: 'Buscar persona', icon: '🔎' },
  { href: '/tablet/policia/buscar-matricula', label: 'Buscar matrícula', icon: '🚘' },
  { href: '/tablet/policia/radio', label: 'Radio', icon: '📻' },
];

export default function PoliceSubNav({ callsign, rank }: { callsign?: string; rank?: string }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
      <div className="flex flex-wrap gap-1">
        {ITEMS.map((item) => {
          const active = item.href === '/tablet/policia' ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                active ? 'bg-police-500/20 text-police-glow' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
      {callsign && (
        <span className="rounded-lg border border-police-500/40 bg-police-500/10 px-3 py-1.5 font-mono text-xs font-bold text-police-glow">
          {callsign} · {rank}
        </span>
      )}
    </div>
  );
}
