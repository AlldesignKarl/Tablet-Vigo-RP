'use client';

import { useEffect } from 'react';

// Aviso: esto es solo un disuasorio visual/de "sensación de dispositivo
// oficial", no una medida de seguridad real. Cualquiera puede seguir
// abriendo las herramientas de desarrollador desde el menú del
// navegador (⋮ → Más herramientas → Herramientas para desarrolladores),
// así que la protección de verdad contra acceder a secciones
// restringidas sigue siendo -y debe seguir siendo- la comprobación en
// servidor (RLS + rol real), no esto. No renderiza nada.
export default function DevToolsGuard() {
  useEffect(() => {
    function blockContextMenu(e: MouseEvent) {
      e.preventDefault();
    }

    function blockDevToolsShortcuts(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      const isDevToolsShortcut =
        key === 'f12' ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (e.metaKey && e.altKey && ['i', 'j', 'c'].includes(key)) || // Safari/Mac
        (e.ctrlKey && key === 'u'); // ver código fuente

      if (isDevToolsShortcut) {
        e.preventDefault();
      }
    }

    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('keydown', blockDevToolsShortcuts);
    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('keydown', blockDevToolsShortcuts);
    };
  }, []);

  return null;
}
