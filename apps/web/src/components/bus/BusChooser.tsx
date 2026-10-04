"use client";

// E en la estación con casas ajenas a las que se puede entrar (abiertas o que me dejaron pasar): antes de
// subir se elige a cuál se va. En la parada "Casa" el servidor baja a cada uno en la que eligió (si al
// llegar ya no lo dejan entrar, en la suya).
import { useEffect } from "react";
import { boardBusTo, casasAbiertasPara, useCasasStore } from "@/game/casaVisitas";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";

export function BusChooser() {
  const choosing = useCasasStore((s) => s.choosing);
  const casas = useCasasStore((s) => s.casas);
  const me = useOfficeStore(selectMyUserId);
  const setChoosing = useCasasStore((s) => s.setChoosing);
  useEffect(() => {
    if (!choosing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setChoosing(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choosing, setChoosing]);
  if (!choosing) return null;
  // `casas` hace que la lista se recalcule si alguien abre o cierra la suya mientras se elige.
  void casas;
  const others = casasAbiertasPara(me);

  return (
    <div role="dialog" aria-label="¿A qué casa vas?" className="cozy-panel pointer-events-auto absolute top-1/3 left-1/2 z-20 flex w-[min(340px,calc(100%-1.5rem))] -translate-x-1/2 flex-col gap-2 px-5 py-4">
      <p className="flex items-center gap-2 text-[15px]">
        <PixelIcon name="home" size={16} color="var(--color-cozy-wood)" />
        ¿A qué casa vas?
      </p>
      <button type="button" onClick={() => boardBusTo()} className="cozy-btn cozy-btn-primary justify-start">
        A mi casa
      </button>
      {others.map((c) => (
        <button key={c.ownerId} type="button" onClick={() => boardBusTo(c.ownerId)} className="cozy-btn justify-start">
          A la casa de {c.ownerName || "alguien"}
          {c.modo === "abierta" && <span className="ml-auto text-[12px] text-cozy-ink-soft">abierta</span>}
        </button>
      ))}
      <button type="button" onClick={() => setChoosing(false)} className="cozy-btn mt-1 self-end px-2.5 py-1 text-[13px]">
        Ahora no
      </button>
    </div>
  );
}
