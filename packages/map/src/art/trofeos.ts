// La vitrina de trofeos de las oficinas: un mueble bajo de madera con puertas de vidrio y tres repisas
// (mirando a +x). Vacía es el mueble del catálogo; con los logros del dueño se dibuja la misma vitrina con
// un trofeo por logro (hasta TROPHY_CASE_SLOTS), y el cliente la pone encima como una capa, igual que las
// fotos del tablón. Cada rareza tiene su trofeo: medalla de bronce, copa de plata, gema y estrella.
import type { AchievementRarity } from "@hyvento/shared";
import { C, OUT, mix } from "./palette";
import { at, flat, renderSprite, solidBox, type Ramp, type RGBA, type Shader, type Sprite } from "./pixel";
import { shadowUnder } from "./kit";

/** Cuántos trofeos caben: tres repisas de cuatro. */
export const TROPHY_CASE_SLOTS = 12;
const SHELVES = 3;
const PER_SHELF = TROPHY_CASE_SLOTS / SHELVES;

const H = 34;
/** Zócalo (con el cajón) y cornisa del frente, en unidades de arte. */
const BASE = 5;
const TOP = 2;
const FRAME = 1.6;

/** Orden de los trofeos en la vitrina: lo más difícil arriba a la izquierda. */
const PRESTIGE: readonly AchievementRarity[] = ["legendario", "epico", "raro", "comun"];

/** Dibujito de cada trofeo (de arriba abajo, 5x7): l luz, c medio, d sombra, b base de madera. */
const SHAPES: Record<AchievementRarity, readonly string[]> = {
  // Medalla colgada de un soporte.
  comun: [".lcd.", "lcccd", "lcccd", ".ccd.", "..b..", ".bbb.", "bbbbb"],
  // Copa con su pie.
  raro: ["lcccd", "lcccd", ".lcd.", "..c..", "..d..", ".bbb.", "bbbbb"],
  // Gema tallada sobre un pedestal.
  epico: ["..l..", ".lcd.", "lcccd", ".lcd.", "..d..", ".bbb.", "bbbbb"],
  // Estrella dorada.
  legendario: ["..l..", ".lcc.", "lcccd", ".ccd.", ".c.d.", ".bbb.", "bbbbb"],
};

const METAL: Record<AchievementRarity, { ramp: Ramp; l: number; c: number; d: number }> = {
  comun: { ramp: C.terracotta, l: 4, c: 3, d: 1 },
  raro: { ramp: C.metal, l: 5, c: 4, d: 2 },
  epico: { ramp: C.violet, l: 5, c: 4, d: 2 },
  legendario: { ramp: C.gold, l: 5, c: 4, d: 2 },
};

/**
 * Qué trofeos se ven para unos logros (cuántos de cada rareza): uno por logro, primero los más difíciles,
 * hasta llenar la vitrina.
 */
export function trophyShelf(counts: Partial<Record<AchievementRarity, number>>): AchievementRarity[] {
  const out: AchievementRarity[] = [];
  for (const r of PRESTIGE) for (let i = 0; i < Math.max(0, Math.floor(counts[r] ?? 0)); i++) out.push(r);
  return out.slice(0, TROPHY_CASE_SLOTS);
}

/** Color del trofeo `r` en su casilla (u, v desde la esquina de abajo a la izquierda del hueco), o null. */
function trophyPixel(r: AchievementRarity, u: number, v: number): RGBA | null {
  const rows = SHAPES[r];
  const tx = Math.floor(u);
  const ty = rows.length - 1 - Math.floor(v);
  const ch = rows[ty]?.[tx];
  if (!ch || ch === ".") return null;
  if (ch === "b") return at(C.woodDark, tx === 0 || ty === rows.length - 1 ? 2 : 3);
  const m = METAL[r];
  return at(m.ramp, ch === "l" ? m.l : ch === "d" ? m.d : m.c);
}

