import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import AdminNav from '@/components/admin/AdminNav';

// Mismo motivo que en /tablet: evita que Vercel sirva datos cacheados y
// desactualizados en el panel de administración.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Comprobación real en servidor contra is_admin(): un ciudadano que
  // navegue directamente a /admin será redirigido, y cualquier llamada
  // a las APIs /api/admin/* volverá a comprobarlo de forma
  // independiente (requireAdmin en cada route handler).
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/tablet');

  return (
    <div className="grid-overlay min-h-dvh bg-base-950">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col p-2 sm:p-4">
        <div className="hud-panel scan-overlay flex flex-1 flex-col overflow-hidden border-2 border-white/10 sm:rounded-[2rem]">
          <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-accent-500/[0.06] via-transparent to-transparent px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent-500/30 bg-accent-500/10 text-lg shadow-[0_0_16px_rgba(59,130,246,0.25)]">
                ⚙️
              </span>
              <div>
                <p className="font-display text-glow text-xs font-extrabold tracking-[0.3em] text-accent-400">VIGO RP</p>
                <h1 className="text-sm font-bold text-white">Panel de administración</h1>
              </div>
            </div>
            <a href="/tablet" className="text-xs font-medium text-slate-400 hover:text-white">
              ← Volver a la tablet
            </a>
          </header>
          <div className="border-b border-white/10 bg-white/[0.015] px-2 py-2 sm:px-4">
            <AdminNav />
          </div>
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
