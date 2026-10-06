"use client";

// La tira de conversación (VIR-167), a la manera de Stardew pero nuestra: una sola, abajo al centro y
// angosta, de papel con un borde fino de madera. El retrato va en un medallón pixel que se monta sobre la
// esquina de arriba a la izquierda y el nombre en una plaquita de madera colgada encima. El texto sale letra
// por letra con un "blip" de la voz de cada quien. E, Enter o clic completa la línea y después pasa; la
// flechita que rebota dice que hay más. Las opciones son etiquetas de papel pegadas al borde derecho (en
// pantallas angostas, encima): se eligen con las flechas o con clic. Esc la cierra (en una cinemática, la
// salta). El narrador va sin medallón ni nombre, en cursiva y sin blip. Va encima de todo lo del juego (las
// franjas de las cinemáticas y las burbujas del chat incluidas); con las franjas puestas, se para encima de
// la de abajo. La lógica está en game/dialogo.ts y lib/dialogo.ts.
import { useEffect, useState } from "react";
import { useCineStore } from "@/game/cinematicas/store";
import { avanzarDialogo, blipDeVoz, elegirOpcion, escaparDialogo, moverOpcion, revisarAlcance, useDialogo } from "@/game/dialogo";
import { useOfficeStore } from "@/game/store";
import { blipEn, conOpciones, hayMas, msDeLinea } from "@/lib/dialogo";
import { lessMotion } from "@/lib/prefs";
import { PixelIcon, type PixelIconName } from "../Cozy";

/** Letras por segundo. */
const CPS = 40;
/** El borde pixel redondo del medallón (escalones en vez de curva). */
const MEDALLON =
  "polygon(30% 0,70% 0,70% 6%,85% 6%,85% 15%,94% 15%,94% 30%,100% 30%,100% 70%,94% 70%,94% 85%,85% 85%,85% 94%,70% 94%,70% 100%,30% 100%,30% 94%,15% 94%,15% 85%,6% 85%,6% 70%,0 70%,0 30%,6% 30%,6% 15%,15% 15%,15% 6%,30% 6%)";

/**
 * El texto que se escribe letra a letra, con el blip (con menos movimiento o `escrita`, de una y sin blip;
 * `voz` null = sin blip, el narrador).
 */
function useTyped(text: string, key: number, voz: number | null | undefined, escrita: boolean): [string, boolean, () => void] {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (escrita || lessMotion()) return setN(text.length);
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i > text.length) return clearInterval(id);
      if (voz !== null && blipEn(i, text[i - 1] ?? " ")) blipDeVoz(voz);
      setN(i);
    }, 1000 / CPS);
    return () => clearInterval(id);
  }, [text, key, voz, escrita]);
  return [text.slice(0, n), n >= text.length, () => setN(text.length)];
}

/** ¿El teclado es de un campo de texto (el chat, el celular)? Entonces la tira no se mete. */
const escribiendo = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return Boolean(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) || useOfficeStore.getState().typing;
};

