"use client";

// Pantalla de carga al entrar a la cabaña: tu personaje camina por el sendero del jardín (el paisaje
// se desliza detrás, con árboles, faroles y cerca dibujados con el mismo arte del juego), "Entrando"
// con puntitos, una barra pixel que avanza y consejos que van cambiando.
import { drawFurniture, PixelCanvas, at, C } from "@hyvento/map/art";
import { useEffect, useMemo, useState } from "react";
import type { Profile } from "@/game/store";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { CharacterSprite } from "./CharacterSprite";
import { CozyTitle } from "./Cozy";
import { LumbreLogo } from "./lumbre/Logo";

const TIPS = [
  "Acércate a algo con un rombito dorado y aprieta E.",
  "Con F usas lo que tienes en la mano: un tinto, un trago, un cigarro…",
  "Tab cambia la fila de la barra y los números eligen la casilla: lo elegido va en la mano.",
  "T abre los emotes. Enter, el chat.",
  "En la tienda de la planta baja se compran muebles para tu oficina.",
  "El casino, el club, el cine y el arcade están en el sótano.",
  "En el muelle del lago se pesca. Algunos peces solo pican con lluvia, niebla o de madrugada.",
  "Sube al piso 3: biblioteca, chimenea y una terraza con vista al lago.",
  "Tu oficina está en el piso 2. Puedes cerrarla con llave.",
  "Todos los días hay una recompensa en el buzón del jardín.",
];

/** Tira del paisaje (se repite de lado): pasto, sendero, y árboles, faroles y cerca del juego. */
function sceneryStrip(): HTMLCanvasElement {
  const W = 256;
  const H = 72;
  const c = new PixelCanvas(W, H);
  const ground = 54;
  for (let y = ground; y < H; y++)
    for (let x = 0; x < W; x++) c.set(x, y, y < ground + 2 ? at(C.grass, 4) : y < ground + 9 ? at(C.stone, (x + y) % 5 === 0 ? 2 : 3) : at(C.grass, (x * 7 + y) % 9 === 0 ? 2 : 3));
  const props: [string, number, number][] = [
    ["tree", 10, 0],
    ["fence", 58, 2],
    ["fence", 74, 2],
    ["lamp-post", 98, 0],
    ["pine", 132, 0],
    ["bush", 170, 4],
    ["tree", 200, 0],
    ["fence", 234, 2],
  ];
  const out = toHtmlCanvas(c);
  const ctx = out.getContext("2d")!;
  for (const [type, x, dy] of props) {
    try {
      const s = drawFurniture(type);
      ctx.drawImage(toHtmlCanvas(s.canvas), x - Math.round(s.canvas.width / 2) + 8, ground + 3 - s.canvas.height + dy);
    } catch {
      // Si algún tipo cambió de nombre, la tira queda sin él.
    }
  }
  return out;
}

export function EntryLoader({ profile }: { profile: Profile | null }) {
  // El primero es fijo (igual en el servidor y el navegador); el azar arranca recién al montar.
  const [tip, setTip] = useState(0);
  const [strip, setStrip] = useState<string | null>(null);
  useEffect(() => {
    setTip(Math.floor(Math.random() * TIPS.length));
    setStrip(sceneryStrip().toDataURL());
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 3200);
    return () => clearInterval(id);
  }, []);
  const avatar = profile?.avatar ?? "carla";
  const look = useMemo(() => profile?.look ?? null, [profile?.look]);

  return (
    <div className="flex w-[min(560px,100%)] flex-col items-center">
      <LumbreLogo size={22} className="mb-5 opacity-90" />
      <CozyTitle className="text-5xl sm:text-6xl">
        Entrando<span className="cozy-dots" aria-hidden />
      </CozyTitle>

      {/* El sendero: la tira se desliza a la izquierda y el personaje camina en su lugar. */}
      <div className="relative mt-7 h-[144px] w-full overflow-hidden border-4 border-cozy-frame bg-[#86b8e6] shadow-[4px_4px_0_var(--color-cozy-frame)]">
        <div className="absolute inset-x-0 top-0 h-10 bg-[#b5d9f5]" aria-hidden />
        <div className="cozy-cloud absolute top-4 left-[20%] h-3 w-10 bg-white/80" aria-hidden />
        <div className="cozy-cloud absolute top-8 left-[65%] h-2.5 w-7 bg-white/70 [animation-delay:-6s]" aria-hidden />
        {strip && (
          <div
            aria-hidden
            className="loader-scroll pixelated absolute inset-x-0 bottom-0 h-[144px]"
            style={{ backgroundImage: `url(${strip})`, backgroundSize: "512px 144px", backgroundRepeat: "repeat-x" }}
          />
        )}
        <CharacterSprite avatar={avatar} look={look} dir="right" walking className="loader-bob absolute bottom-[4px] left-1/2 w-16 -translate-x-1/2" />
      </div>

      {/* Barra que avanza en pasos, como pixel-art. */}
      <div className="mt-5 h-5 w-[70%] border-4 border-cozy-frame bg-cozy-paper-dark p-[2px]" role="progressbar" aria-label="Cargando">
        <div className="loader-bar h-full bg-cozy-gold" />
      </div>

      <p className="mt-4 min-h-[2.6em] max-w-md text-center text-[15px] leading-snug text-cozy-paper-dark" aria-live="polite">
        {TIPS[tip]}
      </p>
    </div>
  );
}
