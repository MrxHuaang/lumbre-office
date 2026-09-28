import type { OfficeMap } from "@hyvento/map";
import { create } from "zustand";

/** La cabeza de alguien recortada de su hoja de personaje (para dibujarla chiquita en el minimapa). */
export interface MinimapHead {
  img: CanvasImageSource;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface MinimapPerson {
  sessionId: string;
  name: string;
  x: number;
  y: number;
  head: MinimapHead | null;
}

interface MinimapStore {
  map: OfficeMap | null;
  me: { x: number; y: number } | null;
  people: MinimapPerson[];
  publish: (feed: { map: OfficeMap; me: { x: number; y: number } | null; people: MinimapPerson[] }) => void;
}

/** Lo que ve el minimapa: el nivel donde estoy y quién está en él (lo publica la escena unas veces por segundo). */
export const useMinimapStore = create<MinimapStore>((set) => ({
  map: null,
  me: null,
  people: [],
  publish: (feed) => set(feed),
}));

const heads = new Map<string, MinimapHead | null>();

/**
 * La cabeza dentro de un frame de 40x40: se busca la primera fila con color y se toma un cuadrado de
 * ahí para abajo. Se calcula una vez por hoja (la del caminar quieto mirando al frente).
 */
export function headOf(source: CanvasImageSource & { width: number; height: number }, key: string, cutX: number, cutY: number, size: number): MinimapHead | null {
  const cached = heads.get(key);
  if (cached !== undefined) return cached;
  let head: MinimapHead | null = null;
  try {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(source, cutX, cutY, size, size, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let top = -1;
    let left = size;
    let right = -1;
    for (let y = 0; y < size && top < 0; y++) for (let x = 0; x < size; x++) if (data[(y * size + x) * 4 + 3]! > 0) top = y;
    if (top >= 0) {
      const rows = Math.min(14, size - top);
      for (let y = top; y < top + rows; y++)
        for (let x = 0; x < size; x++)
          if (data[(y * size + x) * 4 + 3]! > 0) {
            left = Math.min(left, x);
            right = Math.max(right, x);
          }
      const w = Math.max(rows, right - left + 1);
      const cx = (left + right) / 2;
      head = { img: c, sx: Math.round(cx - w / 2), sy: top, sw: w, sh: rows };
    }
  } catch {
    head = null;
  }
  heads.set(key, head);
  return head;
}
