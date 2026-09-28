"use client";

import { BODY_UP, FEET_Y, FRAME, SIT_DROP, drawHeldItem, type SheetDirection } from "@hyvento/map/art";
import type { LookInput } from "@hyvento/shared";
import { useEffect, useRef, useState } from "react";
import { MiniIcon } from "./icons";
import { dirIndex, lookKey, shadowSprite, sitSheet, stoolSprite, walkSheet } from "./sprites";

export type Pose = "walk" | "stand" | "sit";
const POSES: { id: Pose; label: string }[] = [
  { id: "walk", label: "Camina" },
  { id: "stand", label: "Quieto" },
  { id: "sit", label: "Sentado" },
];

/**
 * Orden al girar hacia la derecha, como un plato giratorio visto de frente (arrastrar a la derecha):
 * de frente a la derecha (sureste) → de espaldas a la derecha → de espaldas a la izquierda → de frente
 * a la izquierda.
 */
const RING: SheetDirection[] = ["right", "up", "left", "down"];
const DIR_LABEL: Record<SheetDirection, string> = {
  right: "De frente, hacia la derecha",
  up: "De espaldas, hacia la derecha",
  left: "De espaldas, hacia la izquierda",
  down: "De frente, hacia la izquierda",
};
/** Frames de la caminata (como en la cabaña): paso A, quieto, paso B, quieto; a 8 por segundo. */
const WALK = [1, 0, 2, 0] as const;
const STEP_MS = 125;
/** Píxeles de arrastre para girar un cuarto de vuelta. */
const DRAG_STEP = 28;
/** Alto del lienzo: el frame más 3 filas para que entren las patas del taburete. */
const H = FRAME + 3;
/**
 * Dónde va lo de la mano según hacia dónde mira (como HANDS de game/Avatar.ts): corrimiento desde el
 * centro y si queda delante del cuerpo (de frente) o detrás (de espaldas).
 */
const HAND: Record<SheetDirection, { dx: number; front: boolean }> = {
  down: { dx: 4, front: true },
  right: { dx: -5, front: true },
  left: { dx: 7, front: false },
  up: { dx: -7, front: false },
};

const heldCache = new Map<string, HTMLCanvasElement | null>();
/** El dibujo de lo de la mano (items.ts) como lienzo, o null si no tiene. */
function heldCanvas(art: string, left?: number): HTMLCanvasElement | null {
  const key = `${art}|${left ?? ""}`;
  const hit = heldCache.get(key);
  if (hit !== undefined) return hit;
  const px = drawHeldItem(art, left !== undefined ? { left } : {});
  let el: HTMLCanvasElement | null = null;
  if (px.width > 1) {
    el = document.createElement("canvas");
    el.width = px.width;
    el.height = px.height;
    el.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
  }
  heldCache.set(key, el);
  return el;
}

/**
 * Vista previa grande del personaje: camina en bucle (o se queda quieto, o se sienta en un taburete) y
 * se gira con los botones, arrastrando o con las flechas del teclado. `held` (un dibujo de items.ts) es
 * lo que lleva en la mano, con `heldLeft` usos.
 */
