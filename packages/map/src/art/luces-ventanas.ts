// Las ventanas prendidas de noche (VIR-178): la cabaña, el garaje, la casa del árbol, la estación del
// Megabús, la casona de cada persona, su parada y el observatorio. Es una capa aparte del dibujo de cada
// edificio: aquí van solo dónde queda cada vidrio (en unidades de arte locales del mueble, las mismas del
// dibujo) y lo que se pinta encima. El vidrio prendido ya lo pinta la versión de noche de cada edificio;
// la noche del juego (una penumbra que multiplica todo, ver AreaView) lo apagaba. Por cada ventana salen
// tres capas, generadas una vez:
//  - `hueco`: dónde se le quita penumbra a la noche (el vidrio entero, un poco del marco alrededor y el
//    rectángulo de luz que cae al piso), así el vidrio se ve con sus colores de verdad;
//  - `brillo`: lo que se suma encima (modo ADD): un halo ámbar de pocos píxeles en bandas tramadas, como
//    los faroles, y la luz color miel en el piso con la sombra de los parteluces;
//  - `oscuro`: lo que se le suma a la penumbra cuando esa ventana está apagada (vidrio oscuro de noche).
// Cuál está prendida sale de una semilla por ventana y de la hora del juego (`luzPrendida`): todos ven lo
// mismo, unas se prenden al anochecer y otras más tarde, alguna se apaga pasada la medianoche y otra se
// vuelve a prender antes del amanecer. Unas pocas titilan como vela o fogón (`titileo`).
import { textMask } from "./digits";
import { FOCOS_ALERO, LETRERO, PX, PY, SCREEN, SD, VIGA } from "./estacion-bus";
import type { V3 } from "./exterior-escena";
import { PixelCanvas, bayer, hex, toScreen, type RGBA, type Sprite } from "./pixel";

// ---------- Datos ----------

/** Dónde está el vidrio: una cara plana, un pedazo de torre redonda o de cúpula. */
export type SuperficieLuz =
  /** Plano: el punto (u, v) es o + du·u + dv·v (du y dv unitarios). */
  | { tipo: "plano"; o: V3; du: V3; dv: V3 }
  /** Torre redonda: u corre por el arco desde el ángulo `a0` (radianes, 0 = +x, π/2 = +y), v sube desde z0. */
  | { tipo: "torre"; cx: number; cy: number; r: number; a0: number; z0: number }
  /** Cúpula (media esfera): u corre en azimut desde `az0` y v sube por la elevación desde `el0` (por el arco, u·r y v·r). */
  | { tipo: "cupula"; cx: number; cy: number; cz: number; r: number; az0: number; el0: number };

export type FormaLuz = "rect" | "arco" | "redonda";
/** El color de la luz: el hogar (ámbar y miel), una vela o fogón, un letrero, una pantalla o un foco. */
export type TonoLuz = "hogar" | "vela" | "letrero" | "pantalla" | "foco";
/** "hogar": cada ventana con su horario; "siempre": prendida toda la noche (letreros, la estación). */
export type HorarioLuz = "hogar" | "siempre";

/** La luz que cae al piso: delante de la ventana (hacia `n`, a la altura `z`) o un charco debajo de un foco. */
export type LuzPiso = { tipo: "frente"; n: V3; z: number; largo: number } | { tipo: "charco"; x: number; y: number; z: number; rx: number; ry: number };

export interface VentanaLuz {
  sup: SuperficieLuz;
  /** Ancho (por u) y alto (por v) del vidrio, sin el arco de arriba. */
  w: number;
  h: number;
  forma: FormaLuz;
  /** Alto del medio óvalo de arriba (forma "arco"). */
  arco?: number;
  /** Lleva parteluces en cruz (su sombra se ve en la luz del piso). */
  cruz: boolean;
  piso?: LuzPiso;
  tono: TonoLuz;
  horario: HorarioLuz;
}

interface Opciones {
  forma?: FormaLuz;
  arco?: number;
  cruz?: boolean;
  piso?: LuzPiso;
  tono?: TonoLuz;
  horario?: HorarioLuz;
}

const luz = (sup: SuperficieLuz, w: number, h: number, o: Opciones = {}): VentanaLuz => ({
  sup,
  w,
  h,
  forma: o.forma ?? "rect",
  arco: o.arco,
  cruz: o.cruz ?? (o.forma ?? "rect") !== "redonda",
  piso: o.piso,
  tono: o.tono ?? "hogar",
  horario: o.horario ?? "hogar",
});

