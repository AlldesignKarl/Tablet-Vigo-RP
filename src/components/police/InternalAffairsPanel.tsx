'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldAlert, Send, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/format';
import SilentErrorBoundary from '@/components/tablet/SilentErrorBoundary';
import type { Database } from '@/types/database';

type Post = Database['public']['Tables']['internal_affairs_posts']['Row'];

// Tablón de Asuntos Internos: a diferencia del antiguo Radio (chat en
// directo, ya retirado), aquí los mensajes quedan guardados de forma
// permanente. Igual que en el mapa policial, no se depende solo de
// Supabase Realtime: cada mensaje enviado se pinta al momento con lo que
// devuelve el propio servidor, y además se refresca la lista entera cada
// pocos segundos por si el realtime falla o tarda.
export default function InternalAffairsPanel({
  initialPosts,
  currentUserId,
}: {
  initialPosts: Post[];
  currentUserId: string | null;
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      supabase = createClient();
      channel = supabase
        .channel('internal-affairs-posts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'internal_affairs_posts' }, (payload) => {
          const created = payload.new as Post;
          setPosts((prev) => (prev.some((p) => p.id === created.id) ? prev : [created, ...prev]));
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'internal_affairs_posts' }, (payload) => {
          const old = payload.old as { id: string };
          setPosts((prev) => prev.filter((p) => p.id !== old.id));
        })
        .subscribe();
    } catch (err) {
      console.error('[asuntos-internos] no se pudo activar la sincronización en vivo', err);
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {
        // Ignorar: el tablón no debe romperse por un fallo al desconectar.
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('internal_affairs_posts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        if (!cancelled && data) setPosts(data);
      } catch (err) {
        console.error('[asuntos-internos] fallo al refrescar mensajes', err);
      }
    }
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/police/internal-affairs/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo enviar el mensaje.');
        return;
      }
      const created = json.data as Post;
      setPosts((prev) => (prev.some((p) => p.id === created.id) ? prev : [created, ...prev]));
      setMessage('');
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setSending(false);
    }
  }

  async function removePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setError(null);
    try {
      const res = await fetch('/api/police/internal-affairs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) setError(json.error || 'No se pudo borrar el mensaje.');
    } catch {
      setError('No se pudo conectar con el servidor.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-police-500/40 bg-police-500/10 text-police-glow">
          <ShieldAlert className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-white">Asuntos Internos</h1>
          <p className="text-xs text-slate-500">Aquí queda guardado todo lo que el cuerpo necesite hablar. Solo lo ve la policía.</p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-500">Error: {error}</p>
      )}

      <SilentErrorBoundary>
        <form onSubmit={send} className="hud-panel space-y-2 p-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Escribe un mensaje para el resto del cuerpo…"
            className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" strokeWidth={1.75} />
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </form>

        <div ref={listRef} className="space-y-2">
          {posts.length === 0 && (
            <div className="hud-panel border-dashed p-8 text-center text-sm text-slate-500">Todavía no hay mensajes.</div>
          )}
          {posts.map((p) => (
            <div key={p.id} className="hud-panel space-y-1 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-police-glow">{p.callsign}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{formatDateTime(p.created_at)}</span>
                  {p.author_id === currentUserId && (
                    <button onClick={() => removePost(p.id)} className="no-glow text-slate-500 hover:text-danger-500" title="Borrar mensaje">
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-200">{p.message}</p>
            </div>
          ))}
        </div>
      </SilentErrorBoundary>
    </div>
  );
}
