'use client';

import { useEffect, useRef, useState } from 'react';
import { Map as MapIcon, Plus, Minus, Maximize2, MapPin, Siren, AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/format';
import { useMapPanZoom } from '@/components/mapa/useMapPanZoom';
import Portal from '@/components/ui/Portal';
import type { Database } from '@/types/database';

type Marker = Database['public']['Tables']['map_markers']['Row'];
type MarkerType = Marker['type'];

const MARKER_META: Record<MarkerType, { label: string; icon: typeof MapPin; className: string; pulse?: boolean }> = {
  posicion: { label: 'Mi posición', icon: MapPin, className: 'bg-accent-500 text-white' },
  panico: { label: 'Botón de pánico', icon: Siren, className: 'bg-danger-600 text-white', pulse: true },
  incidente: { label: 'Incidente', icon: AlertTriangle, className: 'bg-orange-500 text-white' },
  control: { label: 'Punto de control', icon: ShieldAlert, className: 'bg-yellow-500 text-black' },
};

// Aviso importante: ERLC no da la ubicación real de los jugadores a
// herramientas externas. Esto NO es rastreo automático: cada agente
// marca a mano su posición (o un aviso) haciendo clic derecho en el
// mapa, y el resto de agentes lo ven al instante por Supabase Realtime.
export default function PoliceMapaPanel({ initialMarkers }: { initialMarkers: Marker[] }) {
  const { scale, pos, zoomBy, reset, toggleZoom, isInteracting, handlers } = useMapPanZoom();
  const [markers, setMarkers] = useState<Marker[]>(initialMarkers);
  const [menu, setMenu] = useState<{ screenX: number; screenY: number; relX: number; relY: number } | null>(null);
  const [selected, setSelected] = useState<Marker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      supabase = createClient();
      channel = supabase
        .channel('map-markers')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'map_markers' }, (payload) => {
          const created = payload.new as Marker;
          setMarkers((prev) => (prev.some((m) => m.id === created.id) ? prev : [created, ...prev]));
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'map_markers' }, (payload) => {
          const old = payload.old as { id: string };
          setMarkers((prev) => prev.filter((m) => m.id !== old.id));
        })
        .subscribe();
    } catch (err) {
      console.error('[mapa] no se pudo activar la sincronización en vivo', err);
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {
        // Ignorar: el mapa no debe romperse por un fallo al desconectar.
      }
    };
  }, []);

  // Además del realtime, se refresca la lista entera cada pocos segundos:
  // así los marcadores aparecen igual aunque el realtime falle o tarde
  // (ya pasó algo parecido con las luces de busca y captura).
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const supabase = createClient();
        const { data } = await supabase.from('map_markers').select('*').order('created_at', { ascending: false });
        if (!cancelled && data) setMarkers(data);
      } catch (err) {
        console.error('[mapa] fallo al refrescar marcadores', err);
      }
    }
    const id = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return;
    setSelected(null);
    setMenu({ screenX: e.clientX, screenY: e.clientY, relX, relY });
  }

  async function createMarker(type: MarkerType) {
    if (!menu) return;
    const { relX, relY } = menu;
    setMenu(null);
    setError(null);
    try {
      const res = await fetch('/api/police/map/create-marker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, x: relX, y: relY }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo crear el marcador.');
        return;
      }
      // No dependemos solo del realtime para verlo: lo pintamos ya
      // mismo con lo que ha devuelto el servidor.
      const created = json.data as Marker;
      setMarkers((prev) => (prev.some((m) => m.id === created.id) ? prev : [created, ...prev]));
    } catch {
      setError('No se pudo conectar con el servidor.');
    }
  }

  async function removeMarker(id: string) {
    setSelected(null);
    setError(null);
    setMarkers((prev) => prev.filter((m) => m.id !== id));
    try {
      const res = await fetch('/api/police/map/delete-marker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markerId: id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) setError(json.error || 'No se pudo quitar el marcador.');
    } catch {
      setError('No se pudo conectar con el servidor.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-police-500/40 bg-police-500/10 text-police-glow">
          <MapIcon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-white">Mapa policial</h1>
          <p className="text-xs text-slate-500">
            Clic derecho para marcar tu posición o un aviso. No es rastreo automático: cada agente marca a mano.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-500">Error: {error}</p>
      )}

      <div
        className="hud-panel relative h-[70vh] touch-none select-none overflow-hidden"
        {...handlers}
        onDoubleClick={toggleZoom}
        onContextMenu={handleContextMenu}
      >
        <div className="flex h-full w-full items-center justify-center" style={{ cursor: scale > 1 ? 'grab' : 'default' }}>
          <div
            ref={mapRef}
            className="relative aspect-square h-full max-h-full max-w-full"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isInteracting ? 'none' : 'transform 0.05s linear',
            }}
          >
            <img src="/mapa-erlc.webp" alt="Mapa de ERLC" draggable={false} className="h-full w-full object-contain" />

            {markers.map((m) => {
              const meta = MARKER_META[m.type];
              const Icon = meta.icon;
              return (
                <button
                  key={m.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu(null);
                    setSelected(m);
                  }}
                  className={`no-glow absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/80 shadow-lg ${meta.className} ${
                    meta.pulse ? 'animate-pulse' : ''
                  }`}
                  style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
                  title={`${meta.label} · ${m.callsign}`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              );
            })}
          </div>
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

      {menu && (
        <Portal>
          <div className="fixed inset-0 z-[95]" onClick={() => setMenu(null)} onContextMenu={(e) => e.preventDefault()}>
            <div
              className="hud-panel absolute w-56 space-y-1 p-2"
              style={{ left: menu.screenX, top: menu.screenY }}
              onClick={(e) => e.stopPropagation()}
            >
              {(Object.entries(MARKER_META) as [MarkerType, (typeof MARKER_META)[MarkerType]][]).map(([type, meta]) => {
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    onClick={() => createMarker(type)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/5"
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${meta.className}`}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Portal>
      )}

      {selected && (
        <Portal>
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
            <div className="hud-panel w-full max-w-xs space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${MARKER_META[selected.type].className}`}>
                    {(() => {
                      const Icon = MARKER_META[selected.type].icon;
                      return <Icon className="h-4 w-4" strokeWidth={2.5} />;
                    })()}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{MARKER_META[selected.type].label}</p>
                    <p className="font-mono text-xs text-slate-500">{selected.callsign}</p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="no-glow text-slate-500 hover:text-white">
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              {selected.note && <p className="text-sm text-slate-300">{selected.note}</p>}
              <p className="text-xs text-slate-500">{formatDateTime(selected.created_at)}</p>
              <button
                onClick={() => removeMarker(selected.id)}
                className="w-full rounded-lg bg-danger-600/80 py-2 text-sm font-semibold text-white transition hover:bg-danger-600"
              >
                Quitar marcador
              </button>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