const ARRIBA: V3 = [0, 0, 1];

/**
 * Una ventana en una pared plana: la pared empieza en `o` y corre por `du` (como el `quad` del dibujo);
 * la ventana va de u0 a u1 y de v0 a v1, igual que en el dibujo.
 */
function enPared(o: V3, du: V3, u0: number, u1: number, v0: number, v1: number, opc: Opciones = {}): VentanaLuz {
  const oo: V3 = [o[0] + du[0] * u0, o[1] + du[1] * u0, o[2] + v0];
  return luz({ tipo: "plano", o: oo, du, dv: ARRIBA }, u1 - u0, v1 - v0, opc);
}

/** La luz que cae delante de una pared que mira hacia `n`, a la altura `z` (el pasto, un porche). */
const alFrente = (n: V3, largo: number, z = 0): LuzPiso => ({ tipo: "frente", n, z, largo });
const SUR: V3 = [0, 1, 0];
const ESTE: V3 = [1, 0, 0];

/** Una ventana en una torre redonda: centrada en el ángulo `a`, de `ancho` por el arco, de v0 a v1. */
function enTorre(cx: number, cy: number, r: number, z0: number, a: number, ancho: number, v0: number, v1: number, opc: Opciones = {}): VentanaLuz {
  return luz({ tipo: "torre", cx, cy, r, a0: a - ancho / 2 / r, z0: z0 + v0 }, ancho, v1 - v0, opc);
}

// --- La cabaña (exterior-casa.ts): mismas medidas que el dibujo. ---

const A = { x0: 96, x1: 256, y0: 40, y1: 184 };
const B = { x0: 140, y1: 206 };
const T = { cx: 58, cy: 168, r: 38 };
const E = { x0: 256, x1: 326, y0: 62, y1: 150 };

const CABANA: VentanaLuz[] = [
  // Frente del cuerpo principal: las dos de la planta baja (la luz cae al pasto) y las puertas del balcón
  // del piso 2 (la luz cae al piso del balcón).
  enPared([A.x0, A.y1, 0], ESTE, 14, 34, 20, 40, { piso: alFrente(SUR, 22) }),
  enPared([A.x0, A.y1, 0], ESTE, 136, 152, 20, 40, { piso: alFrente(SUR, 22) }),
  enPared([A.x0, A.y1, 0], ESTE, 16, 32, 51, 84, { piso: alFrente(SUR, 12, 50) }),
  enPared([A.x0, A.y1, 0], ESTE, 136, 150, 51, 84, { piso: alFrente(SUR, 12, 50) }),
  // Costado este, sobre la terraza: la ventana de abajo (al piso de la terraza) y la puerta al balcón.
  enPared([A.x1, A.y0, 0], SUR, 122, 138, 20, 40, { piso: alFrente(ESTE, 20, 5) }),
  enPared([A.x1, A.y0, 0], SUR, 120, 138, 53, 86, { piso: alFrente(ESTE, 14, 54) }),
  // Hastial este: las dos del piso 3.
  enPared([A.x1, A.y0, 92], SUR, 50, 66, 12, 30),
  enPared([A.x1, A.y0, 92], SUR, 78, 94, 12, 30),
  // Las lucarnas de la buhardilla.
  enPared([103, 170, 102.6], ESTE, 8, 22, 7, 22),
  enPared([223, 170, 102.6], ESTE, 8, 22, 7, 22),
  // Frontón de la entrada: las dos angostas junto a la puerta (la luz cae al porche), los vidrios de la
  // puerta, el arco del piso 2 y el óculo.
  enPared([B.x0, B.y1, 0], ESTE, 14, 22, 20, 40, { piso: alFrente(SUR, 20, 6) }),
  enPared([B.x0, B.y1, 0], ESTE, 58, 66, 20, 40, { piso: alFrente(SUR, 20, 6) }),
  enPared([B.x0, B.y1, 0], ESTE, 30, 50, 30.5, 42, { forma: "arco", arco: 4, cruz: false, piso: alFrente(SUR, 12, 6) }),
  enPared([B.x0, B.y1, 0], ESTE, 26, 54, 70, 84, { forma: "arco", arco: 5 }),
  enPared([B.x0, B.y1, 0], ESTE, 33.5, 46.5, 101.5, 114.5, { forma: "redonda", cruz: true }),
  // La torre: los arcos de la planta baja (luz al pasto), los pisos 2 y 3 y la banda del mirador.
  ...[0.15, 1.35, 2.3].map((a) => enTorre(T.cx, T.cy, T.r, 0, a, 20, 18, 38, { forma: "arco", arco: 5, piso: alFrente([0, 0, 0], 20) })),
  ...[0.7, 1.9].map((a) => enTorre(T.cx, T.cy, T.r, 0, a, 20, 58, 78)),
  ...[0.1, 1.2, 2.25].map((a) => enTorre(T.cx, T.cy, T.r, 0, a, 20, 92, 110)),
  enTorre(T.cx, T.cy, T.r, 0, 0.8, T.r * 3.1, 129, 145, { cruz: false }),
  // Ala este: las dos del costado (luz al pasto), la del frente y los vidrios de la puerta (a la terraza)
  // y el ojo de buey del hastial.
  enPared([E.x1, E.y0, 0], SUR, 14, 34, 18, 38, { piso: alFrente(ESTE, 20) }),
  enPared([E.x1, E.y0, 0], SUR, 52, 72, 18, 38, { piso: alFrente(ESTE, 20) }),
  enPared([E.x0, E.y1, 0], ESTE, 12, 30, 18, 38, { piso: alFrente(SUR, 20, 5) }),
  enPared([E.x0, E.y1, 0], ESTE, 48, 56, 30.5, 42, { forma: "arco", arco: 4, cruz: false }),
  enPared([E.x1, E.y0, 52], SUR, 39.4, 48.6, 7.6, 16.4, { forma: "redonda", cruz: false }),
];

