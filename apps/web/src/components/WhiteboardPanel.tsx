"use client";

// La pizarra de la sala (oficina o sala de reuniones): se dibuja con el mouse o el dedo y todos los que
// la tienen abierta ven cada trazo al soltarlo. Deshacer quita el último trazo propio; borrar entera, el
// dueño de la oficina (en la sala de reuniones, cualquiera). Queda guardada para la próxima vez.
import { BOARD, BOARD_BACKGROUND, BOARD_COLORS, BOARD_ERASER, BOARD_WIDTHS, type BoardStroke, type BoardStrokeInput } from "@hyvento/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { onBoardEvent, sendBoard, sendBoardStroke } from "@/game/network";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";

type Tool = BoardStrokeInput["color"];
type Width = BoardStrokeInput["width"];
const COLOR_NAMES: Record<string, string> = {
  "#2b2233": "Negro",
  "#d93a2b": "Rojo",
  "#3a6fb0": "Azul",
  "#4f8a3c": "Verde",
  "#e0923e": "Naranja",
  "#7a4bb0": "Morado",
};
/** Distancia mínima (en unidades de la pizarra) entre dos puntos seguidos de un trazo. */
const MIN_STEP = 3;

function paint(ctx: CanvasRenderingContext2D, s: Pick<BoardStroke, "color" | "width" | "points">) {
  const p = s.points;
  if (p.length < 2) return;
  ctx.strokeStyle = s.color === BOARD_ERASER ? BOARD_BACKGROUND : s.color;
  ctx.fillStyle = ctx.strokeStyle;
  // El borrador es más grueso que la tiza del mismo tamaño.
  ctx.lineWidth = s.color === BOARD_ERASER ? s.width * 2.5 : s.width;
  if (p.length === 2) {
    ctx.beginPath();
    ctx.arc(p[0]!, p[1]!, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(p[0]!, p[1]!);
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i]!, p[i + 1]!);
  ctx.stroke();
}

