"use client";

// Lo de la casa del árbol (va en la sección de la sala del panel lateral, estando arriba): la escalera
// (recogerla cierra la casa hasta que alguien la baje o se vacíe) y el modo foco, que ven todos los de
// adentro. Las reglas las valida el servidor (CASA_ARBOL de @hyvento/shared).
import { CASA_ARBOL, focusLeftText } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { sendCasaArbolFocus, sendCasaArbolLadder, useCasaArbolStore } from "@/game/casaArbol";
import { serverNow } from "@/game/club/store";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";

export function CasaArbolRow() {
  const { locked, lockedBy, focus, focusEndsAt } = useCasaArbolStore();
  const inside = useOfficeStore((s) => Object.values(s.players).filter((p) => p.area === CASA_ARBOL.area).length);
  const now = useServerSecond(Boolean(focus));
  const minutes = Math.round(CASA_ARBOL.focusMs / 60_000);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => sendCasaArbolLadder(!locked)}
          data-on={locked}
          className="cozy-btn h-[32px] shrink-0 px-2"
          title={locked ? "Bajar la escalera: pueden volver a subir" : "Subir la escalera: nadie más sube hasta que la bajen o se vacíe la casa"}
        >
          <PixelIcon name={locked ? "lock" : "unlock"} size={14} />
          {locked ? "Bajar la escalera" : "Subir la escalera"}
        </button>
        <p className="min-w-0 flex-1 truncate text-[13px] opacity-80">
          {locked ? `Recogida${lockedBy ? ` por ${lockedBy}` : ""} · ${inside}/${CASA_ARBOL.capacity}` : `${inside}/${CASA_ARBOL.capacity} arriba`}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {!focus ? (
          <button type="button" onClick={() => sendCasaArbolFocus("start")} className="cozy-btn h-[32px] px-2" title="Un bloque de concentración para los de adentro, con descanso al final">
            <PixelIcon name="star" size={14} />
            Modo foco · {minutes} min
          </button>
        ) : (
          <>
            <span className="cozy-chip inline-flex h-[32px] items-center px-2 font-pixel text-[15px] tabular-nums">
              {focus === "focus" ? "Foco" : "Descanso"} {focusLeftText(focusEndsAt, now)}
            </span>
            <button
              type="button"
              onClick={() => sendCasaArbolFocus(focus === "focus" ? "break" : "start")}
              className="cozy-btn h-[32px] px-2"
              title={focus === "focus" ? "Pasar al descanso" : "Otro bloque de foco"}
            >
              <PixelIcon name={focus === "focus" ? "cup" : "star"} size={14} />
              {focus === "focus" ? "Descanso" : "Otro foco"}
            </button>
            <button type="button" onClick={() => sendCasaArbolFocus("stop")} className="cozy-btn h-[32px] w-[32px] p-0" title="Terminar el modo foco" aria-label="Terminar el modo foco">
              <PixelIcon name="close" size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** La hora del servidor, al segundo (solo corre mientras hace falta). */
function useServerSecond(active: boolean) {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!active) return;
    setNow(serverNow());
    const t = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}
