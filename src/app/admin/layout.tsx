import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import AdminNav from '@/components/admin/AdminNav';

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
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 p-4">
        <header className="flex items-center justify-between">
          <div>
            <p className="font-display text-xs font-bold tracking-[0.25em] text-accent-400">VIGO RP</p>
            <h1 className="text-lg font-bold text-white">Panel de administración</h1>
          </div>
          <a href="/tablet" className="text-sm text-slate-400 hover:text-white">
            ← Volver a la tablet
          </a>
        </header>
        <AdminNav />
        <main className="flex-1 pb-10">{children}</main>
      </div>
    </div>
  );
}
