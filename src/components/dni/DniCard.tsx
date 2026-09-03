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

function mrzLine(text: string, length: number) {
  const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '<');
  return clean.padEnd(length, '<').slice(0, length);
}

export default function DniCard({ dni }: { dni: DniCardData }) {
  const [flipped, setFlipped] = useState(false);

  const mrz1 = mrzLine(`IDVGO${dni.dniNumber.replace('-', '')}<<${dni.lastName}`, 30);
  const mrz2 = mrzLine(`${dni.firstName}<<${dni.robloxUsername}`, 30);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flip-scene mx-auto w-full max-w-md" style={{ aspectRatio: '85.6 / 54' }}>
        <div className={`flip-card relative h-full w-full ${flipped ? 'flipped' : ''}`}>
          {/* FRONT */}
          <div className="flip-face absolute inset-0 overflow-hidden rounded-xl border border-black/10 bg-[#f3efe4] shadow-hud">
            {/* Marca de agua "FICTICIO" repetida, para dejar claro que no es un documento real */}
            <div
              className="pointer-events-none absolute inset-0 flex flex-wrap content-center justify-center gap-6 opacity-[0.07]"
              style={{ transform: 'rotate(-20deg) scale(1.4)' }}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} className="whitespace-nowrap text-[10px] font-bold tracking-widest text-black">
                  FICTICIO · VIGO RP
                </span>
              ))}
            </div>

            <div className="relative flex h-full flex-col">
              {/* Franja superior de color, estilo carné físico */}
              <div className="flex items-center gap-2 bg-gradient-to-r from-[#a8232f] via-[#c9a13b] to-[#a8232f] px-3 py-1.5">
                <span className="text-sm leading-none">🛡️</span>
                <div className="leading-none">
                  <p className="font-display text-[10px] font-bold tracking-[0.15em] text-white sm:text-xs">
                    VIGO RP
                  </p>
                  <p className="font-mono text-[6px] tracking-[0.1em] text-white/85 sm:text-[7px]">
                    DOCUMENTO NACIONAL DE IDENTIDAD · FICTICIO
                  </p>
                </div>
              </div>

              <div className="flex flex-1 gap-3 p-3 sm:gap-4 sm:p-4">
                <div className="relative h-full w-[30%] shrink-0 overflow-hidden rounded-sm border border-black/20 bg-white">
                  {dni.robloxAvatarUrl ? (
                    <Image src={dni.robloxAvatarUrl} alt={dni.robloxUsername} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">👤</div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between text-black">
                  <div className="space-y-1">
                    <Field label="APELLIDOS" value={dni.lastName} />
                    <Field label="NOMBRE" value={dni.firstName} />
                    <div className="grid grid-cols-2 gap-1">
                      <Field label="FECHA DE NACIMIENTO" value={formatDate(dni.birthDate)} small />
                      <Field label="NACIONALIDAD" value="VIGO RP" small />
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-2 border-t border-black/15 pt-1.5">
                    <div>
                      <p className="font-mono text-[6px] uppercase tracking-wider text-black/50 sm:text-[7px]">
                        Nº DNI / IDESP
                      </p>
                      <p className="font-mono text-[11px] font-bold tracking-wider text-[#a8232f] sm:text-sm">
                        {dni.dniNumber}
                      </p>
                    </div>
                    <div className="h-5 w-7 rounded-[2px] bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-inner sm:h-6 sm:w-8" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-black/5 px-3 py-1">
                <p className="font-mono text-[6px] text-black/50 sm:text-[7px]">
                  USUARIO ROBLOX: @{dni.robloxUsername}
                </p>
                <p className="font-mono text-[6px] text-black/50 sm:text-[7px]">EXP: {formatDate(dni.issuedAt)}</p>
              </div>
            </div>
          </div>

          {/* BACK */}
          <div className="flip-face flip-face-back absolute inset-0 overflow-hidden rounded-xl border border-black/10 bg-[#f3efe4] shadow-hud">
            <div className="flex h-full flex-col justify-between p-3 text-black sm:p-4">
              <div>
                <p className="font-display text-[9px] font-bold tracking-[0.15em] text-[#a8232f] sm:text-[10px]">
                  VIGO RP · INFORMACIÓN ADICIONAL
                </p>
                <p className="mt-1.5 text-[8px] leading-relaxed text-black/70 sm:text-[9px]">
                  Este documento es de carácter ficticio y ha sido emitido exclusivamente para su uso
                  dentro del servidor de Roblox <strong>Spanish Vigo Roleplay (ERLC)</strong>. No tiene
                  validez legal fuera del servidor y no debe confundirse con un documento oficial real.
                </p>
              </div>

              <div className="h-8 rounded bg-[repeating-linear-gradient(90deg,rgba(0,0,0,0.55)_0px,rgba(0,0,0,0.55)_2px,transparent_2px,transparent_5px)] opacity-70" />

              <div className="space-y-0.5 border-t border-black/15 pt-1.5 font-mono text-[7px] tracking-[0.15em] text-black/70 sm:text-[8px]">
                <p>{mrz1}</p>
                <p>{mrz2}</p>
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

function Field({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={`font-mono uppercase tracking-wider text-black/50 ${small ? 'text-[6px] sm:text-[7px]' : 'text-[7px] sm:text-[8px]'}`}>
        {label}
      </p>
      <p className={`truncate font-semibold text-black ${small ? 'text-[10px]' : 'text-xs sm:text-sm'}`}>{value}</p>
    </div>
  );
}
