"use client";

// El mapa de la cabaña: todos los niveles (una pestaña por nivel), con los nombres de las salas y un punto
// por persona con el color de su estado. Clic en una sala o en alguien: viaje rápido (o caminando, si
// queda en mi nivel y cerca). Debajo, las mismas salas y personas como botones (teclado y lectores de
// pantalla). El dibujo del nivel es el del minimapa (`minimapBackground`).
import { getWorld, zoneAt, type OfficeMap } from "@hyvento/map";
import type { PresenceStatus } from "@hyvento/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { worldToScreen, screenToWorld } from "@/game/iso/projection";
import { getRoom } from "@/game/network";
import { useOfficeStore } from "@/game/store";
import { destinations, goToPlace, travelBlockFor, travelBlockText, travelToPerson } from "@/game/viaje";
import { COZY, cozyFontFamily, STATUS_HEX } from "@/lib/cozy";
import { PixelIcon } from "../Cozy";
import { minimapBackground } from "../Minimap";
import { OfficeDialog } from "../OfficeDialog";
import { STATUS_TEXT } from "../palette/defaultCommands";

const W = 560;
const H = 360;
/** Escalas posibles (se elige la más grande que entra: el dibujo del nivel se guarda por escala). */
const SCALES = [0.04, 0.06, 0.08, 0.12, 0.18, 0.27, 0.4, 0.6];
const DOT = 8;

interface Dot {
  sessionId: string;
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
  status: PresenceStatus;
}

/** Quién está dónde (todas las personas, de todos los niveles), leído del estado de la sala. */
function useEveryone(): Dot[] {
  const [dots, setDots] = useState<Dot[]>([]);
  useEffect(() => {
    const read = () => {
      const out: Dot[] = [];
      getRoom()?.state.players.forEach((p, sessionId) => {
        if (p.userId) out.push({ sessionId, userId: p.userId, name: p.name, area: p.area, x: p.x, y: p.y, status: p.status });
      });
      setDots(out);
    };
    read();
    const id = window.setInterval(read, 500);
    return () => window.clearInterval(id);
  }, []);
  return dots;
}