// --- El garaje (garaje-exterior.ts). ---

const GARAJE: VentanaLuz[] = [
  // La rendija entre las hojas del portón y la de abajo: la luz del taller se escapa al piso.
  enPared([3, 76, 0], ESTE, 20.4, 21.6, 0.8, 25, { cruz: false, piso: alFrente(SUR, 16) }),
  enPared([3, 76, 0], ESTE, 5, 37, 0, 0.8, { cruz: false, piso: alFrente(SUR, 8) }),
  // La ventanita de la puerta chica y la ventana del costado.
  enPared([3, 76, 0], ESTE, 48, 54, 17.5, 22.5, { cruz: false }),
  enPared([66, 6, 0], SUR, 40, 56, 18, 34, { piso: alFrente(ESTE, 18) }),
  // El ojo de buey del entretecho.
  enPared([66, 6, 0], SUR, 32.7, 37.3, 49.7, 54.3, { forma: "redonda", cruz: false }),
];

// --- La casa del árbol (casa-arbol-exterior.ts): la cabañita está sobre la plataforma (z = 60). ---

const CASA_ARBOL: VentanaLuz[] = [
  enPared([15, 47, 60], ESTE, 22, 32, 10, 20, { tono: "vela", piso: alFrente(SUR, 10, 60) }),
  enPared([15, 47, 60], ESTE, 8.5, 11.5, 13.5, 16.5, { forma: "redonda", cruz: false, tono: "vela" }),
  enPared([51, 13, 60], SUR, 12, 22, 11, 21, { tono: "vela", piso: alFrente(ESTE, 7, 60) }),
  enPared([51, 13, 90], SUR, 13.9, 20.1, 4, 10.3, { forma: "redonda", tono: "vela" }),
];

// --- La casona de cada persona (casa-propia-exterior.ts). ---

