'use client';

import { useCallback, useRef, useState } from 'react';
import { Map as MapIcon, Plus, Minus, Maximize2 } from 'lucide-react';

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pinchDistance(points: Map<number, { x: number; y: number }>): number {
  const [a, b] = Array.from(points.values());
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Visor de mapa con zoom y desplazamiento táctil/ratón, hecho a mano (sin
// librería) porque solo necesitamos mover y ampliar una imagen estática,
// no un mapa con capas ni coordenadas geográficas reales.
export default function MapaPanel() {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const drag = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const reset = useCallback(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);

  function zoomBy(delta: number) {
    setScale((prev) => clamp(prev + delta, MIN_SCALE, MAX_SCALE));
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setScale((prev) => clamp(prev - e.deltaY * 0.0015 * prev, MIN_SCALE, MAX_SCALE));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      drag.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    } else if (pointers.current.size === 2) {
      pinch.current = { dist: pinchDistance(pointers.current), scale };
      drag.current = null;
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinch.current) {
      const dist = pinchDistance(pointers.current);
      if (pinch.current.dist > 0) {
        setScale(clamp(pinch.current.scale * (dist / pinch.current.dist), MIN_SCALE, MAX_SCALE));
      }
      return;
    }

    if (drag.current) {
      setPos({ x: drag.current.origX + (e.clientX - drag.current.startX), y: drag.current.origY + (e.clientY - drag.current.startY) });
    }
  }

  function endPointer(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200">
          <MapIcon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-white">Mapa</h1>
          <p className="text-xs text-slate-500">Mapa de Liberty County (ERLC). Arrastra para moverte y usa la rueda o pellizca para hacer zoom.</p>
        </div>
      </div>

      <div
        className="hud-panel relative h-[70vh] touch-none select-none overflow-hidden"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={() => setScale((prev) => (prev > 1 ? 1 : 2.5))}
      >
        <div className="flex h-full w-full items-center justify-center" style={{ cursor: scale > 1 ? 'grab' : 'default' }}>
          <img
            src="/mapa-erlc.webp"
            alt="Mapa de ERLC"
            draggable={false}
            className="max-h-full max-w-full"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: pinch.current || drag.current ? 'none' : 'transform 0.05s linear',
            }}
          />
        </div>

        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
          <button
            onClick={() => zoomBy(0.6)}
            className="no-glow flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-base-900/90 text-white transition hover:border-accent-500/40"
            title="Acercar"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            onClick={() => zoomBy(-0.6)}
            className="no-glow flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-base-900/90 text-white transition hover:border-accent-500/40"
            title="Alejar"
          >
            <Minus className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            onClick={reset}
            className="no-glow flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-base-900/90 text-white transition hover:border-accent-500/40"
            title="Restablecer vista"
          >
            <Maximize2 className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
