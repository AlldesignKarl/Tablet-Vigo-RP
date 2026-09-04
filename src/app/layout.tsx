import type { Metadata, Viewport } from 'next';
import { Orbitron, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import ToastProvider from '@/components/ui/ToastProvider';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-display',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vigo RP · Sistema Administrativo',
  description: 'Tablet policial y administrativa oficial de Spanish Vigo Roleplay (ERLC).',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#05070d',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Tema de toda la tablet (oscuro/claro), ajustable desde el Panel Admin.
  // No requiere sesión: es una preferencia visual compartida, no un dato
  // sensible, así que se lee sin comprobar quién hace la petición.
  let theme: 'dark' | 'light' = 'dark';
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.rpc('get_tablet_theme');
    if (data === 'light') theme = 'light';
  } catch (err) {
    console.error('[layout] no se pudo leer el tema de la tablet, se usa el oscuro por defecto', err);
  }

  return (
    <html lang="es" data-theme={theme} className={`${orbitron.variable} ${jetbrainsMono.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
