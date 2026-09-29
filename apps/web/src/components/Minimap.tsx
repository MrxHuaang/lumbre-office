"use client";

import type { OfficeMap } from "@hyvento/map";
import { useEffect, useRef, useState } from "react";
import { screenToWorld, worldToScreen } from "@/game/iso/projection";
import { useMinimapStore, type MinimapPerson } from "@/game/minimap";
import { useOfficeStore } from "@/game/store";
import { useFacilidadStore } from "@/game/facilidad";
import { COZY } from "@/lib/cozy";
import { PixelIcon } from "./Cozy";

const W = 256;
const H = 192;
/** Escalas del minimapa sobre los px de la vista isométrica (de lejos a de cerca). */
const ZOOMS = [0.08, 0.12, 0.18, 0.27, 0.4];
const ZOOM_KEY = "hyvento:minimapa-zoom";
/** Lado (px de pantalla) de la cabecita. */
const HEAD_PX = 14;

function loadZoom(): number {
  try {
    const v = Number(localStorage.getItem(ZOOM_KEY));
    if (Number.isInteger(v) && v >= 0 && v < ZOOMS.length) return v;
  } catch {
    // sin almacenamiento: el del medio
  }
  return 2;
}

/** Colores del piso en el minimapa (lo que no está, papel). */
const FLOOR_COLOR: Partial<Record<string, string>> = {
  grass: "#6aa84f",
  forest: "#3e6b31",
  soil: "#8a5a32",
  sand: "#e8cf8a",
  water: "#5d93cf",
  path: "#b9a58a",
  stone: "#a89a8a",
  road: "#5a5560",
  dock: COZY.woodLight,
  deck: COZY.woodLight,
  terrace: COZY.woodLight,
  casino: "#9c2f3a",
  dance: "#5b3a7a",
  cinema: "#4a2a4a",
  arcade: "#3a3a6a",
};

/** El nivel dibujado entero (rombos del piso y paredes) a una escala; se guarda por nivel y zoom. */
const backgrounds = new Map<string, { canvas: HTMLCanvasElement; ox: number; oy: number }>();

/** El nivel entero dibujado (también lo usa el mapa de la cabaña: facilidad/WorldMap.tsx). */
export function minimapBackground(map: OfficeMap, scale: number) {
  return background(map, scale);
}

function background(map: OfficeMap, scale: number) {
  const key = `${map.id}:${map.width}x${map.height}:${scale}`;
  const hit = backgrounds.get(key);
  if (hit) return hit;
  const ts = map.tileSize;
  const corners = [worldToScreen(0, 0), worldToScreen(map.width * ts, 0), worldToScreen(0, map.height * ts), worldToScreen(map.width * ts, map.height * ts)];
  const minX = Math.min(...corners.map((c) => c.x));
  const maxX = Math.max(...corners.map((c) => c.x));
  const minY = Math.min(...corners.map((c) => c.y));
  const maxY = Math.max(...corners.map((c) => c.y));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil((maxX - minX) * scale) + 2);
  canvas.height = Math.max(1, Math.ceil((maxY - minY) * scale) + 2);
  const ctx = canvas.getContext("2d")!;
  const at = (x: number, y: number) => {
    const p = worldToScreen(x, y);
    return [(p.x - minX) * scale + 1, (p.y - minY) * scale + 1] as const;
  };
  const diamond = (tx: number, ty: number) => {
    ctx.beginPath();
    ctx.moveTo(...at(tx * ts, ty * ts));
    ctx.lineTo(...at((tx + 1) * ts, ty * ts));
    ctx.lineTo(...at((tx + 1) * ts, (ty + 1) * ts));
    ctx.lineTo(...at(tx * ts, (ty + 1) * ts));
    ctx.closePath();
    ctx.fill();
  };
  for (let ty = 0; ty < map.height; ty++)
    for (let tx = 0; tx < map.width; tx++) {
      const i = ty * map.width + tx;
      const floor = map.floors[i];
      const blocked = map.blocked[i] === 1;
      if (!map.outdoor && !floor) continue;
      const color = floor ? FLOOR_COLOR[floor] : map.outdoor ? "#5f9a45" : COZY.paper;
      ctx.fillStyle = color ?? COZY.paper;
      diamond(tx, ty);
      // Lo que no se pisa (muebles, árboles), un poco más oscuro.
      if (!blocked) continue;
      ctx.fillStyle = "rgba(40, 20, 10, 0.3)";
      diamond(tx, ty);
    }
  // Las paredes, como rayas oscuras sobre los bordes.
  ctx.strokeStyle = COZY.frame;
  ctx.lineWidth = Math.max(1, scale * 6);
  ctx.beginPath();
  for (let y = 0; y <= map.height; y++)
    for (let x = 0; x < map.width; x++)
      if (map.wallH[y * map.width + x]) {
        ctx.moveTo(...at(x * ts, y * ts));
        ctx.lineTo(...at((x + 1) * ts, y * ts));
      }
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x <= map.width; x++)
      if (map.wallV[y * (map.width + 1) + x]) {
        ctx.moveTo(...at(x * ts, y * ts));
        ctx.lineTo(...at(x * ts, (y + 1) * ts));
      }
  ctx.stroke();
  const out = { canvas, ox: minX, oy: minY };
  backgrounds.set(key, out);
  return out;
}

