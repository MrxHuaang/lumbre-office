// La gente chiquita de las carrozas (VIR-173), pintada de frente como las figuras grandes: músicos de
// banda con chaqueta de botones dorados (trompeta, trombón o tambor), señores de traje y canotier, señoras
// de vestido y sombrero de flores, niños de gorra y bailarinas de falda de vuelo con tocado de plumas.
// Unos 44 px de alto a escala 1, con los pies en (cx, by). Devuelve dónde quedan las manos y la cabeza.
import type { Ramp } from "../pixel";
import { BRILLO, LINEA, mejilla, pluma } from "./figuras";
import { caja, capsula, circulo, elipse, Pintura, poligono, rampa, tono, union } from "./pintura";

export const ORO_G = rampa("#e6aa2a");
const BOTA = rampa("#2e2638");
const BLANCO = rampa("#f4efe6");
const MEJILLA = tono(rampa("#ef6b8a"), 3);

export type Gorro = "kepi" | "plumas" | "canotier" | "gorra" | "flores" | "nada";
export type PoseG = "saluda" | "trompeta" | "trombon" | "tambor" | "jarra" | "baila" | "manos";

export interface PersonaOpts {
  piel: Ramp;
  pelo?: Ramp;
  /** La chaqueta (o la blusa). */
  chaqueta: Ramp;
  /** Las mangas (por defecto, la chaqueta). */
  mangas?: Ramp;
  pantalon: Ramp;
  /** Los ribetes y botones. */
  ribete?: Ramp;
  /** La camisa que asoma en el cuello (V). */
  camisa?: Ramp;
  /** Falda de vuelo en dos pisos (las bailarinas). */
  falda?: readonly [Ramp, Ramp];
  /** Vestido largo hasta los tobillos. */
  vestido?: boolean;
  /** El corbatín. */
  monono?: Ramp;
  gorro?: Gorro;
  gorroColor?: Ramp;
  plumas?: readonly Ramp[];
  pose?: PoseG;
  /** Hacia dónde va el brazo que saluda o el instrumento. */
  lado?: 1 | -1;
  /** Boca abierta (cantando, gritando de contento). */
  canta?: boolean;
}

const op = { planos: true, borde: "oscuro" as const };