const FINCA = { x0: 8, x1: 210, y0: 14, y1: 116 };
const CASONA: VentanaLuz[] = [
  // Frente, primer piso: las tres ventanas (la luz cae a la baldosa del corredor) y los vidrios de la puerta.
  ...[28, 65, 157].map((cx) => enPared([FINCA.x0, FINCA.y1, 0], ESTE, cx - FINCA.x0 - 6, cx - FINCA.x0 + 6, 12, 28, { piso: alFrente(SUR, 18, 4) })),
  enPared([FINCA.x0, FINCA.y1, 0], ESTE, 94, 114, 19, 26, { cruz: false, piso: alFrente(SUR, 10, 4) }),
  // Frente, segundo piso: las puertas del balcón (la luz cae al piso del balcón).
  ...(
    [
      [28, 12],
      [65, 12],
      [112, 16],
      [157, 12],
      [192, 12],
    ] as const
  ).map(([cx, w]) => enPared([FINCA.x0, FINCA.y1, 0], ESTE, cx - FINCA.x0 - w / 2, cx - FINCA.x0 + w / 2, 48, 72, { piso: alFrente(SUR, 11, 48) })),
  // Costado este: las dos de abajo (al pasto), los vidrios de la puerta de atrás y las tres de arriba.
  enPared([FINCA.x1, FINCA.y0, 0], SUR, 33, 43, 13, 29, { piso: alFrente(ESTE, 18) }),
  enPared([FINCA.x1, FINCA.y0, 0], SUR, 74, 86, 13, 29, { piso: alFrente(ESTE, 18) }),
  enPared([FINCA.x1, FINCA.y0, 0], SUR, 53.7, 62.3, 19, 26, { cruz: false }),
  ...[30, 52, 80].map((u0) => enPared([FINCA.x1, FINCA.y0, 0], SUR, u0, u0 + 12, 52, 70)),
];

/** El letrero "CASA" del refugio de la parada de cada casa: lima con las letras crema, prendido toda la noche. */
const PARADA_CASA: VentanaLuz[] = [enPared([15, 34.9, 41], ESTE, 1, 33, 1, 13, { cruz: false, tono: "letrero", horario: "siempre" })];

// --- El observatorio (observatorio-exterior.ts): ventanitas en arco de la torre y la compuerta de la cúpula. ---

const OBS = { cx: 64, cy: 56, r: 41, z0: 7, domeZ: 149, domeR: 41 };
const OBSERVATORIO: VentanaLuz[] = [
  ...(
    [
      [0.15, 30],
      [0.95, 84],
      [2.3, 36],
      [2.05, 94],
      [-0.35, 88],
      [1.25, 42],
      [0.5, 108],
      [1.75, 110],
    ] as const
  ).map(([a, v0]) => enTorre(OBS.cx, OBS.cy, OBS.r, OBS.z0, a, 7, v0, v0 + 12.5, { forma: "arco", arco: 3.5 })),
  // La compuerta abierta de la cúpula: la lámpara de adentro, toda la noche.
  luz({ tipo: "cupula", cx: OBS.cx, cy: OBS.cy, cz: OBS.domeZ, r: OBS.domeR, az0: 0.3 - 0.24, el0: 0.05 }, 0.48 * OBS.domeR, 1.25 * OBS.domeR, { cruz: false, tono: "vela", horario: "siempre" }),
];

// --- La estación del Megabús (estacion-bus.ts): la pantalla, el letrero de la cenefa y los focos de la viga. ---

const LETRERO_ESTACION = textMask(LETRERO.text, 1);
const ESTACION: VentanaLuz[] = [
  enPared([PX + SCREEN.x0, PY + SCREEN.y, SCREEN.z0], ESTE, 1, 49, 1, 17, { cruz: false, tono: "pantalla", horario: "siempre" }),
  enPared([PX + LETRERO.x0 - 1, PY + SD + 6, LETRERO.z0 - 1], ESTE, 0, LETRERO_ESTACION.w + 2, 0.8, LETRERO_ESTACION.h + 1, { cruz: false, tono: "letrero", horario: "siempre" }),
  // El vidrio de cada foco es la fila de abajo de su caja de bronce, en la cara de la viga.
  ...FOCOS_ALERO.map((x) =>
    enPared([PX + x, PY + VIGA.y, VIGA.z0 + 1], ESTE, 1, 9, 0, 1, {
      cruz: false,
      tono: "foco",
      horario: "siempre",
      piso: { tipo: "charco", x: PX + x + 5, y: PY + SD - 6, z: 0, rx: 15, ry: 11 },
    }),
  ),
];

/** Las ventanas de cada edificio que se prenden de noche (por tipo de mueble del catálogo). */
export const LUCES_DE_NOCHE: Readonly<Record<string, readonly VentanaLuz[]>> = {
  house: CABANA,
  garage: GARAJE,
  treehouse: CASA_ARBOL,
  "casa-finca": CASONA,
  "parada-casa": PARADA_CASA,
  observatory: OBSERVATORIO,
  "bus-station": ESTACION,
};

export function lucesDeEdificio(type: string): readonly VentanaLuz[] | undefined {
  return LUCES_DE_NOCHE[type];
}

// ---------- Geometría ----------