/**
 * Minimapa del nivel donde estoy, centrado en mí, con las cabecitas de los demás. Clic en alguien: ir
 * hasta esa persona; clic en el piso: caminar ahí. Con + y − se acerca y se aleja.
 */
export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const map = useMinimapStore((s) => s.map);
  const me = useMinimapStore((s) => s.me);
  const people = useMinimapStore((s) => s.people);
  const sessionId = useOfficeStore((s) => s.sessionId);
  const walkToPlayer = useOfficeStore((s) => s.walkToPlayer);
  const walkToPoint = useOfficeStore((s) => s.walkToPoint);
  const [zoom, setZoomState] = useState(loadZoom);
  const [hover, setHover] = useState<MinimapPerson | null>(null);
  const scale = ZOOMS[zoom]!;
  const setZoom = (z: number) => {
    const next = Math.max(0, Math.min(ZOOMS.length - 1, z));
    setZoomState(next);
    try {
      localStorage.setItem(ZOOM_KEY, String(next));
    } catch {
      // solo para esta visita
    }
  };

  // Dónde cae el centro (yo) en px de la vista isométrica.
  const center = me ? worldToScreen(me.x, me.y) : map ? worldToScreen((map.width * map.tileSize) / 2, (map.height * map.tileSize) / 2) : { x: 0, y: 0 };
  const toCanvas = (x: number, y: number) => {
    const p = worldToScreen(x, y);
    return { x: (p.x - center.x) * scale + W / 2, y: (p.y - center.y) * scale + H / 2 };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COZY.void;
    ctx.fillRect(0, 0, W, H);
    if (!map) return;
    const bg = background(map, scale);
    ctx.drawImage(bg.canvas, Math.round((bg.ox - center.x) * scale + W / 2 - 1), Math.round((bg.oy - center.y) * scale + H / 2 - 1));
    for (const p of people) {
      const c = toCanvas(p.x, p.y);
      const mine = p.sessionId === sessionId;
      const s = mine ? HEAD_PX + 2 : HEAD_PX;
      const x = Math.round(c.x - s / 2);
      const y = Math.round(c.y - s);
      // Marco: el mío en rojo (como la selección), los demás en madera.
      ctx.fillStyle = mine ? COZY.red : COZY.frame;
      ctx.fillRect(x - 1, y - 1, s + 2, s + 2);
      ctx.fillStyle = COZY.paperLight;
      ctx.fillRect(x, y, s, s);
      if (p.head) ctx.drawImage(p.head.img, p.head.sx, p.head.sy, p.head.sw, p.head.sh, x, y, s, s);
    }
  });

  if (!map) return <p className="px-3 py-4 text-[13px] text-cozy-ink-soft">Cargando el mapa…</p>;

  const personAt = (cx: number, cy: number) => {
    // De adelante hacia atrás: el último dibujado queda encima.
    for (let i = people.length - 1; i >= 0; i--) {
      const p = people[i]!;
      const c = toCanvas(p.x, p.y);
      if (Math.abs(cx - c.x) <= HEAD_PX / 2 + 2 && cy >= c.y - HEAD_PX - 2 && cy <= c.y + 2) return p;
    }
    return null;
  };
  const eventPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  return (
    <div className="relative p-1">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="block w-full cursor-pointer border-2 border-cozy-frame [image-rendering:pixelated]"
        onMouseMove={(e) => {
          const pos = eventPos(e);
          setHover(personAt(pos.x, pos.y));
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const pos = eventPos(e);
          const who = personAt(pos.x, pos.y);
          if (who) {
            if (who.sessionId !== sessionId) walkToPlayer(who.sessionId);
            return;
          }
          const w = screenToWorld((pos.x - W / 2) / scale + center.x, (pos.y - H / 2) / scale + center.y);
          const ts = map.tileSize;
          if (w.x < 0 || w.y < 0 || w.x >= map.width * ts || w.y >= map.height * ts) return;
          walkToPoint(w.x, w.y);
        }}
      />
      {hover && hover.sessionId !== sessionId && (
        <span className="cozy-chip pointer-events-none absolute top-2 left-2 px-2 py-0.5 text-[12px]">Ir hasta {hover.name}</span>
      )}
      <div className="absolute right-2 bottom-2 flex flex-col gap-1">
        <button
          type="button"
          className="cozy-btn px-1 py-0.5 leading-none"
          onClick={() => useFacilidadStore.getState().show("worldmap")}
          title="Mapa de toda la cabaña"
          aria-label="Abrir el mapa de toda la cabaña"
        >
          <PixelIcon name="map" size={12} />
        </button>
        <button type="button" className="cozy-btn px-1.5 py-0.5 text-[14px] leading-none" disabled={zoom >= ZOOMS.length - 1} onClick={() => setZoom(zoom + 1)} title="Acercar" aria-label="Acercar el minimapa">
          +
        </button>
        <button type="button" className="cozy-btn px-1.5 py-0.5 text-[14px] leading-none" disabled={zoom <= 0} onClick={() => setZoom(zoom - 1)} title="Alejar" aria-label="Alejar el minimapa">
          −
        </button>
      </div>
      <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 bg-cozy-frame/80 px-1.5 py-0.5 text-[11px] text-cozy-paper-light">
        <PixelIcon name="home" size={10} color="currentColor" />
        {map.name}
      </span>
    </div>
  );
}
