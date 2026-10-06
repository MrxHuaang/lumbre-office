"use client";

// Pintura (VIR-71): pixel art de 16x16 con la paleta cozy. "Guardar como cuadro" lo deja en la mochila y
// se cuelga en la oficina con Decorar (el mueble `cuadro:<id>`). Las reglas (tope, lienzo válido, quién
// borra) las aplica la API (@hyvento/shared, painting-service.ts).
import { PAINTING, PAINTING_COLOR_NAMES, PAINTING_PALETTE, type PaintingDTO } from "@hyvento/shared";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePaintingStore } from "@/game/paintingStore";
import { PaintingThumb } from "../PaintingThumb";
import { blankCanvas, decodeCanvas, encodeCanvas, flipCanvas, floodFill, isBlankCanvas, lineBetween, paintAt, type Canvas } from "./paint";

type Tool = "pencil" | "eraser" | "fill" | "picker";

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: "pencil", label: "Lápiz", key: "B" },
  { id: "eraser", label: "Goma", key: "E" },
  { id: "fill", label: "Balde", key: "G" },
  { id: "picker", label: "Gotero", key: "I" },
];

/** Deshacer guarda los últimos 50 pasos (un trazo entero cuenta como uno). */
const HISTORY = 50;
const N = PAINTING.size;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? "Algo salió mal. Intenta de nuevo.");
  return body;
}

