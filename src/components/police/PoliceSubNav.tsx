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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-police-500/20 bg-police-500/[0.04] p-3">
      <div className="flex flex-wrap gap-1">
        {ITEMS.map((item) => {
          const active = item.href === '/tablet/policia' ? pathname === item.href : pathname.startsWith(item.href);
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
              <span>{item.icon}</span>
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
