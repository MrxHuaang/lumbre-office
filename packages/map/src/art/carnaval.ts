// El Carnaval de Negros y Blancos por código (docs/plan-carnaval.md): la bandera del abanderado y el talco.
// La decoración de la vereda está en carnaval-decor.ts y las carrozas del desfile en ./carrozas (VIR-173).
// Coordenadas locales de arte (tile = 16).
import { Escena } from "./exterior-escena";
import { C } from "./palette";
import { PixelCanvas, alpha, at, ramp, type RGBA, type Sprite } from "./pixel";

/** Papel maché blanco (cálido, nunca gris) y negro (tirando a morado, como las sombras de la cabaña). */
const BLANCO = ramp("#8f8778", "#bdb5a6", "#dcd6ca", "#efebe2", "#f9f7f2", "#ffffff");
const NEGRO = ramp("#121018", "#1c1924", "#26222f", "#332e3e", "#45404f", "#5c5668");

/** Cuerpo redondo salpicado punto a punto (elipsoide): el tinte recibe la luz (-1..1) y la elevación. */
function orb(s: Escena, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, tinte: (luz: number, e: number, a: number) => RGBA | null) {
  const r = Math.max(rx, ry, rz);
  const da = 0.42 / Math.max(1, r * 1.2);
  for (let e = -Math.PI / 2; e <= Math.PI / 2; e += da) {
    const ce = Math.cos(e);
    const se = Math.sin(e);
    for (let a = -Math.PI; a < Math.PI; a += da) {
      const nx = Math.cos(a) * ce;
      const ny = Math.sin(a) * ce;
      const luz = ny * 0.5 - nx * 0.3 + se * 0.7;
      s.plot(cx + nx * rx, cy + ny * ry, cz + se * rz, tinte(luz, e, a));
    }
  }
}

/**
 * La bandera blanca y negra del abanderado (Don Evelio la lleva al frente): el asta y el paño que ondea.
 * El origen va donde el asta toca el piso.
 */
export function banderaSprite(f: number): Sprite {
  const s = new Escena({ x0: -4, y0: -4, z0: -2, x1: 30, y1: 6, z1: 52 }, 2);
  s.solid(0, 0, 0, 1.2, 1.2, 46, at(C.logs, 4), at(C.logs, 3), at(C.logs, 2));
  orb(s, 0.6, 0.6, 47, 1.4, 1.4, 1.4, (luz) => at(C.gold, 3.6 + luz));
  s.quad([1.2, 0.6, 30], [1, 0, 0], [0, 0, 1], 22, 14, (u, v) => {
    const wave = Math.sin(u * 0.4 - f * (Math.PI / 2)) * 1.6 * (u / 22);
    const vv = v + wave;
    if (vv < 0 || vv > 14) return null;
    // Dos franjas, blanca arriba y negra abajo, con un ribete dorado.
    if (vv > 13 || vv < 1) return at(C.gold, 3.6);
    return vv > 7 ? at(BLANCO, 4.4) : at(NEGRO, 2.2);
  });
  return s.sprite();
}

// ---------- El talco (la maicena) sobre la cara ----------

/**
 * El polvo de maicena sobre la cara (el talco del Día de Blancos): una capa blanca tramada y translúcida,
 * más tupida al centro, que se pone encima de la cara del personaje un rato. Nunca oscurece nada.
 */
export function talcoCara(): PixelCanvas {
  const w = 10;
  const h = 6;
  const c = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - (w - 1) / 2) / (w / 2), (y - (h - 1) / 2) / (h / 2));
      if (d > 1) continue;
      if (d > 0.75 && (x + y) % 2) continue;
      c.set(x, y, alpha(at(BLANCO, 5), d < 0.55 ? 0.62 : 0.4));
    }
  return c;
}

/** Una motita de polvo que cae (o la nubecita del puñado al echarlo). */
export function talcoPolvo(): PixelCanvas {
  const c = new PixelCanvas(2, 2);
  c.set(0, 0, alpha(at(BLANCO, 5), 0.9));
  c.set(1, 0, alpha(at(BLANCO, 4), 0.7));
  c.set(0, 1, alpha(at(BLANCO, 4), 0.7));
  return c;
}

// ---------- La espuma ----------

/** Pinta una grilla de letras con su leyenda (el punto es vacío; una letra sin color es un error). */
function grillaEspuma(rows: readonly string[], leyenda: Readonly<Record<string, RGBA>>): PixelCanvas {
  const c = new PixelCanvas(rows[0]!.length, rows.length);
  rows.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      const ch = line[x]!;
      if (ch === ".") continue;
      const col = leyenda[ch];
      if (!col) throw new Error(`Letra sin color en la espuma: ${ch}`);
      c.set(x, y, col);
    }
  });
  return c;
}

/** La espuma: luz arriba a la izquierda (3), base (2), sombra (1) y la burbuja que brilla (b). */
const ESPUMA_LEYENDA: Readonly<Record<string, RGBA>> = {
  "3": at(BLANCO, 5),
  "2": at(BLANCO, 4),
  "1": at(BLANCO, 2),
  b: alpha(at(BLANCO, 5), 0.75),
};

/** Un copo de espuma (el chorro que sale del tarrito y lo que queda pegado en la ropa). */
export function espumaCopo(): PixelCanvas {
  return grillaEspuma([".33b.", "33221", "32211", ".211."], ESPUMA_LEYENDA);
}

/** El rastro de espuma en el piso: un charquito aplastado con burbujas, que se va secando. */
export function espumaRastro(): PixelCanvas {
  return grillaEspuma(["..b33.b.", ".332221.", "3322b211", ".122211."], ESPUMA_LEYENDA);
}