export function PaintApp() {
  const [canvas, setCanvas] = useState<Canvas>(blankCanvas);
  const [history, setHistory] = useState<Canvas[]>([]);
  const [color, setColor] = useState(1);
  const [tool, setTool] = useState<Tool>("pencil");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [gallery, setGallery] = useState<PaintingDTO[] | null>(null);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [cell, setCell] = useState(18);
  const areaRef = useRef<HTMLDivElement>(null);
  /** Trazo en curso: el lienzo de antes (para deshacerlo entero) y el último píxel pintado. */
  const stroke = useRef<{ before: Canvas; last: number } | null>(null);

  // El lienzo se ajusta a la ventana (también al maximizar): casillas de 10 a 28 px.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setCell(Math.max(10, Math.min(28, Math.floor(Math.min(el.clientWidth - 8, el.clientHeight - 8) / N))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const loadGallery = useCallback(() => {
    setGalleryError(null);
    call<{ paintings: PaintingDTO[] }>("/api/paintings").then(
      (r) => {
        setGallery(r.paintings);
        for (const p of r.paintings) usePaintingStore.getState().remember(p);
      },
      (e: Error) => setGalleryError(e.message),
    );
  }, []);
  useEffect(loadGallery, [loadGallery]);

  const commit = (next: Canvas, before: Canvas = canvas) => {
    if (next === before) return;
    setHistory((h) => [...h.slice(-(HISTORY - 1)), before]);
    setCanvas(next);
  };

  const undo = () => {
    const prev = history.at(-1);
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setCanvas(prev);
  };

  /** Píxel bajo el puntero (o null si quedó fuera del lienzo). */
  const cellAt = (e: React.PointerEvent<HTMLDivElement>): number | null => {
    const r = e.currentTarget.getBoundingClientRect();
    const border = 4;
    const x = Math.floor(((e.clientX - r.left - border) / (r.width - border * 2)) * N);
    const y = Math.floor(((e.clientY - r.top - border) / (r.height - border * 2)) * N);
    return x >= 0 && y >= 0 && x < N && y < N ? y * N + x : null;
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const i = cellAt(e);
    if (i === null) return;
    e.preventDefault();
    if (tool === "picker") {
      setColor(canvas[i] ?? 0);
      return setTool("pencil");
    }
    if (tool === "fill") return commit(floodFill(canvas, i, color));
    // El lápiz y la goma siguen el arrastre (también con el dedo: el lienzo se queda con el puntero).
    e.currentTarget.setPointerCapture(e.pointerId);
    stroke.current = { before: canvas, last: i };
    setCanvas((c) => paintAt(c, i, tool === "eraser" ? 0 : color));
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    const i = s && cellAt(e);
    if (!s || i === null || i === s.last) return;
    // Un arrastre rápido salta casillas: se pinta la recta desde el último píxel.
    const path = lineBetween(s.last, i);
    s.last = i;
    const ink = tool === "eraser" ? 0 : color;
    setCanvas((c) => path.reduce((acc, j) => paintAt(acc, j, ink), c));
  };

  const endStroke = () => {
    const s = stroke.current;
    stroke.current = null;
    if (s && s.before !== canvas) setHistory((h) => [...h.slice(-(HISTORY - 1)), s.before]);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      return undo();
    }
    const t = TOOLS.find((x) => x.key === e.key.toUpperCase());
    if (t && !e.ctrlKey && !e.metaKey && !e.altKey) setTool(t.id);
  };

  const save = async () => {
    if (isBlankCanvas(canvas)) return setNote({ ok: false, text: "El lienzo está en blanco: pinta algo antes de guardarlo." });
    setSaving(true);
    setNote(null);
    try {
      const { painting } = await call<{ painting: PaintingDTO }>("/api/paintings", {
        method: "POST",
        body: JSON.stringify({ title, pixels: encodeCanvas(canvas) }),
      });
      usePaintingStore.getState().remember(painting);
      setGallery((g) => [painting, ...(g ?? [])]);
      setNote({ ok: true, text: `«${painting.title}» quedó en tu mochila: cuélgalo en tu oficina con Decorar.` });
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: PaintingDTO) => {
    setConfirmDelete(null);
    try {
      await call(`/api/paintings/${p.id}`, { method: "DELETE" });
      setGallery((g) => g?.filter((x) => x.id !== p.id) ?? null);
    } catch (e) {
      setGalleryError((e as Error).message);
    }
  };

  const openCopy = (p: PaintingDTO) => {
    commit(decodeCanvas(p.pixels));
    setTitle(p.title === "Sin título" ? "" : p.title);
    setNote(null);
  };

  return (
    <div className="flex h-full min-h-0 gap-3 bg-cozy-paper p-3 text-[14px]" onKeyDown={onKey} tabIndex={-1}>
      <section className="flex min-w-0 flex-1 flex-col gap-2" aria-label="Lienzo">
        <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Herramientas">
          {TOOLS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTool(t.id)} aria-pressed={tool === t.id} className="cozy-btn px-2 py-1 text-[13px]">
              {t.label} <kbd className="cozy-kbd">{t.key}</kbd>
            </button>
          ))}
          <span className="mx-1 h-6 w-0.5 bg-cozy-wood" aria-hidden />
          <button type="button" onClick={undo} disabled={history.length === 0} className="cozy-btn px-2 py-1 text-[13px]">
            Deshacer
          </button>
          <button type="button" onClick={() => commit(flipCanvas(canvas))} className="cozy-btn px-2 py-1 text-[13px]">
            Espejo
          </button>
          <button type="button" onClick={() => commit(blankCanvas())} disabled={isBlankCanvas(canvas)} className="cozy-btn px-2 py-1 text-[13px]">
            Limpiar
          </button>
        </div>

        <div ref={areaRef} className="grid min-h-0 flex-1 place-items-center">
          <div
            role="grid"
            aria-label="Lienzo de 16 por 16"
            className="grid cursor-crosshair touch-none border-4 border-cozy-frame select-none"
            style={{ gridTemplateColumns: `repeat(${N}, ${cell}px)`, background: PAINTING_PALETTE[0] }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onLostPointerCapture={() => stroke.current && endStroke()}
          >
            {canvas.map((c, i) => (
              <div
                key={i}
                role="gridcell"
                aria-label={`${(i % N) + 1}, ${Math.floor(i / N) + 1}: ${PAINTING_COLOR_NAMES[c]}`}
                style={{ width: cell, height: cell, background: PAINTING_PALETTE[c] }}
                // Una rejilla tenue para ver dónde cae cada píxel.
                className="shadow-[inset_0_0_0_0.5px_rgb(91_43_14/0.12)]"
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-8 gap-1" role="radiogroup" aria-label="Paleta">
          {PAINTING_PALETTE.map((hex, i) => (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={color === i}
              aria-label={PAINTING_COLOR_NAMES[i]}
              title={PAINTING_COLOR_NAMES[i]}
              onClick={() => {
                setColor(i);
                if (tool === "eraser" || tool === "picker") setTool("pencil");
              }}
              className={`h-7 border-2 ${color === i ? "border-cozy-red outline-2 outline-cozy-red" : "border-cozy-frame"}`}
              style={{ background: hex }}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={PAINTING.titleMax}
            placeholder="Título del cuadro"
            aria-label="Título del cuadro"
            className="cozy-input min-w-0 flex-1 px-2 py-1"
          />
          <button type="button" onClick={save} disabled={saving} className="cozy-btn cozy-btn-primary px-3 py-1">
            {saving ? "Guardando…" : "Guardar como cuadro"}
          </button>
        </div>
        {note && (
          <p role="status" className={`text-[13px] leading-snug ${note.ok ? "text-cozy-green" : "font-semibold text-cozy-red-deep"}`}>
            {note.text}
          </p>
        )}
      </section>

      <aside className="flex w-44 shrink-0 flex-col gap-2 border-l-2 border-cozy-wood pl-3" aria-label="Mis cuadros">
        <h3 className="font-semibold">Mis cuadros</h3>
        {galleryError && <p className="text-[12px] font-semibold text-cozy-red-deep">{galleryError}</p>}
        {!gallery ? (
          <p className="text-[12px] text-cozy-ink-soft">Cargando…</p>
        ) : gallery.length === 0 ? (
          <p className="text-[12px] leading-snug text-cozy-ink-soft">Todavía no has guardado ninguno. Pinta algo y guárdalo para colgarlo en tu oficina.</p>
        ) : (
          <ul className="cozy-scroll flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
            {gallery.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 border-2 border-cozy-wood bg-cozy-paper-light p-1.5">
                <div className="flex items-center gap-2">
                  <PaintingThumb pixels={p.pixels} className="h-10 w-10 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold" title={p.title}>
                      {p.title}
                    </p>
                    <p className="text-[11px] text-cozy-ink-soft">{p.inBackpack ? "En la mochila" : "Colgado"}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => openCopy(p)} className="cozy-btn flex-1 px-1 py-0.5 text-[12px]" title="Abre una copia en el lienzo">
                    Abrir
                  </button>
                  {p.inBackpack &&
                    (confirmDelete === p.id ? (
                      <button type="button" onClick={() => remove(p)} className="cozy-btn cozy-btn-danger flex-1 px-1 py-0.5 text-[12px]">
                        ¿Seguro?
                      </button>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(p.id)} className="cozy-btn flex-1 px-1 py-0.5 text-[12px]">
                        Borrar
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-auto text-[11px] leading-snug text-cozy-ink-soft">
          Hasta {PAINTING.maxPerUser} cuadros. Para borrar uno colgado, primero guárdalo en la mochila desde Decorar.
        </p>
      </aside>
    </div>
  );
}
