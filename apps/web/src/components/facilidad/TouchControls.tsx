"use client";

// Controles para pantallas táctiles: el joystick y, abajo a la derecha, los botones de E (usar lo de al
// lado, cuando hay algo) y F (usar lo de la mano, cuando hay algo en la mano). El joystick está fijo abajo
// a la izquierda (encima de la barra, con el chat cerrado) y además aparece donde se apoye el dedo en la
// mitad izquierda del juego si se arrastra: un toque sin arrastrar sigue siendo "caminar hasta ahí".
// Se esconden con una ventana o un panel abierto, con el PC prendido y decorando.
import { useEffect, useRef, useState } from "react";
import { isTouchScreen, setJoystick, tapTouch } from "@/game/touchInput";
import { useFacilidadStore } from "@/game/facilidad";
import { useOfficeStore } from "@/game/store";

/** Radio del joystick (px): hasta dónde se mueve la perilla. */
const RADIUS = 38;

export function TouchControls() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(pointer: coarse)");
    const update = () => setTouch(isTouchScreen());
    update();
    mq?.addEventListener?.("change", update);
    return () => mq?.removeEventListener?.("change", update);
  }, []);
  const panel = useOfficeStore((s) => s.panel);
  const pcOn = useOfficeStore((s) => s.pcOn);
  const chatOpen = useOfficeStore((s) => s.chatOpen);
  const decorating = useOfficeStore((s) => s.decorating || s.worldEditing);
  const open = useFacilidadStore((s) => s.open);
  const hidden = !touch || Boolean(panel) || pcOn || decorating || open !== null;
  // Al esconderse, el joystick queda suelto (si no, el personaje seguiría caminando solo).
  useEffect(() => {
    if (hidden) setJoystick(0, 0);
  }, [hidden]);
  if (hidden) return null;
  return (
    <>
      {!chatOpen && <Joystick />}
      <FloatingJoystick />
      <ActionButtons />
    </>
  );
}

/** Cuánto hay que arrastrar (px) para que un toque en el juego sea joystick y no "caminar hasta ahí". */
const DRAG_PX = 14;

/**
 * El joystick que aparece donde se apoya el dedo (mitad izquierda del juego). No toma el toque: el juego
 * lo recibe igual (tocar para caminar); recién al arrastrar se vuelve joystick. Con dos dedos es zoom.
 */
function FloatingJoystick() {
  const [at, setAt] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null);
  useEffect(() => {
    let origin: { id: number; x: number; y: number; on: boolean } | null = null;
    const touches = new Set<number>();
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touches.add(e.pointerId);
      if (touches.size > 1) {
        // Dos dedos: es el pellizco del zoom.
        origin = null;
        setAt(null);
        setJoystick(0, 0);
        return;
      }
      if (!(e.target instanceof HTMLCanvasElement) || e.clientX > window.innerWidth / 2) return;
      origin = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false };
    };
    const move = (e: PointerEvent) => {
      if (!origin || e.pointerId !== origin.id) return;
      let dx = e.clientX - origin.x;
      let dy = e.clientY - origin.y;
      const len = Math.hypot(dx, dy);
      if (!origin.on && len < DRAG_PX) return;
      origin.on = true;
      if (len > RADIUS) {
        dx = (dx / len) * RADIUS;
        dy = (dy / len) * RADIUS;
      }
      setAt({ x: origin.x, y: origin.y, kx: dx, ky: dy });
      setJoystick(dx / RADIUS, dy / RADIUS);
    };
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (!origin || e.pointerId !== origin.id) return;
      if (origin.on) setJoystick(0, 0);
      origin = null;
      setAt(null);
    };
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("pointercancel", up, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setJoystick(0, 0);
    };
  }, []);
  if (!at) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed z-20 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center border-4 border-cozy-frame/70 bg-cozy-paper/35" style={{ left: at.x, top: at.y }}>
      <span className="block size-12 border-4 border-cozy-frame bg-cozy-wood-light" style={{ transform: `translate(${at.kx}px, ${at.ky}px)` }} />
    </div>
  );
}

function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);

  const moveTo = (clientX: number, clientY: number) => {
    const r = base.current?.getBoundingClientRect();
    if (!r) return;
    let dx = clientX - (r.left + r.width / 2);
    let dy = clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    setJoystick(dx / RADIUS, dy / RADIUS);
  };
  const release = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    setJoystick(0, 0);
  };
  useEffect(() => release, []);

  return (
    <div
      ref={base}
      role="application"
      aria-label="Joystick: arrastra para caminar"
      className="touch-pad pointer-events-auto absolute left-4 z-20 grid size-28 place-items-center border-4 border-cozy-frame/70 bg-cozy-paper/35"
      style={{ bottom: "calc(var(--cozy-bar-top, 7rem) + 0.5rem)" }}
      onPointerDown={(e) => {
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && moveTo(e.clientX, e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <span
        aria-hidden
        className="block size-12 border-4 border-cozy-frame bg-cozy-wood-light shadow-[0_3px_0_var(--color-cozy-frame)]"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}

function ActionButtons() {
  const interact = useOfficeStore((s) => s.interact);
  const usable = useOfficeStore((s) => s.usable);
  const seatPrompt = useOfficeStore((s) => s.seatPrompt);
  const holding = useOfficeStore((s) => (s.sessionId ? Boolean(s.players[s.sessionId]?.held) : false));
  // E sirve si hay algo al lado: un objeto, un mueble o un asiento (sentarse o pararse).
  const canE = Boolean(interact || usable || seatPrompt);
  if (!canE && !holding) return null;
  return (
    <div className="pointer-events-auto absolute right-4 z-20 flex items-end gap-3" style={{ bottom: "calc(var(--cozy-bar-top, 7rem) + 0.75rem)" }}>
      {holding && <TouchKey label="F" title="Usar lo de la mano" onTap={() => tapTouch("f")} small />}
      {canE && <TouchKey label="E" title={usable?.label ?? "Usar lo de al lado"} onTap={() => tapTouch("e")} />}
    </div>
  );
}

function TouchKey({ label, title, onTap, small = false }: { label: string; title: string; onTap: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onPointerDown={(e) => {
        e.preventDefault();
        onTap();
      }}
      className={`touch-pad cozy-btn cozy-btn-primary grid place-items-center p-0 font-semibold ${small ? "size-12 text-[18px]" : "size-16 text-[24px]"}`}
    >
      {label}
    </button>
  );
}