/** El punto (u, v) del vidrio en el mundo del mueble, o null si queda del lado que no se ve. */
export function puntoDeLuz(sup: SuperficieLuz, u: number, v: number): V3 | null {
  if (sup.tipo === "plano") return [sup.o[0] + sup.du[0] * u + sup.dv[0] * v, sup.o[1] + sup.du[1] * u + sup.dv[1] * v, sup.o[2] + sup.du[2] * u + sup.dv[2] * v];
  if (sup.tipo === "torre") {
    const a = sup.a0 + u / sup.r;
    // La cámara ve la mitad de la torre que mira a (1, 1): lo de atrás del borde no se dibuja.
    if (Math.cos(a - Math.PI / 4) < 0.02) return null;
    return [sup.cx + Math.cos(a) * sup.r, sup.cy + Math.sin(a) * sup.r, sup.z0 + v];
  }
  const el = sup.el0 + v / sup.r;
  const az = sup.az0 + u / sup.r;
  const ce = Math.cos(el);
  return [sup.cx + Math.cos(az) * ce * sup.r, sup.cy + Math.sin(az) * ce * sup.r, sup.cz + Math.sin(el) * sup.r];
}

/** Hacia dónde mira el vidrio en (u, v) (para la luz que cae al piso de una torre). */
function normalEn(sup: SuperficieLuz, u: number): V3 {
  if (sup.tipo === "torre") {
    const a = sup.a0 + u / sup.r;
    return [Math.cos(a), Math.sin(a), 0];
  }
  if (sup.tipo === "plano") return [sup.du[1], -sup.du[0], 0];
  return [Math.cos(sup.az0 + u / sup.r), Math.sin(sup.az0 + u / sup.r), 0];
}

/** ¿(u, v) cae dentro del vidrio según su forma? */
function dentro(v: VentanaLuz, u: number, vv: number): boolean {
  if (v.forma === "redonda") return ((u - v.w / 2) / (v.w / 2)) ** 2 + ((vv - v.h / 2) / (v.h / 2)) ** 2 <= 1;
  if (vv <= v.h) return true;
  if (v.forma !== "arco" || !v.arco) return false;
  return ((u - v.w / 2) / (v.w / 2)) ** 2 + ((vv - v.h) / v.arco) ** 2 <= 1;
}

// ---------- Colores ----------

interface Paleta {
  /** Halo alrededor del vidrio. */
  halo: RGBA;
  /** Lo que se suma sobre el vidrio (lo hace brillar un poco). */
  vidrio: RGBA;
  /** La luz del piso. */
  piso: RGBA;
  /** Radio del halo (px de pantalla) y su fuerza. */
  radio: number;
  fuerza: number;
}

const PALETAS: Record<TonoLuz, Paleta> = {
  // Ámbar el halo, miel la luz del piso.
  hogar: { halo: hex("#ff9a3a"), vidrio: hex("#ffc45e"), piso: hex("#ffbe62"), radio: 6, fuerza: 0.36 },
  vela: { halo: hex("#ff8a2a"), vidrio: hex("#ffb24a"), piso: hex("#ffae52"), radio: 7, fuerza: 0.4 },
  letrero: { halo: hex("#fff0b8"), vidrio: hex("#fff6d8"), piso: hex("#ffe9a8"), radio: 5, fuerza: 0.34 },
  pantalla: { halo: hex("#ffb437"), vidrio: hex("#ffcc66"), piso: hex("#ffb437"), radio: 6, fuerza: 0.36 },
  foco: { halo: hex("#ffe4a0"), vidrio: hex("#fff2c8"), piso: hex("#ffe0a0"), radio: 6, fuerza: 0.5 },
};

// ---------- Las capas de cada ventana ----------

export interface CapasDeLuz {
  /** Se suma encima (modo ADD): el halo, el brillo del vidrio y la luz del piso. */
  brillo: Sprite;
  /** Alfa: cuánta penumbra se le quita a la noche ahí (el color no importa). */
  hueco: Sprite;
  /** Alfa: cuánta penumbra de más lleva el vidrio cuando la ventana está apagada. */
  oscuro: Sprite;
}

/**
 * El dibujo del edificio de noche y de día (el mueble de frente): lo que cambia entre los dos dentro del
 * vidrio es lo que se ve prendido. Así lo que tapa una ventana (un techo, una baranda, la torre) no se
 * ilumina, y si el dibujo cambia, la luz lo sigue.
 */