/** Frente de vidrio: marco, zócalo con cajón, repisas y los trofeos detrás del vidrio. */
function front(trophies: readonly AchievementRarity[]): Shader {
  const wd = C.woodDark;
  return (u, v, fw, fh) => {
    if (u < FRAME || u >= fw - FRAME) return at(wd, u < 0.8 ? 5 : u >= fw - 0.8 ? 2 : 3);
    if (v < BASE) {
      // El cajón con su tirador de bronce y una plaquita dorada al medio.
      if (v < 0.9) return at(wd, 1);
      if (v >= BASE - 0.8) return at(wd, 4);
      if (Math.abs(u - fw / 2) < 3 && Math.abs(v - BASE / 2) < 1) return at(C.gold, Math.abs(u - fw / 2) < 2.2 ? 4 : 3);
      return at(wd, v < 1.6 ? 2 : 3);
    }
    if (v >= fh - TOP) return at(wd, v >= fh - 0.8 ? 5 : 4);
    const inner = fh - BASE - TOP;
    const sh = inner / SHELVES;
    const iv = v - BASE;
    const s = Math.min(SHELVES - 1, Math.floor(iv / sh));
    const lv = iv - s * sh;
    // La repisa (madera con el canto claro).
    if (lv < 0.9) return at(wd, lv >= 0.5 ? 4 : 2);
    const slotW = (fw - FRAME * 2) / PER_SHELF;
    const su = u - FRAME;
    const k = Math.min(PER_SHELF - 1, Math.floor(su / slotW));
    const index = (SHELVES - 1 - s) * PER_SHELF + k;
    const r = trophies[index];
    const pu = su - k * slotW - (slotW - 5) / 2;
    let col = r ? trophyPixel(r, pu, lv - 0.9) : null;
    // Fondo de terciopelo azul noche (los trofeos resaltan), más oscuro arriba por la cornisa.
    const back = at(C.navy, lv > sh - 1.4 ? 1 : 2);
    if (!col && r && Math.floor(lv - 0.9) === 0 && pu >= -0.5 && pu < 5.5) col = mix(back, OUT, 0.35); // sombrita del pie
    const base = col ?? back;
    // Vidrio: un velo celeste y reflejos en diagonal (menos sobre los trofeos, para que se lean).
    if (((u - v * 0.7) % 14 + 14) % 14 < 1.1) return mix(base, at(C.white, 4), col ? 0.3 : 0.5);
    return mix(base, at(C.sky, 4), col ? 0.06 : 0.14);
  };
}

/** La vitrina con estos trofeos (vacía: el mueble del catálogo). Mismo tamaño y origen siempre. */
export function trophyCase(trophies: readonly AchievementRarity[] = []): Sprite {
  const wd = C.woodDark;
  const side: Shader = (u, v, fw) => {
    // Costado de madera con una ventanita de vidrio (se ve un poco del terciopelo).
    if (u > 1.8 && u < fw - 1.8 && v > BASE + 1 && v < H - TOP - 1) return mix(at(C.navy, 1), at(C.sky, 4), 0.16);
    return at(wd, v < BASE ? 1 : 2);
  };
  return renderSprite(
    [
      solidBox({ x: 1, y: 1, z: 0, w: 2, d: 2, h: 1.5 }, wd, 3),
      solidBox({ x: 1, y: 29, z: 0, w: 2, d: 2, h: 1.5 }, wd, 3),
      solidBox({ x: 9, y: 1, z: 0, w: 2, d: 2, h: 1.5 }, wd, 3),
      solidBox({ x: 9, y: 29, z: 0, w: 2, d: 2, h: 1.5 }, wd, 3),
      { x: 0, y: 0, z: 1.5, w: 11, d: 32, h: H, top: flat(at(wd, 4)), left: side, right: front(trophies) },
      // Cornisa que sobresale, con el canto dorado.
      { x: -0.5, y: -0.5, z: H + 1.5, w: 12, d: 33, h: 1.5, top: flat(at(wd, 5)), left: flat(at(wd, 3)), right: (_u, v) => (v < 0.6 ? at(C.gold, 3) : at(wd, 4)) },
    ],
    { outline: OUT, under: shadowUnder(0, 0, 12, 32) },
  );
}