/** Una persona chiquita parada: piernas o falda, chaqueta, brazos según la pose, cabeza y gorro. */
export function persona(p: Pintura, cx: number, by: number, s: number, o: PersonaOpts) {
  const S = (v: number) => v * s;
  const lado = o.lado ?? 1;
  const rib = o.ribete ?? ORO_G;
  const mangas = o.mangas ?? o.chaqueta;
  const hy = by - S(37);
  // Las piernas (con la raya del pantalón de banda) y las botas.
  if (!o.vestido)
    for (const d of [-1, 1]) {
      p.volumen(capsula(cx + d * S(3), by - S(16), cx + d * S(3.4), by - S(3), S(2.7), S(2.4)), o.pantalon, { alto: S(2), ...op, pinta: (q, c) => (Math.abs(q.x + 0.5 - (cx + d * S(3.2) + d * S(1.6))) < 0.6 && o.ribete ? tono(rib, 3) : c) });
      p.volumen(elipse(cx + d * S(3.8), by - S(1.6), S(3.4), S(2)), BOTA, { alto: 1, ...op, brillo: 0.8 });
    }
  // El vestido largo o la falda de vuelo.
  if (o.vestido) {
    p.volumen(poligono([[cx - S(6), by - S(20)], [cx + S(6), by - S(20)], [cx + S(10), by - S(1)], [cx - S(10), by - S(1)]]), o.pantalon, {
      alto: S(4),
      ...op,
      pinta: (q, c) => (q.y > by - S(4) ? tono(rib, 3) : Math.floor((q.x - cx) / S(3.2)) % 2 ? c : tono(o.pantalon, 2)),
    });
  }
  if (o.falda) {
    const [a, b] = o.falda;
    p.volumen(poligono([[cx - S(6), by - S(19)], [cx + S(6), by - S(19)], [cx + S(12), by - S(9)], [cx - S(12), by - S(9)]]), a, { alto: S(3), ...op, pinta: (q, c) => (q.y > by - S(11) ? tono(rib, 4) : c) });
    p.volumen(poligono([[cx - S(5), by - S(21)], [cx + S(5), by - S(21)], [cx + S(10), by - S(13)], [cx - S(10), by - S(13)]]), b, { alto: S(3), ...op, sombra: 0.3 });
  }
  // El torso: la chaqueta con su ribete, los botones y el cinturón.
  const torso = poligono([
    [cx - S(5.5), by - S(17)],
    [cx + S(5.5), by - S(17)],
    [cx + S(7), by - S(28)],
    [cx - S(7), by - S(28)],
  ]);
  p.volumen(union(torso, elipse(cx, by - S(28), S(7.4), S(3))), o.chaqueta, {
    alto: S(4),
    ...op,
    pinta: (q, c) => {
      const x = q.x + 0.5 - cx;
      const y = q.y + 0.5;
      // El cuello en V con la camisa.
      if (o.camisa && y < by - S(23) && Math.abs(x) < (y - (by - S(31))) * 0.5) return tono(o.camisa, 4);
      if (o.ribete && Math.abs(x) < 0.7 && y > by - S(26)) return tono(rib, 3);
      if (o.ribete && Math.abs(y - (by - S(18.5))) < S(0.9)) return tono(rib, 4);
      return c;
    },
  });
  if (o.ribete) for (let k = 0; k < 3; k++) for (const d of [-1, 1]) p.punto(Math.round(cx + d * S(2.2)), Math.round(by - S(21) - k * S(2.4)), tono(rib, 5));
  if (o.monono) p.volumen(union(poligono([[cx, by - S(29)], [cx - S(3), by - S(30.5)], [cx - S(3), by - S(27.5)]]), poligono([[cx, by - S(29)], [cx + S(3), by - S(30.5)], [cx + S(3), by - S(27.5)]])), o.monono, { alto: 1, ...op });
  // Los brazos según la pose.
  const hombro = (d: number) => ({ x: cx + d * S(6.4), y: by - S(27) });
  const manos: { x: number; y: number }[] = [];
  const brazo = (d: number, mx: number, my: number, codo?: { x: number; y: number }) => {
    const h = hombro(d);
    if (codo) {
      p.volumen(capsula(h.x, h.y, codo.x, codo.y, S(2.3), S(2.1)), mangas, { alto: S(1.6), ...op, sombra: 0.25 });
      p.volumen(capsula(codo.x, codo.y, mx, my, S(2.1), S(1.9)), mangas, { alto: S(1.6), ...op });
    } else p.volumen(capsula(h.x, h.y, mx, my, S(2.3), S(2)), mangas, { alto: S(1.6), ...op, sombra: 0.25 });
    if (o.ribete) p.volumen(elipse(mx - (mx - h.x) * 0.12, my - (my - h.y) * 0.12, S(2.4), S(1.2), Math.atan2(my - h.y, mx - h.x) + Math.PI / 2), rib, { alto: 1, ...op });
    manos.push({ x: mx, y: my });
  };
  const pose = o.pose ?? "jarra";
  if (pose === "saluda") {
    brazo(-lado, cx - lado * S(9), by - S(18), { x: cx - lado * S(10), y: by - S(23) });
    brazo(lado, cx + lado * S(12), by - S(44), { x: cx + lado * S(11), y: by - S(33) });
  } else if (pose === "baila") {
    brazo(-1, cx - S(12), by - S(43), { x: cx - S(11), y: by - S(33) });
    brazo(1, cx + S(12), by - S(43), { x: cx + S(11), y: by - S(33) });
  } else if (pose === "jarra") {
    brazo(-1, cx - S(6), by - S(18), { x: cx - S(11), y: by - S(22) });
    brazo(1, cx + S(6), by - S(18), { x: cx + S(11), y: by - S(22) });
  } else if (pose === "tambor" || pose === "manos") {
    brazo(-1, cx - S(5), by - S(22), { x: cx - S(9), y: by - S(21) });
    brazo(1, cx + S(5), by - S(22), { x: cx + S(9), y: by - S(21) });
  } else {
    // Trompeta o trombón: las dos manos al frente, a la altura de la boca.
    brazo(-lado, cx + lado * S(4), by - S(33), { x: cx - lado * S(3), y: by - S(25) });
    brazo(lado, cx + lado * S(8), by - S(34), { x: cx + lado * S(9), y: by - S(25) });
  }
  for (const m of manos) p.volumen(circulo(m.x, m.y, S(2.1)), pose === "trompeta" || pose === "trombon" || pose === "tambor" ? BLANCO : o.piel, { alto: S(1.4), ...op, brillo: 0.6 });
  // La cabeza: el pelo de atrás, la cara, los ojos, las mejillas y la sonrisa.
  if (o.pelo) p.volumen(elipse(cx, hy - S(1), S(8.6), S(8)), o.pelo, { alto: S(3), ...op });
  p.volumen(capsula(cx, hy + S(5), cx, hy + S(8), S(2.4)), o.piel, { alto: 1, ...op });
  p.volumen(elipse(cx, hy, S(7.4), S(7.8)), o.piel, { alto: S(4.5), ...op, brillo: 0.5 });
  if (o.pelo && o.gorro !== "plumas") p.volumen(elipse(cx - S(0.5), hy - S(5), S(7), S(3.4)), o.pelo, { alto: S(2), ...op });
  for (const d of [-1, 1]) {
    p.plano(elipse(cx + d * S(2.8) + lado * S(0.4), hy + S(0.4), Math.max(0.8, S(1)), Math.max(1, S(1.5))), LINEA);
    if (s >= 0.8) p.punto(Math.round(cx + d * S(2.8) + lado * S(0.4) - 0.5), Math.round(hy - S(0.6)), BRILLO);
    mejilla(p, cx + d * S(4.6), hy + S(3), S(1.8), S(1.1), MEJILLA);
  }
  if (pose === "trompeta" || pose === "trombon") {
    // Los cachetes inflados soplando.
    p.volumen(circulo(cx + lado * S(3.4), hy + S(3.6), S(2.4)), o.piel, { alto: 1, ...op, brillo: 0.8 });
  } else if (o.canta) {
    p.plano(elipse(cx + lado * S(0.4), hy + S(4), S(2.6), S(1.8)), tono(rampa("#7a1d33"), 2));
    p.plano(elipse(cx + lado * S(0.4), hy + S(3.2), S(2), S(0.6)), tono(BLANCO, 4));
  } else p.curva(cx - S(2.4), hy + S(3.4), cx, hy + S(5.6), cx + S(2.4), hy + S(3.4), LINEA, 1);
  gorro(p, cx, hy, s, o);
  // El instrumento.
  if (pose === "trompeta") trompeta(p, cx + lado * S(3), hy + S(4), lado, s);
  if (pose === "trombon") trombon(p, cx + lado * S(3), hy + S(4), lado, s);
  return { manos, cabeza: { x: cx, y: hy } };
}