export interface DibujosDelEdificio {
  noche: Sprite;
  dia: Sprite;
}

const capas = new Map<string, CapasDeLuz | null>();

/**
 * Las capas de la ventana `i` del edificio `type` (se arman una vez y se guardan). Null si desde la cámara
 * no se ve nada de ese vidrio (lo tapa otra parte del edificio).
 */
export function capasDeLuz(type: string, i: number, dibujos: DibujosDelEdificio): CapasDeLuz | null {
  const key = `${type}#${i}`;
  let c = capas.get(key);
  if (c === undefined) {
    const v = LUCES_DE_NOCHE[type]?.[i];
    if (!v) throw new Error(`Sin ventana ${i} en "${type}"`);
    capas.set(key, (c = armarCapas(v, dibujos)));
  }
  return c;
}

/** ¿El píxel (x, y) de pantalla (relativo al origen del mueble) cambia de noche? Es vidrio que se ve. */
function cambiaDeNoche(d: DibujosDelEdificio, x: number, y: number): boolean {
  const px = (s: Sprite) => {
    const X = Math.floor(x + s.ox);
    const Y = Math.floor(y + s.oy);
    if (X < 0 || Y < 0 || X >= s.canvas.width || Y >= s.canvas.height) return -1;
    return (Y * s.canvas.width + X) * 4;
  };
  const i = px(d.noche);
  const j = px(d.dia);
  if (i < 0 || !d.noche.canvas.data[i + 3]) return false;
  if (j < 0) return true;
  const a = d.noche.canvas.data;
  const b = d.dia.canvas.data;
  return a[i] !== b[j] || a[i + 1] !== b[j + 1] || a[i + 2] !== b[j + 2];
}

const PASO = 0.3;
const smooth = (x: number) => {
  const k = Math.max(0, Math.min(1, x));
  return k * k * (3 - 2 * k);
};

