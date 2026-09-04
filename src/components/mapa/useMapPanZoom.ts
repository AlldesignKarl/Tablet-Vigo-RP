'use client';

import { useRef, useState } from 'react';

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

// Lógica de mover/ampliar una imagen estática a mano (arrastrar, rueda del
// ratón, pellizco táctil), compartida entre el mapa normal y el mapa
// interactivo de policía. No es un mapa con coordenadas geográficas reales,
// así que no hace falta ninguna librería de mapas para esto.
export function useMapPanZoom() {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const drag = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  function reset() {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }

  function zoomBy(delta: number) {
    setScale((prev) => clamp(prev + delta, MIN_SCALE, MAX_SCALE));
  }

  function toggleZoom() {
    setScale((prev) => (prev > 1 ? 1 : 2.5));
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

  const isInteracting = Boolean(drag.current || pinch.current);

  return {
    scale,
    pos,
    zoomBy,
    reset,
    toggleZoom,
    isInteracting,
    handlers: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
    },
  };
}
