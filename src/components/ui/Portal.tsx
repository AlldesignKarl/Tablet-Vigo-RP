'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Los paneles "hud-panel" usan backdrop-blur, y eso crea sin querer un
// "containing block" nuevo para cualquier descendiente en position:fixed
// (mismo efecto que transform/filter). El resultado: un modal fixed
// dentro de la tablet queda encajado dentro del panel en vez de centrado
// en toda la pantalla, y puede quedar cortado obligando a hacer scroll.
// Renderizarlo aquí, fuera de ese árbol, en document.body, lo arregla.
export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
