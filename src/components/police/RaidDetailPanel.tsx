'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eraser, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import SilentErrorBoundary from '@/components/tablet/SilentErrorBoundary';
import type { Database } from '@/types/database';

type Raid = Database['public']['Tables']['raids']['Row'];
type Stroke = Database['public']['Tables']['raid_strokes']['Row'];
type Point = { x: number; y: number };

const COLORS = ['#ef4444', '#2f8bf5', '#22c55e', '#eab308', '#ffffff'];

// Sin pan/zoom aquí a propósito: el mapa se ve entero y fijo mientras se
// dibuja, así no hace falta convertir coordenadas entre el gesto de
// dibujar y una transformación de la vista (esa mezcla fue la fuente de
// varios fallos en el mapa policial). Cada trazo se guarda como una
// lista de puntos relativos (0-1) al soltar el dedo/ratón.
export default function RaidDetailPanel({ raid, initialStrokes }: { raid: Raid; initialStrokes: Stroke[] }) {
  const router = useRouter();
  const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes);
  const [color, setColor] = useState(COLORS[0]);
  const [drawing, setDrawing] = useState<Point[] | null>(null);
  const [notes, setNotes] = useState(raid.notes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      supabase = createClient();
      channel = supabase
        .channel(`raid-strokes-${raid.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'raid_strokes', filter: `raid_id=eq.${raid.id}` },
          (payload) => {
            const created = payload.new as Stroke;
            setStrokes((prev) => (prev.some((s) => s.id === created.id) ? prev : [...prev, created]));
          },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'raid_strokes', filter: `raid_id=eq.${raid.id}` },
          (payload) => {
            const old = payload.old as { id: string };
            setStrokes((prev) => prev.filter((s) => s.id !== old.id));
          },
        )
        .subscribe();
    } catch (err) {
      console.error('[redadas] no se pudo activar la sincronización en vivo', err);
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {
        // Ignorar: la redada no debe romperse por un fallo al desconectar.
      }
    };
  }, [raid.id]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('raid_strokes')
          .select('*')
          .eq('raid_id', raid.id)
          .order('created_at', { ascending: true });
        if (!cancelled && data) setStrokes(data);
      } catch (err) {
        console.error('[redadas] fallo al refrescar trazos', err);
      }
    }
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [raid.id]);

  function relPoint(e: { clientX: number; clientY: number }): Point | null {
    if (!mapRef.current) return null;
    const rect = mapRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const p = relPoint(e);
    if (p) setDrawing([p]);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drawing) return;
    const p = relPoint(e);
    if (p) setDrawing((prev) => (prev ? [...prev, p] : prev));
  }

  async function onPointerUp() {
    const points = drawing;
    setDrawing(null);
    if (!points || points.length < 2) return;
    try {
      const res = await fetch('/api/police/redadas/add-stroke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raidId: raid.id, points, color }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo guardar el trazo.');
        return;
      }
      const created = json.data as Stroke;
      setStrokes((prev) => (prev.some((s) => s.id === created.id) ? prev : [...prev, created]));
    } catch {
      setError('No se pudo conectar con el servidor.');
    }
  }

  async function saveNotes() {
    if (notes === raid.notes) return;
    setSavingNotes(true);
    setError(null);
    try {
      const res = await fetch('/api/police/redadas/update-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raidId: raid.id, notes }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) setError(json.error || 'No se pudieron guardar las notas.');
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setSavingNotes(false);
    }
  }

  async function clearStrokes() {
    setClearing(true);
    setError(null);
    try {
      const res = await fetch('/api/police/redadas/clear-strokes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raidId: raid.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo borrar el dibujo.');
        return;
      }
      setStrokes([]);
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  }

  async function deleteRaid() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/police/redadas/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raidId: raid.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo eliminar la redada.');
        return;
      }
      router.push('/tablet/policia/redadas');
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function toSvgPoints(points: Point[]): string {
    return points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/tablet/policia/redadas" className="no-glow text-slate-500 hover:text-white">
            <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">{raid.title}</h1>
            <p className="text-xs text-slate-500">Creada por {raid.callsign}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-1.5 rounded-lg border border-danger-500/40 px-3 py-2 text-xs font-semibold text-danger-500 hover:bg-danger-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          Eliminar redada
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-500">Error: {error}</p>
      )}

      <SilentErrorBoundary>
        <div className="flex flex-wrap items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full border-2 transition ${color === c ? 'border-white scale-110' : 'border-white/20'}`}
              style={{ backgroundColor: c }}
              title="Color del trazo"
            />
          ))}
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="ml-2 flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-white/20"
          >
            <Eraser className="h-3.5 w-3.5" strokeWidth={1.75} />
            Borrar todo el dibujo
          </button>
        </div>

        <div
          ref={mapRef}
          className="hud-panel relative mx-auto aspect-square w-full max-w-2xl touch-none select-none overflow-hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img src="/mapa-erlc.webp" alt="Mapa de ERLC" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
            {strokes.map((s) => (
              <polyline
                key={s.id}
                points={toSvgPoints(s.points as Point[])}
                fill="none"
                stroke={s.color}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {drawing && (
              <polyline
                points={toSvgPoints(drawing)}
                fill="none"
                stroke={color}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        </div>

        <div className="hud-panel space-y-2 p-4">
          <h2 className="text-sm font-bold text-white">Notas del operativo</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={5}
            maxLength={4000}
            placeholder="Detalles del operativo, roles de cada agente, hora de inicio…"
            className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
          />
          <p className="text-xs text-slate-500">{savingNotes ? 'Guardando…' : 'Se guarda al salir del campo de texto.'}</p>
        </div>
      </SilentErrorBoundary>

      <ConfirmDialog
        open={confirmClear}
        title="¿Borrar todo el dibujo?"
        description="Se eliminarán todos los trazos de esta redada para todo el cuerpo. Esta acción no se puede deshacer."
        confirmLabel="Borrar dibujo"
        danger
        loading={clearing}
        onConfirm={clearStrokes}
        onCancel={() => setConfirmClear(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar esta redada?"
        description="Se eliminará la redada, sus notas y su dibujo para siempre."
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        onConfirm={deleteRaid}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
