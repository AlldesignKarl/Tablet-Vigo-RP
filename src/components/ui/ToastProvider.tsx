'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastContextValue {
  push: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

const ICONS: Record<ToastKind, string> = { success: '✓', error: '✕', info: 'ℹ' };
const STYLES: Record<ToastKind, string> = {
  success: 'border-success-500/40 bg-success-500/10 text-success-500',
  error: 'border-danger-500/40 bg-danger-500/10 text-danger-500',
  info: 'border-accent-500/40 bg-accent-500/10 text-accent-400',
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`hud-panel pointer-events-auto flex w-full max-w-sm items-start gap-3 border p-4 ${STYLES[t.kind]}`}
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs">
              {ICONS[t.kind]}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{t.title}</p>
              {t.message && <p className="mt-0.5 text-xs text-slate-400">{t.message}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
