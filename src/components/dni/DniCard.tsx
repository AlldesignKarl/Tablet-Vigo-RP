'use client';

import { useState } from 'react';
import Image from 'next/image';
import { formatDate } from '@/lib/format';

export interface DniCardData {
  dniNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  robloxUsername: string;
  robloxAvatarUrl: string | null;
  issuedAt: string;
}

export default function DniCard({ dni }: { dni: DniCardData }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flip-scene mx-auto w-full max-w-md" style={{ aspectRatio: '85.6 / 54' }}>
        <div className={`flip-card relative h-full w-full ${flipped ? 'flipped' : ''}`}>
          {/* FRONT */}
          <div className="flip-face absolute inset-0 overflow-hidden rounded-2xl border border-accent-500/30 bg-gradient-to-br from-base-800 via-base-850 to-base-900 shadow-hud">
            <div className="grid-overlay absolute inset-0 opacity-30" />
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-500/10 blur-2xl" />

            <div className="relative flex h-full flex-col justify-between p-4 sm:p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-[11px] font-bold tracking-[0.25em] text-accent-400 sm:text-sm">
                    VIGO RP
                  </p>
                  <p className="font-mono text-[8px] tracking-[0.2em] text-slate-400 sm:text-[10px]">
                    DOCUMENTO NACIONAL DE IDENTIDAD · FICTICIO
                  </p>
                </div>
                <span className="text-lg sm:text-xl">🛡️</span>
              </div>

              <div className="flex flex-1 items-center gap-3 sm:gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/20 bg-base-700 sm:h-20 sm:w-20">
                  {dni.robloxAvatarUrl ? (
                    <Image src={dni.robloxAvatarUrl} alt={dni.robloxUsername} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">👤</div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1 text-[10px] sm:text-xs">
                  <Field label="NOMBRE" value={dni.firstName} />
                  <Field label="APELLIDOS" value={dni.lastName} />
                  <div className="grid grid-cols-2 gap-1">
                    <Field label="NACIMIENTO" value={formatDate(dni.birthDate)} />
                    <Field label="USUARIO ROBLOX" value={`@${dni.robloxUsername}`} />
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between border-t border-white/10 pt-2">
                <div>
                  <p className="font-mono text-[8px] text-slate-500 sm:text-[9px]">Nº DOCUMENTO</p>
                  <p className="font-mono text-xs font-bold tracking-widest text-white sm:text-sm">{dni.dniNumber}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[8px] text-slate-500 sm:text-[9px]">EXPEDICIÓN</p>
                  <p className="font-mono text-[10px] text-slate-300 sm:text-xs">{formatDate(dni.issuedAt)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* BACK */}
          <div className="flip-face flip-face-back absolute inset-0 overflow-hidden rounded-2xl border border-accent-500/30 bg-gradient-to-br from-base-850 to-base-950 shadow-hud">
            <div className="grid-overlay absolute inset-0 opacity-20" />
            <div className="relative flex h-full flex-col justify-between p-4 sm:p-5">
              <div>
                <p className="font-display text-[10px] font-bold tracking-[0.2em] text-accent-400 sm:text-xs">
                  VIGO RP · INFORMACIÓN ADICIONAL
                </p>
                <p className="mt-2 text-[9px] leading-relaxed text-slate-400 sm:text-[11px]">
                  Este documento es de carácter ficticio y ha sido emitido exclusivamente para su uso
                  dentro del servidor de Roblox <strong>Spanish Vigo Roleplay (ERLC)</strong>. No tiene
                  validez legal fuera del servidor y no debe confundirse con un documento oficial real.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="h-10 flex-1 rounded bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.6)_0px,rgba(255,255,255,0.6)_2px,transparent_2px,transparent_5px)] opacity-70" />
              </div>

              <div className="flex items-center justify-between font-mono text-[9px] text-slate-500 sm:text-[10px]">
                <span>ID-{dni.dniNumber}</span>
                <span>VIGO-RP.GOV.FICTICIO</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setFlipped((v) => !v)}
        className="rounded-xl border border-accent-500/40 bg-accent-500/10 px-5 py-2.5 text-sm font-medium text-accent-400 transition hover:bg-accent-500/20"
      >
        ↺ Dar la vuelta al DNI
      </button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[7px] uppercase tracking-wider text-slate-500 sm:text-[8px]">{label}</p>
      <p className="truncate font-semibold text-white">{value}</p>
    </div>
  );
}
