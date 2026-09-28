"use client";

// La fogata del observatorio: mientras el malvavisco está en el fuego, una tira sobre la barra con el
// palito que se dora y la barrita (crudo, tostadito, dorado, quemado) para saber cuándo sacarlo. Los
// tiempos los mide el servidor: aquí solo se anima con el mismo calor que sorteó.
import { roastStick } from "@hyvento/map/art";
import { doneness, donenessTone, MARSHMALLOW, roastProgress } from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { marshmallowAction, useObservatorio } from "@/game/observatorio";
import { useOfficeStore } from "@/game/store";

/** Lo que dice la ayuda "E" junto a la fogata. */
export function MarshmallowPromptLabel() {
  const me = useOfficeStore((s) => s.sessionId);
  const roasting = useObservatorio((s) => Boolean(me && s.roasts[me]));
  return <>{roasting ? "Sacar el malvavisco" : "Asar un malvavisco"}</>;
}

function StickArt({ tone }: { tone: 0 | 1 | 2 | 3 }) {
  const src = useMemo(() => (typeof document === "undefined" ? "" : toHtmlCanvas(roastStick(tone)).toDataURL()), [tone]);
  return src ? <img src={src} alt="" className="h-9 w-16 [image-rendering:pixelated]" /> : null;
}

/** Tramos de la barrita en fracción del tiempo hasta quemarse. */
const ZONES = [
  { to: MARSHMALLOW.toastedAtMs / MARSHMALLOW.burntAtMs, color: "#f3ead6", label: "Crudo" },
  { to: MARSHMALLOW.goldenAtMs / MARSHMALLOW.burntAtMs, color: "#e8c98f", label: "Tostadito" },
  { to: 1, color: "#d9923e", label: "Dorado" },
];

export function MarshmallowStrip() {
  const me = useOfficeStore((s) => s.sessionId);
  const roast = useObservatorio((s) => (me ? s.roasts[me] : undefined));
  const [, setFrame] = useState(0);
  useEffect(() => {
    if (!roast) return;
    let id = 0;
    const loop = () => {
      setFrame((n) => n + 1);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [roast]);
  if (!roast) return null;
  const elapsed = performance.now() - roast.startedAt;
  const d = doneness(elapsed, roast.heat);
  const progress = roastProgress(elapsed, roast.heat);
  return (
    <div className="cozy-chip pointer-events-auto flex items-center gap-3 px-3 py-1.5 text-[14px]" role="status" aria-label="Malvavisco en el fuego">
      <StickArt tone={donenessTone(d)} />
      <div className="flex w-44 flex-col gap-1">
        <div className="relative h-3 w-full border-2 border-cozy-wood" style={{ background: "#3a2014" }}>
          {ZONES.map((z, i) => {
            const from = i === 0 ? 0 : ZONES[i - 1]!.to;
            return <span key={z.label} className="absolute top-0 bottom-0" style={{ left: `${from * 100}%`, width: `${(z.to - from) * 100}%`, background: z.color }} />;
          })}
          <span className="absolute -top-1 -bottom-1 w-[3px] bg-cozy-ink" style={{ left: `calc(${Math.min(1, progress) * 100}% - 1px)` }} />
        </div>
        <span className="text-[12px] text-cozy-ink-soft">{d === "quemado" ? "¡Se está quemando!" : d === "dorado" ? "¡Ahora! Está dorado" : "Dale vueltas…"}</span>
      </div>
      <button type="button" onClick={marshmallowAction} className="flex items-center gap-1.5">
        <kbd className="cozy-kbd">E</kbd>
        Sacar
      </button>
    </div>
  );
}
