'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Radio, Car, Siren, Building2, Mic, Users, PhoneCall } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/format';
import type { Database } from '@/types/database';

type RadioMessage = Database['public']['Tables']['radio_messages']['Row'];
interface PresenceState {
  callsign: string;
  onlineAt: string;
}

const CHANNELS = [
  { code: 'general', label: 'General', icon: Radio },
  { code: 'trafico', label: 'Tráfico', icon: Car },
  { code: 'emergencias', label: 'Emergencias', icon: Siren },
  { code: 'central', label: 'Central', icon: Building2 },
] as const;

const EMERGENCY_PREFIX = '🚨 LLAMADA DE EMERGENCIA:';

function randomKey(): string {
  // crypto.randomUUID() no está disponible en todos los navegadores/webviews
  // (requiere contexto seguro); si falla, usamos un identificador aleatorio
  // igual de válido para la key de presencia en vez de romper la página.
  try {
    return crypto.randomUUID();
  } catch {
    return `radio-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }
}

export default function RadioPanel({ callsign }: { callsign: string }) {
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]['code']>('general');
  const [messages, setMessages] = useState<RadioMessage[]>([]);
  const [online, setOnline] = useState<PresenceState[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [transmitting, setTransmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    let rt: RealtimeChannel | null = null;

    async function join() {
      setLoading(true);
      setError(null);
      setOnline([]);

      try {
        const { data, error: fetchError } = await supabase
          .from('radio_messages')
          .select('*')
          .eq('channel', channel)
          .order('created_at', { ascending: false })
          .limit(60);
        if (cancelled) return;
        if (fetchError) throw fetchError;
        setMessages((data ?? []).reverse());
        setLoading(false);

        const rtChannel = supabase
          .channel(`radio-${channel}`, { config: { presence: { key: randomKey() } } })
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'radio_messages', filter: `channel=eq.${channel}` },
            (payload) => {
              setMessages((prev) => [...prev, payload.new as RadioMessage]);
            },
          )
          .on('presence', { event: 'sync' }, () => {
            if (!rt) return;
            const state = rt.presenceState<PresenceState>();
            setOnline(Object.values(state).flat());
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && rt) {
              await rt.track({ callsign, onlineAt: new Date().toISOString() });
            }
          });
        rt = rtChannel;
      } catch (err) {
        console.error('[radio] fallo al conectar con el canal', err);
        if (!cancelled) {
          setLoading(false);
          setError('No se pudo conectar con la radio. Recarga la página e inténtalo de nuevo.');
        }
      }
    }

    join();

    return () => {
      cancelled = true;
      if (rt) supabase.removeChannel(rt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, callsign]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function transmit(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;
    setSending(true);
    setTransmitting(true);
    try {
      // Insert directo: RLS exige sender_id = auth.uid() y que el
      // usuario esté autorizado como policía, así que no hace falta un
      // endpoint intermedio para este chat de baja sensibilidad.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error: insertError } = await supabase
        .from('radio_messages')
        .insert({ sender_id: user.id, callsign, channel, message: trimmed });
      if (insertError) {
        console.error('[radio] fallo al transmitir', insertError);
        setError('No se pudo transmitir el mensaje.');
        return;
      }
      setText('');
    } finally {
      setSending(false);
      setTimeout(() => setTransmitting(false), 600);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    transmit(text);
  }

  function callEmergency() {
    transmit(`${EMERGENCY_PREFIX} ${callsign} solicita refuerzos inmediatos, cambio.`);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
      <div className="space-y-4">
        <div className="hud-panel p-3">
          <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Canales</h2>
          <div className="space-y-1">
            {CHANNELS.map((c) => {
              const Icon = c.icon;
              const active = c.code === channel;
              return (
                <button
                  key={c.code}
                  onClick={() => setChannel(c.code)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-police-500/20 text-police-glow shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="hud-panel p-3">
          <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <Users className="h-3 w-3" strokeWidth={2} />
            En línea ({online.length})
          </h2>
          <div className="space-y-1.5 px-1">
            {online.map((o, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-500 shadow-[0_0_6px_theme(colors.success.500)]" />
                <span className="font-mono font-medium text-white">{o.callsign}</span>
              </div>
            ))}
            {online.length === 0 && <p className="text-xs text-slate-500">Nadie más en este canal.</p>}
          </div>
        </div>
      </div>

      <div className="hud-panel scan-overlay flex h-[65vh] flex-col p-4">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-3">
          <h1 className="flex items-center gap-2 text-lg font-bold text-white">
            <Radio className="h-5 w-5 text-police-glow" strokeWidth={1.75} />
            {CHANNELS.find((c) => c.code === channel)?.label}
          </h1>
          <span className="flex items-center gap-1.5 rounded-lg border border-police-500/40 bg-police-500/10 px-3 py-1.5 font-mono text-xs font-bold text-police-glow">
            <span className="h-1.5 w-1.5 rounded-full bg-police-glow" />
            {callsign}
          </span>
        </div>

        {error && (
          <p className="mb-2 rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-500">
            {error}
          </p>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-sm text-slate-500">Sintonizando canal…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-slate-500">Sin transmisiones todavía en este canal.</p>
          ) : (
            messages.map((m) => {
              const isEmergency = m.message.startsWith(EMERGENCY_PREFIX);
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${
                    isEmergency ? 'border border-danger-500/40 bg-danger-500/10' : ''
                  }`}
                >
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-bold ${
                      isEmergency ? 'bg-danger-500/20 text-danger-500' : 'bg-police-500/20 text-police-glow'
                    }`}
                  >
                    {m.callsign}
                  </span>
                  <p className={`min-w-0 flex-1 break-words ${isEmergency ? 'font-semibold text-danger-500' : 'text-slate-200'}`}>
                    {m.message}
                  </p>
                  <span className="shrink-0 text-[10px] text-slate-500">{formatDateTime(m.created_at)}</span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={callEmergency}
            disabled={sending}
            title="Llamada de emergencia"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-danger-500/40 bg-danger-500/10 text-danger-500 transition hover:bg-danger-500/20 disabled:opacity-50"
          >
            <PhoneCall className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Transmitir mensaje…"
            maxLength={500}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-police-500/60"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className={`flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white transition disabled:opacity-50 ${
              transmitting ? 'animate-pulse bg-accent-500' : 'bg-police-500 hover:bg-police-500/80'
            }`}
          >
            <Mic className="h-4 w-4" strokeWidth={1.75} />
            {transmitting ? 'Transmitiendo…' : 'Hablar'}
          </button>
        </form>
      </div>
    </div>
  );
}
