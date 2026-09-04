'use client';

import { useEffect, useRef, useState } from 'react';
import { Map as MapIcon, Plus, Minus, Maximize2, MapPin, Siren, AlertTriangle, ShieldAlert, X, Eraser } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/format';
import { useMapPanZoom } from '@/components/mapa/useMapPanZoom';
import Portal from '@/components/ui/Portal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import SilentErrorBoundary from '@/components/tablet/SilentErrorBoundary';
import type { Database } from '@/types/database';

type Marker = Database['public']['Tables']['map_markers']['Row'];
type MarkerType = Marker['type'];

const MARKER_META: Record<MarkerType, { label: string; icon: typeof MapPin; className: string; pulse?: boolean }> = {
  posicion: { label: 'Mi posición', icon: MapPin, className: 'bg-accent-500 text-white' },
  panico: { label: 'Botón de pánico', icon: Siren, className: 'bg-danger-600 text-white', pulse: true },
  incidente: { label: 'Incidente', icon: AlertTriangle, className: 'bg-orange-500 text-white' },
  control: { label: 'Punto de control', icon: ShieldAlert, className: 'bg-yellow-500 text-black' },
};

const DRAG_THRESHOLD_PX = 6;

// Aviso importante: ERLC no da la ubicación real de los jugadores a
// herramientas externas. Esto NO es rastreo automático: cada agente
// marca a mano su posición (o un aviso) en el mapa, y el resto de
// agentes lo ven al instante por Supabase Realtime.
//
// El clic derecho (context menu) no es fiable en todos los dispositivos
// (no existe en móvil/tablet táctil, que es justo donde se usa esta
// app), así que la forma de colocar un marcador es: elegir el tipo en
// la barra de arriba y luego tocar/pulsar el punto del mapa.
export default function PoliceMapaPanel({ initialMarkers }: { initialMarkers: Marker[] }) {
  const { scale, pos, zoomBy, reset, toggleZoom, isInteracting, handlers } = useMapPanZoom();
  const [markers, setMarkers] = useState<Marker[]>(initialMarkers);
  const [placingType, setPlacingType] = useState<MarkerType | null>(null);
  const [selected, setSelected] = useState<Marker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null);

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
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function clearAllMarkers() {
    setClearingAll(true);
    setError(null);
    try {
      const res = await fetch('/api/police/map/clear-markers', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudieron borrar las llamadas.');
        return;
      }
      setMarkers([]);
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setClearingAll(false);
      setConfirmClearAll(false);
    }
  }

  function onMapPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    pointerDownAt.current = { x: e.clientX, y: e.clientY };
    handlers.onPointerDown(e);
  }

  async function onMapClick(e: React.MouseEvent<HTMLDivElement>) {
    const start = pointerDownAt.current;
    const moved = start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) : Infinity;
    if (moved > DRAG_THRESHOLD_PX) return; // fue un arrastre para mover el mapa, no un toque para colocar

    if (!placingType || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return;

    const type = placingType;
    setPlacingType(null);
    await createMarker(type, relX, relY);
  }

  async function createMarker(type: MarkerType, relX: number, relY: number) {
    setError(null);
    setPlacing(true);
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
    } finally {
      setPlacing(false);
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
            {placingType
              ? `Toca el mapa para colocar: ${MARKER_META[placingType].label}`
              : 'Elige un tipo de marcador y toca el mapa para colocarlo. No es rastreo automático: cada agente marca a mano.'}
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-500">Error: {error}</p>
      )}

      <SilentErrorBoundary>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(MARKER_META) as [MarkerType, (typeof MARKER_META)[MarkerType]][]).map(([type, meta]) => {
            const Icon = meta.icon;
            const active = placingType === type;
            return (
              <button
                key={type}
                type="button"
                disabled={placing}
                onClick={() => setPlacingType((prev) => (prev === type ? null : type))}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  active ? 'border-accent-500/60 bg-accent-500/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'
                }`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${meta.className}`}>
                  <Icon className="h-3 w-3" strokeWidth={2.5} />
                </span>
                {meta.label}
              </button>
            );
          })}
          {placingType && (
            <button
              type="button"
              onClick={() => setPlacingType(null)}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:text-white"
            >
              Cancelar
            </button>
          )}
          {markers.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-danger-500/30 px-3 py-2 text-xs font-semibold text-danger-500 transition hover:bg-danger-500/10"
            >
              <Eraser className="h-3.5 w-3.5" strokeWidth={1.75} />
              Borrar todas las llamadas
            </button>
          )}
        </div>

        <div
          className={`hud-panel relative mt-4 h-[70vh] touch-none select-none overflow-hidden ${placingType ? 'cursor-crosshair' : ''}`}
          {...handlers}
          onPointerDown={onMapPointerDown}
          onClick={onMapClick}
          onDoubleClick={toggleZoom}
        >
          <div className="flex h-full w-full items-center justify-center" style={{ cursor: placingType ? 'crosshair' : scale > 1 ? 'grab' : 'default' }}>
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
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <button
                    key={m.id}
                    onClick={(e) => {
                      e.stopPropagation();
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
              onClick={(e) => {
                e.stopPropagation();
                zoomBy(0.6);
              }}
              className="no-glow flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-base-900/90 text-white transition hover:border-accent-500/40"
              title="Acercar"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                zoomBy(-0.6);
              }}
              className="no-glow flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-base-900/90 text-white transition hover:border-accent-500/40"
              title="Alejar"
            >
              <Minus className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              className="no-glow flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-base-900/90 text-white transition hover:border-accent-500/40"
              title="Restablecer vista"
            >
              <Maximize2 className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {selected && (
          <Portal>
            <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
              <div className="hud-panel w-full max-w-xs space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${MARKER_META[selected.type]?.className ?? 'bg-white/10 text-white'}`}
                    >
                      {(() => {
                        const Icon = MARKER_META[selected.type]?.icon;
                        return Icon ? <Icon className="h-4 w-4" strokeWidth={2.5} /> : null;
                      })()}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-white">{MARKER_META[selected.type]?.label ?? selected.type}</p>
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
      </SilentErrorBoundary>

      <ConfirmDialog
        open={confirmClearAll}
        title="¿Borrar todas las llamadas?"
        description="Se quitarán del mapa todos los marcadores (posición, pánico, incidentes y controles) para todo el cuerpo. Esta acción no se puede deshacer."
        confirmLabel="Borrar todas"
        danger
        loading={clearingAll}
        onConfirm={clearAllMarkers}
        onCancel={() => setConfirmClearAll(false)}
      />
    </div>
  );
}