export function TiraDialogo() {
  const d = useDialogo((s) => s.actual);
  // Con las franjas de una cinemática, la tira se para encima de la de abajo.
  const bars = useCineStore((s) => s.bars);
  const line = d ? (d.lineas[d.linea] ?? "") : "";
  const [shown, done, complete] = useTyped(line, d?.key ?? 0, d?.narrador ? null : d?.voz, Boolean(d?.escrita && d.linea === 0));
  const opciones = d && done && conOpciones(d) ? d.opciones! : null;
  const mas = Boolean(d && done && hayMas(d));

  // E, Enter, las flechas (con opciones) y Esc: antes que el juego (fase de captura).
  useEffect(() => {
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      if (escribiendo(e)) return;
      const k = e.key.toLowerCase();
      let handled = true;
      if (k === "e" || k === "enter" || k === " ") {
        // La tecla sostenida no pasa las líneas de corrido.
        if (e.repeat) handled = true;
        else if (!done) complete();
        else if (opciones) elegirOpcion();
        else avanzarDialogo();
      } else if (opciones && (k === "arrowup" || k === "arrowleft")) moverOpcion(-1);
      else if (opciones && (k === "arrowdown" || k === "arrowright")) moverOpcion(1);
      else if (k === "escape") escaparDialogo();
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [d, done, complete, opciones]);

  // Si quien habla quedó lejos, se cierra sola.
  useEffect(() => {
    if (!d) return;
    const id = setInterval(revisarAlcance, 300);
    return () => clearInterval(id);
  }, [d?.quien]);

  // El modo `momento` avanza solo.
  useEffect(() => {
    if (!d || d.modo !== "momento") return;
    const id = setTimeout(avanzarDialogo, msDeLinea(d, line, CPS));
    return () => clearTimeout(id);
  }, [d, line]);

  if (!d) return null;
  const narrador = Boolean(d.narrador);
  return (
    <div
      // Encima de las franjas de las cinemáticas (z-40) y de los paneles de la columna izquierda (z-45).
      className="pointer-events-none absolute left-1/2 z-[46] w-[min(560px,calc(100vw-5rem))] -translate-x-1/2 pl-8"
      style={{ bottom: bars ? "max(calc(11vh + 12px), calc(var(--cozy-bar-top, 7rem) + 0.75rem))" : "calc(var(--cozy-bar-top, 7rem) + 0.75rem)" }}
      role="dialog"
      aria-label={narrador || !d.nombre ? "Conversación" : `Conversación con ${d.nombre}`}
    >
      <div className="relative">
        {/* La plaquita del nombre, colgada encima de la tira (el narrador no tiene). */}
        {!narrador && d.nombre && (
          <div className="absolute -top-6 left-12 flex items-baseline gap-1.5 border-2 border-cozy-frame bg-cozy-wood px-2 py-0.5 shadow-[2px_2px_0_var(--color-cozy-frame)]">
            <span className="font-pixel text-[13px] leading-none text-cozy-paper-light">{d.nombre}</span>
            {d.rol && <span className="max-w-[16rem] truncate text-[11px] leading-none text-cozy-paper-dark max-sm:hidden">{d.rol}</span>}
          </div>
        )}
        {/* El medallón con el retrato, montado sobre la esquina (el narrador no tiene). */}
        {!narrador && (
          <div className="absolute -top-7 -left-9 z-10 size-[4.25rem] bg-cozy-frame p-[3px]" style={{ clipPath: MEDALLON }}>
            <div className="size-full bg-cozy-wood-light p-[2px]" style={{ clipPath: MEDALLON }}>
              <div className="size-full overflow-hidden bg-cozy-paper-dark" style={{ clipPath: MEDALLON }}>
                {d.retrato ? (
                  <img src={d.retrato} alt="" className="size-full object-cover object-top [image-rendering:pixelated]" />
                ) : (
                  <div className="flex size-full items-center justify-center text-cozy-wood">
                    <PixelIcon name={(d.icono as PixelIconName | undefined) ?? "chat"} size={22} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* La tira. */}
        <button
          type="button"
          onClick={() => (!done ? complete() : opciones ? undefined : avanzarDialogo())}
          className={`pointer-events-auto relative block w-full border-2 border-cozy-wood bg-cozy-paper-light py-2.5 pr-7 text-left shadow-[3px_3px_0_var(--color-cozy-frame)] ${narrador ? "pl-4" : "pl-10"}`}
          aria-live="polite"
        >
          <span className={`line-clamp-3 min-h-[1.4em] text-[14px] leading-snug ${narrador ? "text-cozy-ink-soft italic" : "text-cozy-ink"}`}>{shown}</span>
          {(mas || (done && !opciones)) && (
            <span className="absolute right-2 bottom-1.5 text-cozy-wood motion-safe:animate-[cozy-pop_0.8s_steps(2)_infinite]" aria-hidden>
              <PixelIcon name="chevron" size={12} />
            </span>
          )}
        </button>
        {/* Las opciones: etiquetas de papel pegadas al borde derecho (encima, si no caben). */}
        {opciones && (
          <ul className="pointer-events-auto absolute flex flex-col gap-1 max-lg:right-0 max-lg:bottom-full max-lg:mb-8 max-lg:items-end lg:top-0 lg:left-full lg:-ml-0.5" role="listbox" aria-label="Opciones">
            {opciones.map((o, i) => (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === d.elegida}
                  data-on={i === d.elegida || undefined}
                  onClick={() => elegirOpcion(o.id)}
                  onMouseEnter={() => i !== d.elegida && moverOpcion(i - d.elegida)}
                  className={`flex items-center gap-1 border-2 border-l-0 border-cozy-wood py-1 pr-2.5 pl-2 text-[13px] whitespace-nowrap text-cozy-ink shadow-[2px_2px_0_var(--color-cozy-frame)] max-lg:border-l-2 ${
                    i === d.elegida ? "bg-cozy-paper-dark outline-2 outline-cozy-red" : "bg-cozy-paper"
                  }`}
                >
                  {i === d.elegida && <PixelIcon name="chevron" size={9} className="-rotate-90" />}
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
