import Link from 'next/link';

export default function DashboardCard({
  href,
  icon,
  title,
  description,
  accent,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`hud-panel group flex flex-col gap-3 p-5 transition hover:-translate-y-0.5 hover:border-accent-500/40 ${
        accent ? 'border-accent-500/30' : ''
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>
      <span className="mt-auto text-xs font-medium text-accent-400 opacity-0 transition group-hover:opacity-100">
        Abrir →
      </span>
    </Link>
  );
}
