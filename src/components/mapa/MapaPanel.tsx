'use client';

import { Map as MapIcon, Plus, Minus, Maximize2 } from 'lucide-react';
import { useMapPanZoom } from './useMapPanZoom';

export default function MapaPanel() {
  const { scale, pos, zoomBy, reset, toggleZoom, isInteracting, handlers } = useMapPanZoom();

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

      <div className="hud-panel relative h-[70vh] touch-none select-none overflow-hidden" {...handlers} onDoubleClick={toggleZoom}>
        <div className="flex h-full w-full items-center justify-center" style={{ cursor: scale > 1 ? 'grab' : 'default' }}>
          <img
            src="/mapa-erlc.png"
            alt="Mapa de ERLC"
            draggable={false}
            className="max-h-full max-w-full"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isInteracting ? 'none' : 'transform 0.05s linear',
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
