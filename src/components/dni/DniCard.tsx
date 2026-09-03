'use client';

import { useState } from 'react';
import Image from 'next/image';
import { addYears } from 'date-fns';
import { RotateCw } from 'lucide-react';
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

// Número de soporte: distinto del número de DNI, cambia visualmente en cada
// renovación en un DNI real. Aquí se deriva de forma determinista del propio
// número de DNI, solo para que la tarjeta tenga un aspecto más completo.
function supportNumber(dniNumber: string) {
  const digits = dniNumber.replace(/\D/g, '').slice(-4).padStart(4, '0');
  return `IDESP${digits}`;
}

export default function DniCard({ dni }: { dni: DniCardData }) {
  const [flipped, setFlipped] = useState(false);

  const mrz1 = mrzLine(`IDVGO${dni.dniNumber.replace('-', '')}<<${dni.lastName}`, 30);
  const mrz2 = mrzLine(`${dni.firstName}<<${dni.robloxUsername}`, 30);
  const validUntil = formatDate(addYears(new Date(dni.issuedAt), 10).toISOString());
  const secondaryNumber = dni.dniNumber.replace(/\D/g, '').padStart(6, '0').slice(-6);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flip-scene mx-auto w-full max-w-lg" style={{ aspectRatio: '85.6 / 54' }}>
        <div className={`flip-card relative h-full w-full ${flipped ? 'flipped' : ''}`}>
          {/* FRONT */}
          <div
            className="flip-face relative overflow-hidden rounded-2xl border border-black/10 shadow-hud"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, #f6cd7a 0%, #eeb44a 55%, #e8a13a 100%)',
            }}
          >
            {/* Textura de rayas diagonales, estilo papel de seguridad */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.15]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 8px)',
              }}
            />
            {/* Escudo/marca de agua central */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-8 border-black/5 text-6xl opacity-[0.08] sm:h-56 sm:w-56 sm:text-8xl"
              aria-hidden
            >
              🛡️
            </div>
            {/* Marca "FICTICIO" discreta, para que nunca se confunda con un documento oficial real */}
            <p className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[6px] font-bold uppercase tracking-[0.3em] text-black/25 sm:text-[7px]">
              Documento ficticio · Vigo RP · Sin validez legal real
            </p>

            <div className="relative flex h-full flex-col p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-4 w-6 items-center justify-center rounded-[3px] bg-[#1a3d8f] text-[8px] font-black text-white sm:h-5 sm:w-7 sm:text-[10px]">
                    VRP
                  </span>
                  <span className="font-display text-sm font-black tracking-tight text-[#1a3d8f] sm:text-lg">
                    VIGO RP
                  </span>
                </div>
                <p className="pt-0.5 text-right text-[8px] font-bold uppercase leading-tight tracking-wide text-[#a8232f] sm:text-[10px]">
                  Documento Nacional
                  <br />
                  de Identidad
                </p>
              </div>

              <button
                onClick={() => setFlipped(true)}
                className="absolute right-2.5 top-9 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-black shadow-sm transition hover:bg-white sm:right-3 sm:top-10 sm:px-2.5 sm:text-[9px]"
              >
                <RotateCw className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2} />
                Girar DNI
              </button>

              <div className="mt-2 flex flex-1 gap-3 sm:mt-3 sm:gap-4">
                <div className="flex w-[26%] shrink-0 flex-col gap-1.5">
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md border border-black/20 bg-white">
                    {dni.robloxAvatarUrl ? (
                      <Image src={dni.robloxAvatarUrl} alt={dni.robloxUsername} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">👤</div>
                    )}
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1 text-black">
                  <Field label="APELLIDOS" value={dni.lastName} />
                  <Field label="NOMBRE" value={dni.firstName} />
                  <div className="grid grid-cols-2 gap-1.5">
                    <Field label="NACIONALIDAD" value="VIGO RP" small />
                    <Field label="FECHA NACIMIENTO" value={formatDate(dni.birthDate)} small />
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-1.5 border-t border-black/15 pt-1.5">
                    <Field label="Núm. soporte" value={supportNumber(dni.dniNumber)} small />
                    <Field label="Validez" value={validUntil} small />
                  </div>
                </div>

                <div className="hidden w-14 shrink-0 flex-col items-center gap-1.5 sm:flex">
                  <div
                    className="h-6 w-9 rounded-[2px] shadow-inner"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, #2b2b2b 0px, #2b2b2b 3px, #e8b93a 3px, #e8b93a 6px)',
                    }}
                  />
                  <div className="relative h-8 w-8 overflow-hidden rounded-full border border-black/20 bg-white grayscale">
                    {dni.robloxAvatarUrl ? (
                      <Image src={dni.robloxAvatarUrl} alt="" fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs">👤</div>
                    )}
                  </div>
                  <p className="font-mono text-[7px] text-black/50">{secondaryNumber}</p>
                </div>
              </div>

              <div className="mt-2 flex items-end justify-between gap-2 border-t border-black/15 pt-1.5">
                <div>
                  <p className="font-mono text-[6px] uppercase tracking-wider text-black/50 sm:text-[7px]">DNI</p>
                  <p className="font-mono text-sm font-black tracking-wider text-[#a8232f] sm:text-lg">{dni.dniNumber}</p>
                </div>
                <p className="hidden max-w-[45%] truncate font-serif text-base italic text-black/40 sm:block sm:text-xl">
                  {dni.firstName} {dni.lastName}
                </p>
                <p className="font-mono text-[9px] text-black/40 sm:text-xs">{secondaryNumber}</p>
              </div>
            </div>
          </div>

          {/* BACK */}
          <div
            className="flip-face flip-face-back absolute inset-0 overflow-hidden rounded-2xl border border-black/10 shadow-hud"
            style={{
              background: 'linear-gradient(135deg, #f6cd7a 0%, #eeb44a 55%, #e8a13a 100%)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.15]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 8px)',
              }}
            />
            <div className="relative flex h-full flex-col justify-between p-3 text-black sm:p-4">
              <div className="flex items-start justify-between gap-2">
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
                <button
                  onClick={() => setFlipped(false)}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-black/15 bg-black/5 px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-black/70 transition hover:bg-black/10 sm:text-[9px]"
                >
                  <RotateCw className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2} />
                  Volver
                </button>
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
    </div>
  );
}

function Field({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={`font-mono uppercase tracking-wider text-black/50 ${small ? 'text-[6px] sm:text-[7px]' : 'text-[7px] sm:text-[8px]'}`}>
        {label}
      </p>
      <p className={`truncate font-semibold text-black ${small ? 'text-[9px] sm:text-[11px]' : 'text-xs sm:text-sm'}`}>{value}</p>
    </div>
  );
}