function armarCapas(v: VentanaLuz, dibujos: DibujosDelEdificio): CapasDeLuz | null {
  const pal = PALETAS[v.tono];
  // 1) Los puntos del vidrio y de la luz del piso, en píxeles de pantalla (relativos al origen del mueble).
  const vidrio: [number, number][] = [];
  const top = v.h + (v.forma === "arco" ? (v.arco ?? 0) : 0);
  for (let vv = PASO / 2; vv < top; vv += PASO)
    for (let u = PASO / 2; u < v.w; u += PASO) {
      if (!dentro(v, u, vv)) continue;
      const p = puntoDeLuz(v.sup, u, vv);
      if (!p) continue;
      const s = toScreen(p[0], p[1], p[2]);
      if (cambiaDeNoche(dibujos, s.x, s.y)) vidrio.push([s.x, s.y]);
    }
  const piso: [number, number, number][] = [];
  const pi = v.piso;
  if (pi?.tipo === "frente") {
    for (let t = 0; t < pi.largo; t += PASO) {
      const spread = t * 0.32;
      const k = t / pi.largo;
      // Fuerte junto a la pared, se apaga hacia afuera.
      const fuerza = (1 - k) ** 1.25;
      // La sombra de la cruz: el parteluz a lo largo y el travesaño a lo ancho.
      const barra = v.cruz && Math.abs(k - 0.42) < 0.05 ? 0.45 : 1;
      for (let u = -spread; u < v.w + spread; u += PASO) {
        const borde = u < 0 ? 1 - -u / Math.max(0.01, spread) : u > v.w ? 1 - (u - v.w) / Math.max(0.01, spread) : 1;
        const fr = (u + spread) / (v.w + spread * 2);
        const cruz = v.cruz && Math.abs(fr - 0.5) < 0.04 ? 0.45 : 1;
        const base = puntoDeLuz(v.sup, Math.max(0, Math.min(v.w, u)), 0);
        if (!base) continue;
        const n = pi.n[0] || pi.n[1] ? pi.n : normalEn(v.sup, Math.max(0, Math.min(v.w, u)));
        // Para la torre, la luz sale derecho desde cada punto del pie de la ventana.
        const along = v.sup.tipo === "plano" ? v.sup.du : ([-n[1], n[0], 0] as V3);
        const off = u - Math.max(0, Math.min(v.w, u));
        const x = base[0] + along[0] * off + n[0] * t;
        const y = base[1] + along[1] * off + n[1] * t;
        const s = toScreen(x, y, pi.z);
        piso.push([s.x, s.y, fuerza * smooth(borde) * barra * cruz]);
      }
    }
  } else if (pi?.tipo === "charco") {
    for (let dy = -pi.ry; dy <= pi.ry; dy += PASO)
      for (let dx = -pi.rx; dx <= pi.rx; dx += PASO) {
        const d = (dx / pi.rx) ** 2 + (dy / pi.ry) ** 2;
        if (d >= 1) continue;
        const s = toScreen(pi.x + dx, pi.y + dy, pi.z);
        piso.push([s.x, s.y, (1 - d) ** 1.3]);
      }
  }
  // Lo que casi no se ve (un pedacito que asoma detrás de un techo) no lleva halo: quedaría encima de lo
  // que lo tapa. Si su luz cae al piso, eso sí se ve (la ventana del porche detrás del techito).
  if (vidrio.length < 80) {
    if (!piso.length) return null;
    vidrio.length = 0;
  }

  // 2) El lienzo: lo que ocupan, más el halo.
  const pad = Math.ceil(pal.radio) + 3;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of [...vidrio, ...piso.filter((p) => p[2] > 0)]) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const ox = Math.ceil(-minX) + pad;
  const oy = Math.ceil(-minY) + pad;
  const W = Math.ceil(maxX - minX) + pad * 2 + 2;
  const H = Math.ceil(maxY - minY) + pad * 2 + 2;
  const idx = (x: number, y: number) => Math.floor(y + oy) * W + Math.floor(x + ox);
  const enVidrio = new Uint8Array(W * H);
  for (const [x, y] of vidrio) enVidrio[idx(x, y)] = 1;
  const luzPiso = new Float32Array(W * H);
  for (const [x, y, f] of piso) {
    const i = idx(x, y);
    if (f > luzPiso[i]!) luzPiso[i] = f;
  }

  // 3) Distancia al vidrio (chaflán de dos pasadas) para el halo.
  const dist = new Float32Array(W * H).fill(1e9);
  for (let i = 0; i < W * H; i++) if (enVidrio[i]) dist[i] = 0;
  const D = Math.SQRT2;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let d = dist[i]!;
      if (x > 0) d = Math.min(d, dist[i - 1]! + 1);
      if (y > 0) {
        d = Math.min(d, dist[i - W]! + 1);
        if (x > 0) d = Math.min(d, dist[i - W - 1]! + D);
        if (x < W - 1) d = Math.min(d, dist[i - W + 1]! + D);
      }
      dist[i] = d;
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let d = dist[i]!;
      if (x < W - 1) d = Math.min(d, dist[i + 1]! + 1);
      if (y < H - 1) {
        d = Math.min(d, dist[i + W]! + 1);
        if (x < W - 1) d = Math.min(d, dist[i + W + 1]! + D);
        if (x > 0) d = Math.min(d, dist[i + W - 1]! + D);
      }
      dist[i] = d;
    }

  // 4) Las tres capas.
  const brillo = new PixelCanvas(W, H);
  const hueco = new PixelCanvas(W, H);
  const oscuro = new PixelCanvas(W, H);
  const R = pal.radio;
  const BANDAS = 3;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const d = dist[i]!;
      const lp = luzPiso[i]!;
      const tram = bayer(x, y) * 0.9;
      // Lo que se suma: el vidrio un poco, el halo en bandas tramadas y la luz del piso (miel).
      let a = 0;
      let col = pal.halo;
      if (d === 0) {
        a = 0.14;
        col = pal.vidrio;
      } else if (d <= R) {
        const band = Math.floor((1 - d / (R + 0.5)) * BANDAS + tram);
        a = (pal.fuerza * Math.min(band, BANDAS)) / BANDAS;
      }
      if (lp > 0) {
        const band = Math.floor(lp * 4 + tram);
        const ap = (0.42 * Math.min(band, 4)) / 4;
        if (ap > a) {
          a = ap;
          col = pal.piso;
        }
      }
      if (a > 0) brillo.set(x, y, [col[0], col[1], col[2], Math.round(a * 255)]);
      // El hueco: el vidrio entero, el marco y un poco de pared alrededor, y la luz del piso.
      let h = d <= 1.5 ? 1 : d < 6.5 ? 0.6 * (1 - (d - 1.5) / 5) ** 1.5 : 0;
      h = Math.max(h, lp * 0.75);
      if (h > 0) hueco.set(x, y, [255, 255, 255, Math.round(Math.min(1, h) * 255)]);
      // Apagada: el vidrio y el marco un poco más oscuros que la noche.
      const o = d === 0 ? 0.62 : d <= 1.5 ? 0.35 : 0;
      if (o > 0) oscuro.set(x, y, [255, 255, 255, Math.round(o * 255)]);
    }
  return { brillo: { canvas: brillo, ox, oy }, hueco: { canvas: hueco, ox, oy }, oscuro: { canvas: oscuro, ox, oy } };
}

