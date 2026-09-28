"use client";

// La máquina de peluches: se mete la moneda (el servidor cobra y arma la vitrina con su semilla), se mueve
// la garra con las flechas (o los botones) y se suelta con espacio. La garra baja, el servidor dice si
// agarró (con su azar, según qué tan centrada cayó) y sube con el peluche o vacía. El peluche va a la mochila.
import { drawHeldItem } from "@hyvento/map/art";
import { clawLayout, GARRA, plushById } from "@hyvento/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { sendClawDrop, sendClawStart, useMundoStore } from "@/game/mundo";
import { playClawGrab, playClawMotor } from "@/game/mundoSonidos";
import { sfx } from "@/game/sfx";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";
import { PanelShell, useMyPoints } from "../PointsPanels";

const W = 120;
const H = 96;
const RAIL_Y = 10;
const FLOOR_Y = 82;
/** Lo que tarda en bajar, en cerrar y en subir (ms): solo el dibujo. */
const DOWN_MS = 900;
const UP_MS = 900;
/** Velocidad de la garra con las flechas (fracción del recorrido por segundo). */
const SPEED = 0.45;

type Phase = "idle" | "starting" | "aiming" | "dropping" | "rising";

export function ClawPanel({ onClose }: { onClose: () => void }) {
  const points = useMyPoints();
  const claw = useMundoStore((s) => s.claw);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const s = useRef({
    x: 0.5,
    token: "",
    layout: clawLayout(1),
    startedAt: 0,
    dropAt: 0,
    held: { left: false, right: false },
    result: null as null | { won: boolean; plush: string; slot: number },
    seq: -1,
    phase: "idle" as Phase,
  });
  const sprites = useRef(new Map<string, HTMLCanvasElement>());
  const art = (id: string) => {
    let c = sprites.current.get(id);
    if (!c) {
      c = toHtmlCanvas(drawHeldItem(id));
      sprites.current.set(id, c);
    }
    return c;
  };
  const go = (p: Phase) => {
    s.current.phase = p;
    setPhase(p);
  };

  const drop = useCallback(() => {
    const r = s.current;
    if (r.phase !== "aiming" || performance.now() - r.startedAt < GARRA.minMs) return;
    r.dropAt = performance.now();
    go("dropping");
    playClawMotor(DOWN_MS);
    sendClawDrop(r.token, r.x);
  }, []);

  // Las respuestas: empezó (la vitrina) o cómo terminó; un error vuelve a la moneda.
  useEffect(() => {
    const r = s.current;
    if (!claw || claw.seq <= r.seq) return;
    r.seq = claw.seq;
    if (claw.kind === "error") return go("idle");
    if (claw.kind === "started") {
      r.token = claw.token;
      r.layout = clawLayout(claw.seed);
      r.startedAt = performance.now();
      r.x = 0.5;
      r.result = null;
      setMessage(null);
      return go("aiming");
    }
    r.result = { won: claw.won, plush: claw.plush, slot: claw.slot };
  }, [claw]);

  // El dibujo y el movimiento (cada cuadro).
  useEffect(() => {
    const c = canvas.current?.getContext("2d");
    if (!c) return;
    let id = 0;
    let last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(50, t - last) / 1000;
      last = t;
      const r = s.current;
      if (r.phase === "aiming") {
        const dir = (r.held.right ? 1 : 0) - (r.held.left ? 1 : 0);
        r.x = Math.max(0.04, Math.min(0.96, r.x + dir * SPEED * dt));
        // Se acabó el tiempo: baja sola donde esté.
        if (t - r.startedAt > GARRA.maxMs) drop();
      }
      // Qué tan abajo va la garra (0 arriba, 1 en el piso) y si ya cerró.
      let depth = 0;
      if (r.phase === "dropping") {
        depth = Math.min(1, (t - r.dropAt) / DOWN_MS);
        // Sin respuesta del servidor (se cortó la conexión): se vuelve a la moneda.
        if (depth >= 1 && !r.result && t - r.dropAt > 5_000) go("idle");
        if (depth >= 1 && r.result) {
          r.dropAt = t;
          playClawGrab();
          go("rising");
        }
      } else if (r.phase === "rising") {
        depth = Math.max(0, 1 - (t - r.dropAt) / UP_MS);
        if (depth <= 0) {
          const res = r.result;
          go("idle");
          if (res?.won) {
            sfx.win();
            setMessage(`¡Lo agarró! ${plushById(res.plush)?.name ?? "Un peluche"} a la mochila.`);
          } else {
            sfx.lose();
            setMessage("Uy, se le resbaló. ¿Otra monedita?");
          }
        }
      }
      draw(c, r, depth, art);
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [drop]);

  // Flechas (o A y D) mueven, espacio suelta.
  useEffect(() => {
    const set = (e: KeyboardEvent, on: boolean) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") s.current.held.left = on;
      else if (k === "arrowright" || k === "d") s.current.held.right = on;
      else if ((k === " " || k === "arrowdown" || k === "enter") && on) {
        e.preventDefault();
        if (s.current.phase === "aiming") drop();
        else if (s.current.phase === "idle") start();
      } else return;
      e.preventDefault();
    };
    const down = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  const start = () => {
    if (s.current.phase !== "idle") return;
    if (points < GARRA.price) return useOfficeStore.getState().notify(`No te alcanzan los puntos: cada intento cuesta ${GARRA.price}.`, "warning");
    setMessage(null);
    go("starting");
    sfx.chip();
    sendClawStart();
  };
  const hold = (side: "left" | "right", on: boolean) => {
    s.current.held[side] = on;
  };

  return (
    <PanelShell title="Máquina de peluches" icon="gift" onClose={onClose}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-full border-4 border-[#b0508a] bg-[#34194f] p-2 shadow-[4px_4px_0_#2a2033]">
          <canvas ref={canvas} width={W} height={H} className="block w-full [image-rendering:pixelated]" aria-label="La vitrina de la máquina" />
        </div>
        <p aria-live="polite" className="min-h-6 text-center text-[15px] text-cozy-ink">
          {message ??
            (phase === "aiming"
              ? "Flechas para mover · Espacio para soltar"
              : phase === "dropping" || phase === "rising"
                ? "Bajando…"
                : phase === "starting"
                  ? "Metiendo la moneda…"
                  : `Cada intento cuesta ${GARRA.price} puntos.`)}
        </p>
        <div className="flex w-full items-center justify-between gap-2">
          <span className="cozy-chip flex items-center gap-1 text-[13px]">
            <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
            {points} pts
          </span>
          {phase === "aiming" ? (
            <div className="flex gap-1.5">
              {(["left", "right"] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  aria-label={side === "left" ? "Mover a la izquierda" : "Mover a la derecha"}
                  onPointerDown={() => hold(side, true)}
                  onPointerUp={() => hold(side, false)}
                  onPointerLeave={() => hold(side, false)}
                  className="cozy-btn px-3 py-2"
                >
                  <PixelIcon name="chevron" size={12} className={side === "left" ? "rotate-90" : "-rotate-90"} />
                </button>
              ))}
              <button type="button" onClick={drop} className="cozy-btn cozy-btn-primary px-4 py-2 text-[15px]">
                Soltar
              </button>
            </div>
          ) : (
            <button type="button" onClick={start} disabled={phase !== "idle" || points < GARRA.price} className="cozy-btn cozy-btn-primary flex items-center gap-1 px-4 py-2 text-[15px]">
              <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
              Meter moneda ({GARRA.price})
            </button>
          )}
        </div>
        <p className="text-[13px] text-cozy-ink-soft">Mientras más centrada caiga sobre un peluche, mejor agarra. Los raros se resbalan más.</p>
      </div>
    </PanelShell>
  );
}

type Run = { x: number; layout: string[]; phase: Phase; result: null | { won: boolean; plush: string; slot: number } };

/** La vitrina: el fondo, los peluches en su puesto, el riel y la garra (abierta o cerrada, con o sin premio). */
function draw(c: CanvasRenderingContext2D, r: Run, depth: number, art: (id: string) => HTMLCanvasElement) {
  c.imageSmoothingEnabled = false;
  c.fillStyle = "#1e1430";
  c.fillRect(0, 0, W, H);
  // Brillo del vidrio y el piso de la vitrina.
  c.fillStyle = "rgba(255, 154, 230, 0.08)";
  c.fillRect(6, 4, 6, H - 12);
  c.fillStyle = "#5a3a72";
  c.fillRect(0, FLOOR_Y + 6, W, H - FLOOR_Y - 6);
  c.fillStyle = "#7a4b96";
  c.fillRect(0, FLOOR_Y + 6, W, 1);
  // La boca del premio a la derecha.
  c.fillStyle = "#12091c";
  c.fillRect(W - 14, FLOOR_Y - 6, 12, 12);
  const slotW = W / r.layout.length;
  const grabbed = r.result?.won && r.phase === "rising" ? r.result.slot : -1;
  r.layout.forEach((id, i) => {
    if (i === grabbed) return;
    const img = art(id);
    c.drawImage(img, Math.round(i * slotW + slotW / 2 - img.width), FLOOR_Y + 6 - img.height * 2, img.width * 2, img.height * 2);
  });
  // El riel y la garra.
  c.fillStyle = "#a8a4b0";
  c.fillRect(4, RAIL_Y - 2, W - 8, 2);
  const cx = Math.round(r.x * W);
  const cy = Math.round(RAIL_Y + depth * (FLOOR_Y - 18 - RAIL_Y));
  c.fillStyle = "#6e6a78";
  c.fillRect(cx - 3, RAIL_Y - 4, 6, 3);
  c.fillStyle = "#c8c4d0";
  c.fillRect(cx, RAIL_Y, 1, cy - RAIL_Y);
  const closed = r.phase === "rising";
  c.fillStyle = "#dcae3f";
  c.fillRect(cx - 3, cy, 7, 3);
  const open = closed ? 2 : 5;
  c.fillRect(cx - open - 1, cy + 3, 2, 6);
  c.fillRect(cx + open, cy + 3, 2, 6);
  c.fillRect(cx - open, cy + 8, 2, 1);
  c.fillRect(cx + open - 1, cy + 8, 2, 1);
  if (grabbed >= 0 && r.result) {
    const img = art(r.result.plush);
    c.drawImage(img, cx - img.width, cy + 6, img.width * 2, img.height * 2);
  }
  // La sombra de la garra en el piso, para apuntar.
  if (r.phase === "aiming") {
    c.fillStyle = "rgba(0, 0, 0, 0.35)";
    c.fillRect(cx - 4, FLOOR_Y + 5, 9, 1);
  }
}