export function WhiteboardPanel({ onClose }: { onClose: () => void }) {
  const zone = useOfficeStore((s) => s.zone);
  const [board] = useState(() => zone?.id ?? "");
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<BoardStroke[]>([]);
  const drawing = useRef<number[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [canClear, setCanClear] = useState(false);
  const [tool, setTool] = useState<Tool>(BOARD_COLORS[0]);
  const [width, setWidth] = useState<Width>(BOARD_WIDTHS[1]);

  const redraw = useCallback(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = BOARD_BACKGROUND;
    ctx.fillRect(0, 0, BOARD.width, BOARD.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes.current) paint(ctx, s);
    if (drawing.current) paint(ctx, { color: tool, width, points: drawing.current });
  }, [tool, width]);
  // El listener de la red vive mientras la pizarra está abierta: dibuja con la herramienta de ahora.
  const redrawRef = useRef(redraw);
  redrawRef.current = redraw;

  // Abrir la pizarra de la sala y escuchar lo que dibujan los demás.
  useEffect(() => {
    if (!board) return;
    const off = onBoardEvent((e) => {
      if (e.board !== board) return;
      if (e.kind === "state") {
        strokes.current = e.strokes;
        setCanClear(e.canClear);
        setLoaded(true);
      } else if (e.kind === "stroke") {
        // Si es mi trazo que vuelve del servidor (con su id), reemplaza al provisorio.
        const key = e.stroke.points.join(",");
        const i = strokes.current.findIndex((s) => s.id.startsWith("local-") && s.points.join(",") === key);
        const rest = i >= 0 ? strokes.current.filter((_, k) => k !== i) : strokes.current;
        strokes.current = [...rest, e.stroke];
      }
      else strokes.current = e.ids === "all" ? [] : strokes.current.filter((s) => !e.ids.includes(s.id));
      redrawRef.current();
    });
    sendBoard("open", board);
    return () => {
      off();
      sendBoard("close", board);
    };
  }, [board]);

  useEffect(redraw, [redraw]);

  // Mientras está abierta, el teclado es de la pizarra (Esc cierra, Ctrl+Z deshace).
  useEffect(() => {
    const { setTyping } = useOfficeStore.getState();
    setTyping(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        sendBoard("undo", board);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      setTyping(false);
      window.removeEventListener("keydown", onKey);
    };
  }, [board, onClose]);

  // Si me voy de la sala, la pizarra se cierra.
  useEffect(() => {
    if (zone?.id !== board) onClose();
  }, [zone?.id, board, onClose]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * BOARD.width);
    const y = Math.round(((e.clientY - r.top) / r.height) * BOARD.height);
    return [Math.min(BOARD.width, Math.max(0, x)), Math.min(BOARD.height, Math.max(0, y))] as const;
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!loaded) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = [...at(e)];
    redraw();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pts = drawing.current;
    if (!pts) return;
    const [x, y] = at(e);
    const lx = pts[pts.length - 2]!;
    const ly = pts[pts.length - 1]!;
    if (Math.hypot(x - lx, y - ly) < MIN_STEP || pts.length >= BOARD.maxPoints) return;
    pts.push(x, y);
    redraw();
  };
  const up = () => {
    const pts = drawing.current;
    drawing.current = null;
    if (!pts) return;
    sendBoardStroke(board, { color: tool, width, points: pts });
    // Queda dibujado hasta que vuelve del servidor (con su id), así no parpadea.
    strokes.current = [...strokes.current, { id: `local-${Date.now()}`, by: "", color: tool, width, points: pts }];
    redraw();
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgb(42_32_51/0.55)] p-3" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal aria-label="Pizarra" className="cozy-panel flex max-h-full w-[min(820px,100%)] flex-col gap-2.5 overflow-y-auto p-3">
        <header className="flex items-center gap-3">
          <h2 className="flex-1 text-[18px] font-semibold">Pizarra · {zone?.name ?? ""}</h2>
          <button type="button" onClick={onClose} className="cozy-btn px-2 py-1 text-[13px]" aria-label="Cerrar la pizarra">
            <span className="inline-flex items-center gap-1">
              Esc <PixelIcon name="close" size={10} />
            </span>
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Herramientas">
          {BOARD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTool(c)}
              aria-pressed={tool === c}
              aria-label={COLOR_NAMES[c] ?? c}
              title={COLOR_NAMES[c]}
              className="cozy-btn h-8 w-8 p-0"
            >
              <span className="block h-4 w-4 border-2 border-[#4a2a1c]" style={{ background: c }} />
            </button>
          ))}
          <button type="button" onClick={() => setTool(BOARD_ERASER)} aria-pressed={tool === BOARD_ERASER} className="cozy-btn px-2 py-1 text-[13px]">
            Borrador
          </button>
          <span className="mx-1 h-6 w-0.5 bg-[#c9a36a]" aria-hidden />
          {BOARD_WIDTHS.map((w, i) => (
            <button key={w} type="button" onClick={() => setWidth(w)} aria-pressed={width === w} aria-label={["Fino", "Medio", "Grueso"][i]} className="cozy-btn h-8 w-8 p-0">
              <span className="block rounded-full bg-[#4a2a1c]" style={{ width: 3 + i * 4, height: 3 + i * 4 }} />
            </button>
          ))}
          <span className="flex-1" />
          <button type="button" onClick={() => sendBoard("undo", board)} className="cozy-btn px-2 py-1 text-[13px]" title="Deshacer mi último trazo (Ctrl+Z)">
            Deshacer
          </button>
          {canClear && (
            <button
              type="button"
              onClick={() => window.confirm("¿Borrar toda la pizarra? Se borra para todos.") && sendBoard("clear", board)}
              className="cozy-btn cozy-btn-danger px-2 py-1 text-[13px]"
            >
              Borrar todo
            </button>
          )}
        </div>

        <canvas
          ref={canvas}
          width={BOARD.width}
          height={BOARD.height}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label="Superficie de la pizarra"
          className="w-full touch-none border-4 border-[#8a5a2b] shadow-[3px_3px_0_#4a2a1c]"
          style={{ aspectRatio: `${BOARD.width} / ${BOARD.height}`, cursor: tool === BOARD_ERASER ? "cell" : "crosshair", background: BOARD_BACKGROUND }}
        />
        <p className="text-[12px] text-cozy-ink-soft">
          {loaded ? "Lo que dibujas lo ven al instante los que están en la sala. Queda guardada para la próxima." : "Abriendo la pizarra…"}
        </p>
      </section>
    </div>
  );
}