function gorro(p: Pintura, cx: number, hy: number, s: number, o: PersonaOpts) {
  const S = (v: number) => v * s;
  const g = o.gorro ?? "nada";
  const col = o.gorroColor ?? o.chaqueta;
  if (g === "kepi") {
    // El quepis de banda: copa con la cinta dorada y la visera negra.
    p.volumen(caja(cx - S(6.4), hy - S(13), cx + S(6.4), hy - S(5), S(2)), col, { alto: S(3), ...op, pinta: (q, c) => (q.y + 0.5 > hy - S(7.6) ? tono(ORO_G, 4) : c) });
    p.volumen(elipse(cx + S(1.4), hy - S(4.6), S(6), S(1.6)), BOTA, { alto: 1, ...op, brillo: 0.9 });
    p.volumen(elipse(cx, hy - S(13), S(6.6), S(2)), col, { alto: 1.2, ...op, base: 0.8 });
  } else if (g === "gorra") {
    p.volumen(elipse(cx, hy - S(6), S(7.6), S(4.6)), col, { alto: S(2.4), ...op });
    p.volumen(elipse(cx + S(3), hy - S(3.6), S(5.4), S(1.5)), BOTA, { alto: 1, ...op, brillo: 0.9 });
  } else if (g === "canotier") {
    p.volumen(elipse(cx, hy - S(5.4), S(11), S(2.6)), col, { alto: 1.4, ...op });
    p.volumen(caja(cx - S(6.4), hy - S(11.4), cx + S(6.4), hy - S(5), S(1)), col, { alto: S(2.4), ...op, pinta: (q, c) => (q.y + 0.5 > hy - S(8) ? tono(rampa("#c8243a"), 3) : c) });
  } else if (g === "flores") {
    p.volumen(elipse(cx, hy - S(5), S(11.5), S(3)), col, { alto: 1.6, ...op });
    p.volumen(elipse(cx, hy - S(8.4), S(6.6), S(4.4)), col, { alto: S(2.4), ...op });
    for (const [dx, c] of [
      [-4, rampa("#ec5aa0")],
      [-1, rampa("#f7c518")],
      [2.4, rampa("#8a3cc8")],
    ] as const)
      p.volumen(circulo(cx + S(dx), hy - S(6.4), S(1.7)), c, { alto: 1, ...op, brillo: 0.6 });
  } else if (g === "plumas") {
    // El tocado: la diadema dorada con su joya y el abanico de plumas de colores.
    const cols = o.plumas ?? [rampa("#e0283c"), rampa("#2f6fd6"), rampa("#3db842"), rampa("#8a3cc8"), rampa("#f7c518")];
    const n = Math.max(5, Math.round(7 * s));
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.1;
      pluma(p, cx + Math.cos(a) * S(5), hy - S(6) + Math.sin(a) * S(3), a, S(13 - Math.abs(i - (n - 1) / 2) * 1.2), S(4.6), cols[i % cols.length]!, { brillo: 0.3 });
    }
    p.volumen(caja(cx - S(7.4), hy - S(9), cx + S(7.4), hy - S(5.4), S(1.2)), ORO_G, { alto: 1.4, ...op, brillo: 0.9 });
    p.volumen(circulo(cx, hy - S(7.2), S(1.7)), cols[0]!, { alto: 1, ...op, brillo: 1 });
  }
}