/** Caja del nivel en px de la vista isométrica. */
function boundsOf(map: OfficeMap) {
  const ts = map.tileSize;
  const c = [worldToScreen(0, 0), worldToScreen(map.width * ts, 0), worldToScreen(0, map.height * ts), worldToScreen(map.width * ts, map.height * ts)];
  const minX = Math.min(...c.map((p) => p.x));
  const maxX = Math.max(...c.map((p) => p.x));
  const minY = Math.min(...c.map((p) => p.y));
  const maxY = Math.max(...c.map((p) => p.y));
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

export function WorldMap({ onClose }: { onClose: () => void }) {
  const areas = useMemo(() => [...getWorld().areas.values()], []);
  const myArea = useOfficeStore((s) => s.area);
  const sessionId = useOfficeStore((s) => s.sessionId);
  const [areaId, setAreaId] = useState(() => myArea || areas[0]!.id);
  const map = areas.find((a) => a.id === areaId) ?? areas[0]!;
  const everyone = useEveryone();
  const here = everyone.filter((d) => d.area === map.id);
  const places = destinations().filter((d) => d.area === map.id && d.kind === "zone");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<string | null>(null);

  const box = boundsOf(map);
  const scale = [...SCALES].reverse().find((s) => box.w * s <= W - 16 && box.h * s <= H - 16) ?? SCALES[0]!;
  const ox = (W - box.w * scale) / 2;
  const oy = (H - box.h * scale) / 2;
  const toCanvas = (x: number, y: number) => {
    const p = worldToScreen(x, y);
    return { x: (p.x - box.minX) * scale + ox, y: (p.y - box.minY) * scale + oy };
  };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COZY.void;
    ctx.fillRect(0, 0, W, H);
    const bg = minimapBackground(map, scale);
    ctx.drawImage(bg.canvas, Math.round(ox - 1), Math.round(oy - 1));
    // Los nombres de las salas, sobre su centro.
    ctx.font = `11px ${cozyFontFamily()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Un nombre que se montaría sobre otro no se escribe (sigue en la lista de abajo y al pasar el mouse).
    const taken: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const z of map.zones) {
      if (!places.some((p) => p.zoneId === z.id)) continue;
      const c = toCanvas(z.x + z.width / 2, z.y + z.height / 2);
      const half = ctx.measureText(z.name).width / 2 + 2;
      const r = { x0: c.x - half, x1: c.x + half, y0: c.y - 7, y1: c.y + 7 };
      if (taken.some((t) => r.x0 < t.x1 && r.x1 > t.x0 && r.y0 < t.y1 && r.y1 > t.y0)) continue;
      taken.push(r);
      ctx.lineWidth = 3;
      ctx.strokeStyle = COZY.frame;
      ctx.strokeText(z.name, c.x, c.y);
      ctx.fillStyle = hover === `zona:${z.id}` ? COZY.gold : COZY.paperLight;
      ctx.fillText(z.name, c.x, c.y);
    }
    // Las personas: un cuadrito con el color de su estado; yo con el marco rojo.
    for (const d of here) {
      const c = toCanvas(d.x, d.y);
      const mine = d.sessionId === sessionId;
      const s = mine ? DOT + 2 : DOT;
      ctx.fillStyle = mine ? COZY.red : COZY.frame;
      ctx.fillRect(Math.round(c.x - s / 2) - 2, Math.round(c.y - s) - 2, s + 4, s + 4);
      ctx.fillStyle = STATUS_HEX[d.status] ?? STATUS_HEX.available;
      ctx.fillRect(Math.round(c.x - s / 2), Math.round(c.y - s), s, s);
    }
  });

  const eventPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const personAt = (cx: number, cy: number) =>
    [...here].reverse().find((d) => {
      const c = toCanvas(d.x, d.y);
      return Math.abs(cx - c.x) <= DOT && cy >= c.y - DOT * 1.6 && cy <= c.y + 3;
    }) ?? null;
  const zoneUnder = (cx: number, cy: number) => {
    const w = screenToWorld((cx - ox) / scale + box.minX, (cy - oy) / scale + box.minY);
    const z = zoneAt(map, w.x, w.y);
    return z && places.some((p) => p.zoneId === z.id) ? `zona:${z.id}` : null;
  };
  const hoverLabel = (() => {
    if (!hover) return null;
    if (hover.startsWith("zona:")) return places.find((p) => p.id === hover)?.name ?? null;
    const d = here.find((x) => x.sessionId === hover);
    return d ? `${d.name} · ${STATUS_TEXT[d.status]}` : null;
  })();

  const go = (fn: () => boolean) => {
    if (fn()) onClose();
  };

  return (
    <OfficeDialog title="Mapa de la cabaña" onClose={onClose} className="max-w-2xl">
      <div className="cozy-scroll flex min-h-0 flex-col gap-3 overflow-y-auto px-3 py-3 text-[14px]">
        <div role="tablist" aria-label="Niveles" className="flex flex-wrap gap-1">
          {areas.map((a) => {
            const n = everyone.filter((d) => d.area === a.id).length;
            return (
              <button
                key={a.id}
                role="tab"
                type="button"
                aria-selected={a.id === map.id}
                data-on={a.id === map.id || undefined}
                onClick={() => setAreaId(a.id)}
                className="cozy-btn gap-1.5 px-2 py-1 text-[13px]"
              >
                {a.id === myArea && <PixelIcon name="home" size={10} color="var(--color-cozy-red)" />}
                {a.name}
                {n > 0 && <span className="text-cozy-ink-soft">{n}</span>}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            role="img"
            aria-label={`Mapa de ${map.name}: ${here.length} ${here.length === 1 ? "persona" : "personas"}`}
            className="block w-full cursor-pointer border-2 border-cozy-frame [image-rendering:pixelated]"
            onMouseMove={(e) => {
              const p = eventPos(e);
              setHover(personAt(p.x, p.y)?.sessionId ?? zoneUnder(p.x, p.y));
            }}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => {
              const p = eventPos(e);
              const who = personAt(p.x, p.y);
              if (who) {
                if (who.sessionId !== sessionId) go(() => travelToPerson(who.sessionId));
                return;
              }
              const zone = zoneUnder(p.x, p.y);
              if (zone) go(() => goToPlace(zone));
              else if (map.id !== myArea) go(() => goToPlace(`nivel:${map.id}`));
            }}
          />
          {hoverLabel && <span className="cozy-chip pointer-events-none absolute top-2 left-2 px-2 py-0.5 text-[12px]">{hoverLabel}</span>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <section>
            <h3 className="mb-1.5 text-[13px] text-cozy-ink-soft">Salas de {map.name}</h3>
            <ul className="flex flex-col gap-1">
              {map.id !== myArea && <PlaceButton id={`nivel:${map.id}`} label={`Ir a ${map.name}`} onDone={onClose} />}
              {places.map((p) => (
                <PlaceButton key={p.id} id={p.id} label={p.name} onDone={onClose} />
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-1.5 text-[13px] text-cozy-ink-soft">Aquí {here.length === 1 ? "está" : "están"}</h3>
            {here.length === 0 && <p className="text-[13px] text-cozy-ink-soft">Nadie por ahora.</p>}
            <ul className="flex flex-col gap-1">
              {here.map((d) => (
                <li key={d.sessionId}>
                  <button
                    type="button"
                    disabled={d.sessionId === sessionId}
                    onClick={() => go(() => travelToPerson(d.sessionId))}
                    className="cozy-btn w-full justify-start gap-2 px-2 py-1 text-[13px]"
                  >
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 border-2 border-cozy-frame" style={{ background: STATUS_HEX[d.status] }} />
                    <span className="truncate">{d.sessionId === sessionId ? `${d.name} (tú)` : `Ir hasta ${d.name}`}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-cozy-ink-soft">{STATUS_TEXT[d.status]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </OfficeDialog>
  );
}

function PlaceButton({ id, label, onDone }: { id: string; label: string; onDone: () => void }) {
  const block = travelBlockFor({ kind: "place", id });
  const why = block && block !== "cooldown" ? travelBlockText(block) : null;
  return (
    <li>
      <button
        type="button"
        onClick={() => goToPlace(id) && onDone()}
        aria-disabled={why ? true : undefined}
        title={why ?? undefined}
        className={`cozy-btn w-full justify-start gap-2 px-2 py-1 text-[13px] ${why ? "opacity-60" : ""}`}
      >
        <PixelIcon name={id.startsWith("nivel:") ? "map" : "steps"} size={12} color="var(--color-cozy-wood)" />
        <span className="truncate">{label}</span>
        {why && <span className="ml-auto shrink-0 truncate text-[11px] text-cozy-ink-soft">{block === "here" ? "Aquí estás" : "No se puede"}</span>}
      </button>
    </li>
  );
}
