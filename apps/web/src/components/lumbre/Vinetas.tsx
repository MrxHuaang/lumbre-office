"use client";

// Las ilustraciones chicas de la portada, todas con el arte del juego: salas en miniatura, cosas de
// la cafetería y el casino, personajes al azar y la burbuja de proximidad.
// Los dibujos salen del build (scripts/prerender.ts): la portada no carga el motor de arte.
import { HUMAN_AVATARS, randomLook, seededRandom, type Look } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { PixelIcon } from "../Cozy";
import { prefiereQuieto, useObjeto, useSala } from "./dibujo";
import { OBJETOS, type Objeto } from "./escena";
import { Personaje } from "./Personaje";

/** Una sala en miniatura (el mismo dibujo que en el juego). */
export function Diorama({ sala, className = "" }: { sala: "oficina" | "juegos"; className?: string }) {
  // Si la sala ya no se puede armar (un mueble cambió de nombre), queda el hueco y la página sigue.
  const d = useSala(sala, false);
  if (!d) return <div className={`aspect-[5/4] ${className}`} aria-hidden />;
  return <img src={d.src} alt="" aria-hidden className={`pixelated h-auto ${className}`} style={{ aspectRatio: `${d.w} / ${d.h}` }} draggable={false} />;
}

/** Cosas sueltas del juego (OBJETOS de escena.ts), cada una en su casilla. */
export function Objetos({ className = "" }: { className?: string }) {
  return (
    <ul className={`grid grid-cols-3 gap-2 sm:grid-cols-6 ${className}`}>
      {OBJETOS.map((nombre) => (
        <CasillaObjeto key={nombre} nombre={nombre} />
      ))}
    </ul>
  );
}

function CasillaObjeto({ nombre }: { nombre: Objeto }) {
  // Si un dibujo cambió de nombre, la casilla queda vacía.
  const d = useObjeto(nombre);
  return (
    <li className="cozy-chip flex flex-col items-center gap-1.5 px-1 pt-2 pb-1.5">
      <span className="grid h-14 w-full place-items-center">
        {d && (
          <img
            src={d.src}
            alt=""
            aria-hidden
            className="pixelated"
            // Escala entera (los píxeles quedan parejos): lo chico se agranda más.
            style={{ height: d.h * (d.h > 26 ? 1 : d.h > 12 ? 3 : 5), width: "auto", maxWidth: "100%" }}
            draggable={false}
          />
        )}
      </span>
      <span className="text-[12px] leading-none">{nombre}</span>
    </li>
  );
}

/** Una fila de personajes: los seis fijos y algunos armados al azar; "Otro" sortea uno nuevo. */
export function Personajes({ className = "", tam = "w-[15%] max-w-24" }: { className?: string; tam?: string }) {
  const [semilla, setSemilla] = useState(7);
  // Caminan en el lugar, salvo con "menos movimiento" (se sabe recién en el navegador).
  const [caminan, setCaminan] = useState(false);
  useEffect(() => setCaminan(!prefiereQuieto()), []);
  // Con semillas fijas el primer dibujo es igual en el servidor y en el navegador.
  const [looks, setLooks] = useState<(Look | null)[]>(() => [null, randomLook(seededRandom(3)), null, randomLook(seededRandom(21)), null, randomLook(seededRandom(8))]);
  const sortear = () => {
    const s = semilla + 1;
    setSemilla(s);
    setLooks((ls) => ls.map((l, i) => (i === s % ls.length ? randomLook(seededRandom(s * 7919 + i)) : l)));
  };
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="flex w-full items-end justify-center gap-[2%]">
        {looks.map((look, i) => (
          <Personaje
            key={i}
            avatar={HUMAN_AVATARS[i % HUMAN_AVATARS.length]!}
            look={look}
            dir="down"
            walking={caminan}
            className={tam}
            style={{ animationDelay: `${-i * 0.13}s` }}
          />
        ))}
      </div>
      <button type="button" onClick={sortear} className="cozy-btn px-4 py-2 text-[15px]">
        <PixelIcon name="smile" size={16} />
        Armar otro al azar
      </button>
    </div>
  );
}

/** La burbuja de proximidad: los que están cerca se oyen y se ven; el de lejos, no. */
export function Proximidad({ className = "" }: { className?: string }) {
  return (
    <div className={`lumbre-pasto relative aspect-[16/10] overflow-hidden border-4 border-cozy-frame ${className}`}>
      {/* El radio de conversación: un círculo pixelado que late despacio. */}
      <svg viewBox="0 0 40 25" shapeRendering="crispEdges" className="absolute inset-0 h-full w-full" aria-hidden>
        <g className="lumbre-radio">
          {Array.from({ length: 48 }, (_, i) => {
            const a = (i / 48) * Math.PI * 2;
            return i % 2 === 0 ? <rect key={i} x={Math.round(16 + Math.cos(a) * 11)} y={Math.round(13 + Math.sin(a) * 8)} width={1} height={1} fill="#fdf0c8" /> : null;
          })}
        </g>
        <ellipse cx="16" cy="13" rx="10.5" ry="7.5" fill="#fdf0c8" opacity="0.12" />
      </svg>
      <Personaje avatar="ada" dir="right" className="absolute top-[30%] left-[18%] w-[17%]" />
      <Personaje avatar="fede" dir="down" look={randomLook(seededRandom(17))} className="absolute top-[30%] left-[44%] w-[17%]" />
      {/* Ondas de voz entre los dos. */}
      <span className="lumbre-onda absolute top-[34%] left-[37%] h-[3%] w-[3%] bg-cozy-paper-light" aria-hidden />
      <span className="lumbre-onda absolute top-[28%] left-[39.5%] h-[3%] w-[3%] bg-cozy-paper-light [animation-delay:0.3s]" aria-hidden />
      <Personaje avatar="bruno" dir="left" className="absolute top-[40%] right-[5%] w-[15%] opacity-75" />
      <span className="cozy-chip absolute top-[5%] left-[4%] flex items-center gap-1.5 px-2 py-1 text-[12px] leading-none">
        <PixelIcon name="mic" size={12} color="var(--color-cozy-green)" />
        <PixelIcon name="cam" size={12} color="var(--color-cozy-green)" />
        se oyen y se ven
      </span>
      <span className="cozy-chip absolute right-[3%] bottom-[6%] flex items-center gap-1.5 px-2 py-1 text-[12px] leading-none">
        <PixelIcon name="mic" size={12} off />
        muy lejos
      </span>
    </div>
  );
}
