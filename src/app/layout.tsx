import type { Metadata, Viewport } from 'next';
import './globals.css';
import ToastProvider from '@/components/ui/ToastProvider';

export const metadata: Metadata = {
  title: 'Vigo RP · Sistema Administrativo',
  description: 'Tablet policial y administrativa oficial de Spanish Vigo Roleplay (ERLC).',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#05070d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