// ---------- Cuándo está prendida ----------

/** Minutos desde las 19:00 (cuando empieza la noche del juego) hasta las 7:00. */
const NOCHE_DESDE = 19 * 60;
const NOCHE_HASTA = 7 * 60;
const DIA = 24 * 60;

/** Número pseudoaleatorio en [0, 1) a partir de enteros (igual en todos lados). */
function azar(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** La semilla de una ventana: el edificio, dónde está puesto y cuál de sus ventanas es. */
export function semillaDeLuz(type: string, x: number, y: number, i: number): number {
  let h = 2166136261;
  for (const ch of type) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (Math.imul(h ^ (x * 73856093), 16777619) ^ Math.imul(y + 1, 19349663) ^ Math.imul(i + 7, 83492791)) >>> 0;
}

/** ¿Es de noche en el juego? (19:00 a 6:59, como el reloj del servidor). */
const deNoche = (minuto: number) => minuto >= NOCHE_DESDE || minuto < NOCHE_HASTA;

/**
 * El horario de una ventana en una noche: cuándo se prende, si se apaga pasada la medianoche y si vuelve a
 * prenderse antes del amanecer (minutos desde las 19:00). `null` si esa noche no se prende (cuarto vacío).
 */
export function horarioDeLuz(semilla: number, noche: number): { prende: number; apaga: number; vuelve: number } | null {
  const r = (k: number) => azar(semilla, noche, k);
  if (r(0) < 0.1) return null;
  // Un tercio con la primera oscurecida; el resto, hasta las 22:00.
  const prende = r(1) < 0.35 ? Math.floor(r(2) * 25) : 20 + Math.floor(r(2) * 160);
  // Tres de cada diez se acuestan entre las 23:00 y las 2:30; de esas, casi la mitad madruga (4:30 a 6:30).
  const acuesta = r(3) < 0.3;
  const apaga = acuesta ? 240 + Math.floor(r(4) * 210) : NOCHE_LARGA;
  const vuelve = acuesta && r(5) < 0.45 ? 570 + Math.floor(r(6) * 120) : NOCHE_LARGA;
  return { prende, apaga, vuelve };
}
const NOCHE_LARGA = 12 * 60;

/**
 * ¿Está prendida la ventana a esa hora del juego? Solo de noche. `dia` es el día del juego (la noche que
 * empieza a las 19:00 del día D sigue siendo la del día D después de medianoche).
 */
export function luzPrendida(v: Pick<VentanaLuz, "horario">, semilla: number, dia: number, minuto: number): boolean {
  if (!deNoche(minuto)) return false;
  if (v.horario === "siempre") return true;
  const noche = minuto >= 12 * 60 ? dia : dia - 1;
  const t = (minuto - NOCHE_DESDE + DIA) % DIA;
  const h = horarioDeLuz(semilla, noche);
  if (!h) return false;
  return t >= h.prende && (t < h.apaga || t >= h.vuelve);
}

/** ¿Esta ventana titila? Las velas siempre; del hogar, una de cada cinco (un fogón, una vela en la mesa). */
export function titila(v: Pick<VentanaLuz, "tono">, semilla: number): boolean {
  if (v.tono === "vela") return true;
  return v.tono === "hogar" && azar(semilla, 0, 99) < 0.2;
}

/** Cuánto brilla una luz que titila en el instante `ms` (0.72 … 1): muy suave, como una vela. */
export function titileo(semilla: number, ms: number): number {
  const p = azar(semilla, 1, 7) * 6.283;
  const q = azar(semilla, 2, 7) * 6.283;
  const a = Math.sin(ms / 180 + p) * 0.5 + Math.sin(ms / 67 + q) * 0.3 + Math.sin(ms / 31 + p * 2) * 0.2;
  return 0.86 + a * 0.14;
}