/** La trompeta: la boquilla en la boca, el tubo con los pistones y la campana dorada hacia `lado`. */
export function trompeta(p: Pintura, x: number, y: number, lado: 1 | -1, s: number) {
  const S = (v: number) => v * s;
  p.volumen(capsula(x, y, x + lado * S(13), y - S(2.4), S(1.2)), ORO_G, { alto: 1, ...op, brillo: 1 });
  p.volumen(capsula(x + lado * S(4), y + S(1.6), x + lado * S(11), y + S(0.4), S(1.1)), ORO_G, { alto: 1, ...op, brillo: 1 });
  for (let k = 0; k < 3; k++) p.volumen(caja(x + lado * S(5.5 + k * 1.6) - S(0.6), y - S(3), x + lado * S(5.5 + k * 1.6) + S(0.6), y + S(0.4)), ORO_G, { alto: 1, ...op });
  const bx = x + lado * S(13);
  p.volumen(poligono([[bx, y - S(4)], [bx + lado * S(6), y - S(7.4)], [bx + lado * S(7), y + S(2.6)], [bx, y - S(0.8)]]), ORO_G, { alto: S(2), ...op, brillo: 1 });
  p.plano(elipse(bx + lado * S(6.6), y - S(2.4), S(1.2), S(4)), tono(rampa("#8a5a1a"), 2));
}

/** El trombón: la vara larga hacia adelante y la campana arriba, hacia `lado`. */
export function trombon(p: Pintura, x: number, y: number, lado: 1 | -1, s: number) {
  const S = (v: number) => v * s;
  p.volumen(capsula(x, y, x + lado * S(19), y + S(1), S(1)), ORO_G, { alto: 1, ...op, brillo: 1 });
  p.volumen(capsula(x + lado * S(3), y + S(3.2), x + lado * S(19), y + S(4), S(1)), ORO_G, { alto: 1, ...op, brillo: 1 });
  p.volumen(capsula(x + lado * S(19), y + S(1), x + lado * S(19), y + S(4), S(1)), ORO_G, { alto: 1, ...op, brillo: 1 });
  p.volumen(capsula(x + lado * S(2), y - S(1), x + lado * S(9), y - S(5), S(1.1)), ORO_G, { alto: 1, ...op, brillo: 1 });
  const bx = x + lado * S(9);
  p.volumen(poligono([[bx, y - S(7.4)], [bx + lado * S(5.6), y - S(11)], [bx + lado * S(6.6), y - S(1.6)], [bx, y - S(3.4)]]), ORO_G, { alto: S(2), ...op, brillo: 1 });
  p.plano(elipse(bx + lado * S(6.2), y - S(6.2), S(1.2), S(3.8)), tono(rampa("#8a5a1a"), 2));
}

/** El tambor de banda parado (la tapa de cuero arriba): triángulos de dos colores y el lazo dorado. */
export function tambor(p: Pintura, cx: number, by: number, r: number, a: Ramp, b: Ramp) {
  const alto = r * 1.15;
  const top = by - alto;
  p.volumen(union(caja(cx - r, top, cx + r, by, 1), elipse(cx, by, r, r * 0.34)), a, {
    alto: r * 0.5,
    ...op,
    pinta: (q, c) => {
      const u = (q.x + 0.5 - (cx - r)) / (r / 2);
      const v = (q.y + 0.5 - top) / alto;
      if (v < 0.14 || v > 0.9) return tono(a, 2);
      // Los triángulos: arriba de la diagonal, el otro color.
      const f = u - Math.floor(u);
      const tri = Math.floor(u) % 2 ? f : 1 - f;
      const vv = (v - 0.14) / 0.76;
      if (Math.abs(vv - tri) < 0.08) return tono(ORO_G, 4);
      return vv < tri ? tono(b, 3) : c;
    },
  });
  p.volumen(elipse(cx, top, r, r * 0.34), BLANCO, { alto: 1.4, ...op, brillo: 0.4 });
}

/** Los palitos del tambor con las manos enguantadas (aparte, para que golpeen). */
export function palitos(p: Pintura, cx: number, top: number, r: number, s: number) {
  for (const d of [-1, 1]) {
    const hx = cx + d * r * 0.9;
    const hy = top - 7 * s;
    p.volumen(capsula(hx, hy, cx + d * r * 0.25, top - 0.5, 0.8), rampa("#c89a5a"), { alto: 1, ...op });
    p.volumen(circulo(hx, hy, 2.1 * s), BLANCO, { alto: 1.4, ...op, brillo: 0.6 });
  }
}