export function LookPreview({ look, held = "", heldLeft, className = "" }: { look: LookInput; held?: string; heldLeft?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dir, setDir] = useState<SheetDirection>("right");
  const [pose, setPose] = useState<Pose>("walk");
  const drag = useRef<{ id: number; x: number } | null>(null);
  const key = lookKey(look);
  // El bucle de animación lee lo último sin reiniciarse en cada cambio.
  const live = useRef({ look, key, dir, pose, held, heldLeft });
  useEffect(() => {
    live.current = { look, key, dir, pose, held, heldLeft };
  });

  // Con "reducir movimiento" empieza quieto.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPose("stand");
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let drawn = "";
    const paint = (now: number) => {
      const { look, key, dir, pose, held, heldLeft } = live.current;
      const col = pose === "walk" ? WALK[Math.floor(now / STEP_MS) % WALK.length]! : 0;
      const state = `${key}|${dir}|${pose}|${col}|${held}|${heldLeft ?? ""}`;
      if (state !== drawn) {
        drawn = state;
        ctx.clearRect(0, 0, FRAME, H);
        // Lo de la mano: detrás del cuerpo de espaldas, delante de frente (y sube y baja con el paso).
        const item = held ? heldCanvas(held, heldLeft) : null;
        const hand = HAND[dir];
        const bob = pose === "walk" && col !== 0 ? 1 : 0;
        const drawHeld = () => {
          if (!item) return;
          // Como en la cabaña: a la altura de la mano (sentado, más abajo).
          const bottom = FEET_Y + 1 - (BODY_UP.hand - 1 - (pose === "sit" ? SIT_DROP : 0)) - bob;
          ctx.drawImage(item, Math.round(FRAME / 2 + hand.dx - item.width / 2), bottom - item.height);
        };
        if (!hand.front) drawHeld();
        if (pose === "sit") {
          // Como en la cabaña: el centro del tile del taburete (8, 8 en el piso) cae bajo los pies.
          const s = stoolSprite();
          ctx.drawImage(s.canvas, FRAME / 2 - s.ox, FEET_Y - 8 - s.oy);
          ctx.drawImage(sitSheet(look, key), dirIndex(dir) * FRAME, 0, FRAME, FRAME, 0, 0, FRAME, FRAME);
        } else {
          const sh = shadowSprite();
          ctx.drawImage(sh, FRAME / 2 - sh.width / 2, FEET_Y - sh.height / 2);
          ctx.drawImage(walkSheet(look, key), col * FRAME, dirIndex(dir) * FRAME, FRAME, FRAME, 0, 0, FRAME, FRAME);
        }
        if (hand.front) drawHeld();
      }
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, []);

  const turn = (step: 1 | -1) => setDir((d) => RING[(RING.indexOf(d) + step + RING.length) % RING.length]!);

  return (
    // Angosto: la vista previa a la izquierda y los controles a su lado; ancho: todo en columna.
    <div
      className={`flex flex-col gap-2 @max-xl:flex-row @max-xl:flex-wrap @max-xl:items-center @max-xl:justify-center @max-xl:gap-3 ${className}`}
    >
      <div
        role="img"
        tabIndex={0}
        aria-label={`Vista previa: ${DIR_LABEL[dir].toLowerCase()}. Arrastra o usa las flechas para girarlo.`}
        title="Arrastra para girarlo"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            turn(e.key === "ArrowRight" ? 1 : -1);
          }
        }}
        onPointerDown={(e) => {
          drag.current = { id: e.pointerId, x: e.clientX };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) < DRAG_STEP) return;
          turn(dx > 0 ? 1 : -1);
          d.x += Math.sign(dx) * DRAG_STEP;
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        // pan-y: en el celular se puede seguir desplazando la página hacia arriba y abajo.
        className="relative cursor-grab touch-pan-y border-2 border-cozy-frame bg-[#5d9c46] shadow-[inset_0_0_0_2px_#4f8a3c] outline-none select-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cozy-red active:cursor-grabbing"
      >
        {/* Escala entera (x4, o x6 si hay lugar) para que los píxeles midan todos lo mismo. */}
        <canvas ref={canvasRef} width={FRAME} height={H} className="pixelated block h-auto w-40 @xl:[@media(min-height:560px)]:w-60" />
      </div>

      <div className="flex flex-col gap-2 @max-xl:w-40">
        <div className="flex items-center justify-between gap-1">
          <button type="button" onClick={() => turn(-1)} aria-label="Girar a la izquierda" className="cozy-btn px-2 py-1.5">
            <MiniIcon name="left" size={12} />
          </button>
          <div className="flex items-center gap-1.5" role="group" aria-label="Dirección">
            {RING.map((d) => (
              <button
                key={d}
                type="button"
                title={DIR_LABEL[d]}
                aria-label={DIR_LABEL[d]}
                aria-pressed={d === dir}
                onClick={() => setDir(d)}
                className={`h-2.5 w-2.5 border-2 border-cozy-frame ${d === dir ? "bg-cozy-red" : "bg-cozy-paper-light"}`}
              />
            ))}
          </div>
          <button type="button" onClick={() => turn(1)} aria-label="Girar a la derecha" className="cozy-btn px-2 py-1.5">
            <MiniIcon name="right" size={12} />
          </button>
        </div>

        <div role="group" aria-label="Pose" className="grid grid-cols-3 gap-1">
          {POSES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === pose}
              onClick={() => setPose(p.id)}
              className="cozy-btn px-1 py-1 text-[12px]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
