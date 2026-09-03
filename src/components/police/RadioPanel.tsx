'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/format';
import type { Database } from '@/types/database';

type RadioMessage = Database['public']['Tables']['radio_messages']['Row'];
interface PresenceState {
  callsign: string;
  onlineAt: string;
}

export default function RadioPanel({ initialMessages, callsign }: { initialMessages: RadioMessage[]; callsign: string }) {
  const [messages, setMessages] = useState<RadioMessage[]>(initialMessages);
  const [online, setOnline] = useState<PresenceState[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel('radio-general', { config: { presence: { key: crypto.randomUUID() } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'radio_messages', filter: 'channel=eq.general' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as RadioMessage]);
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        setOnline(Object.values(state).flat());
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ callsign, onlineAt: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callsign]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      // Insert directo: RLS exige sender_id = auth.uid() y que el
      // usuario esté autorizado como policía, así que no hace falta un
      // endpoint intermedio para este chat de baja sensibilidad.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('radio_messages').insert({ sender_id: user.id, callsign, channel: 'general', message: text.trim() });
      setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
      <div className="hud-panel flex h-[60vh] flex-col p-4">
        <h1 className="mb-3 text-lg font-bold text-white">📻 Radio policial · Canal General</h1>
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {messages.length === 0 && <p className="text-sm text-slate-500">Sin mensajes todavía.</p>}
          {messages.map((m) => (
            <div key={m.id} className="flex items-start gap-2 text-sm">
              <span className="shrink-0 rounded bg-police-500/20 px-1.5 py-0.5 font-mono text-xs font-bold text-police-glow">
                {m.callsign}
              </span>
              <p className="min-w-0 flex-1 break-words text-slate-200">{m.message}</p>
              <span className="shrink-0 text-[10px] text-slate-500">{formatDateTime(m.created_at)}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Transmitir mensaje…"
            maxLength={500}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-police-500/60"
          />
          <button
            type="submit"
            disabled={sending}
            className="rounded-lg bg-police-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-police-500/80 disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </div>

      <div className="hud-panel p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">En línea ({online.length})</h2>
        <div className="space-y-2">
          {online.map((o, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-success-500" />
              <span className="font-mono font-medium text-white">{o.callsign}</span>
            </div>
          ))}
          {online.length === 0 && <p className="text-xs text-slate-500">Nadie más conectado.</p>}
        </div>
      </div>
    </div>
  );
}
