// El Diablo bailarín (pixel art pintado): la cabeza gigante de un diablo rojo de lentejuelas que se ríe a
// carcajadas (bigote negro de puntas enroscadas con filo dorado, colmillos, barba de candado), con los cuernos
// a rayas rojas, doradas y turquesas, la corona dorada con plumas y las cintas de colores que le cuelgan de
// los cuernos. Su capa roja de escamas de lentejuela, con rombos verdes y morados y el ruedo dorado de
// flecos, cubre el camión y ondea atrás; delante bailan angelitos (alas blancas, coronas de flores y vestidos
// tornasolados) y diablitos rojos de cola de flecha. Al frente, una máscara de diablo sobre el faldón.
// Todo de frente a la pantalla en 3/4 (luz de arriba a la izquierda), en coordenadas de pantalla desde el
// origen de la carroza.
import { bayer, type Ramp, type RGBA } from "../pixel";
import { BRILLO, Figura, LINEA, mejilla, ojo, parpado, pluma } from "./figuras";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { capsula, circulo, elipse, Pintura, poligono, rampa, resta, tono, union, type Forma } from "./pintura";

const LARGO = 104;
const ROJO = rampa("#d8262c");
const CAPA = rampa("#c01c30");
const CARA = rampa("#d8302a");
const NEGRO = rampa("#2a1e2a");
const AMARILLO = rampa("#f4c21c");
const TURQUESA = rampa("#1fa8a0");
const VERDE = rampa("#2f9a48");
const MORADO = rampa("#8a3cc8");
const ROSA = rampa("#e83c8c");
const BLANCO = rampa("#f2eee8");
const BOCA = rampa("#6a1024");
const LENGUA = rampa("#ee6a80");
const AZUL_OJO = rampa("#2f5ad0");
const PIEL = [rampa("#f2c49a"), rampa("#e0a878"), rampa("#c08050")];
const RIZOS = [rampa("#d8a040"), rampa("#a8682a"), rampa("#e8c070")];
const VESTIDOS = [rampa("#c8a0ec"), rampa("#f0a8cc"), rampa("#a8c8f0"), rampa("#f4d6a0")];

const OX = 80;
const OY = 230;
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const fig = () => new Figura(250, 330, OX, OY, [0, 0, 0]);
const op = { planos: true, borde: "oscuro" as const };

/** La cabeza del diablo (adelante, arriba). */
const H = (() => {
  const s = pantalla(LARGO * 0.76, ANCHO * 0.5, 72);
  return { x: s.x, y: s.y };
})();

/** Lentejuelas: puntitos de luz tramados sobre el color. */
const lentejuela = (q: { x: number; y: number }, c: RGBA, r: Ramp, k = 0.93): RGBA => {
  const b = bayer(q.x + ((q.y >> 2) & 1) * 2, q.y);
  if (b > k && (q.x + q.y) % 3 === 0) return tono(r, 4);
  return c;
};

// ---------- La capa ----------

/** Una escama de la capa: el lóbulo redondo de lentejuela con su ribete dorado y un rombo de color. */
function escama(p: Pintura, x: number, y: number, r: number, k: number) {
  const forma = el(x, y, r, r * 0.78);
  p.volumen(engordarF(forma, 1.4), ORO, { alto: 2, ...op, brillo: 0.8, sombra: 0.35 });
  const col = [CAPA, ROJO, CAPA, MORADO][k % 4]!;
  p.volumen(forma, col, { alto: r * 0.5, ...op, brillo: 0.4, pinta: (q, c) => lentejuela(q, c, col) });
  // Las escamitas de adentro (medias lunas más oscuras) y el rombo del centro con su puntito.
  p.plano(forma, (qx, qy) => {
    const u = qx - OX - x;
    const v = qy - OY - y;
    const fila = Math.floor((v + r) / 3.2);
    const cx = (((u + (fila % 2) * 1.7) % 3.4) + 3.4) % 3.4;
    return Math.hypot(cx - 1.7, ((v + r) % 3.2) - 0.4) > 1.9 && Math.hypot(u, v / 0.78) < r - 1.2 ? tono(col, 1) : null;
  });
  const rc = [VERDE, TURQUESA, AMARILLO][k % 3]!;
  p.volumen(pol([x, y - r * 0.45], [x + r * 0.3, y], [x, y + r * 0.4], [x - r * 0.3, y]), rc, { alto: 1.5, ...op, brillo: 0.9 });
}

const engordarF = (f: Forma, k: number): Forma => ({ d: (x, y) => f.d(x, y) - k, x0: f.x0 - k, y0: f.y0 - k, x1: f.x1 + k, y1: f.y1 + k });

/** El manto de la capa: cae de los hombros hasta el camión, de rombos y chevrones, con el ruedo dorado y los flecos. */
function capa(p: Pintura) {
  const manto = pol([H.x - 18, H.y + 18], [H.x - 40, H.y - 10], [-10, -46], [-36, -48], [-52, -34], [-52, -6], [-46, 16], [-20, 10], [8, 22], [36, 34], [H.x - 14, H.y + 52]);
  // La orilla de abajo (el ruedo), para saber dónde van los chevrones y dónde las escamas.
  const ruedo = (x: number) => (x < -20 ? 16 + ((x + 46) / 26) * -6 : x < 8 ? 10 + ((x + 20) / 28) * 12 : 22 + ((x - 8) / 28) * 12);
  const zona = (q: { x: number; y: number }) => {
    const x = q.x - OX;
    const y = q.y - OY;
    const chevron = y > ruedo(x) - 14;
    // Las escamas van en filas que bajan con el manto.
    const v = y - 0.35 * x + 60;
    const fila = Math.floor(v / 6);
    const u = x + (fila % 2) * 4.5 + 90;
    const celda = Math.floor(u / 9);
    const cu = (u % 9) - 4.5;
    const cv = (v % 6) - 1;
    return { x, y, chevron, fila, celda, d: Math.hypot(cu / 4.6, cv / 5.2) };
  };
  p.volumen(manto, CAPA, {
    alto: 26,
    ...op,
    patron: (q) => {
      const z = zona(q);
      if (z.chevron) {
        // Bandas en chevrón (como las plumas tejidas de la capa): rojo, verde, morado y dorado.
        const k = Math.floor((z.y + Math.abs(((z.x % 14) + 14) % 14 - 7) * 0.9) / 6);
        return [CAPA, ROJO, VERDE, CAPA, MORADO, ROJO, AMARILLO][((k % 7) + 7) % 7]!;
      }
      return [CAPA, ROJO, CAPA, MORADO, ROJO][((z.fila % 5) + 5) % 5]!;
    },
    pinta: (q, c) => {
      const z = zona(q);
      if (!z.chevron) {
        // Las escamas de lentejuela: el ribete dorado abajo y un rombito verde o turquesa de cada tres.
        if (z.d > 0.84 && z.d < 1.08) return tono(ORO, z.d < 0.96 ? 4 : 2);
        if ((z.celda + z.fila) % 3 === 0 && z.d < 0.3) return tono((z.celda % 2 ? VERDE : TURQUESA), 4);
      }
      return lentejuela(q, c, CAPA, 0.9);
    },
  });
  // El ruedo: un festón dorado que sigue la orilla de abajo, con borlas.
  const orilla: [number, number][] = [
    [-50, 0],
    [-46, 16],
    [-20, 10],
    [8, 22],
    [36, 34],
    [H.x - 14, H.y + 52],
  ];
  for (let i = 0; i < orilla.length - 1; i++) {
    const [ax, ay] = orilla[i]!;
    const [bx, by] = orilla[i + 1]!;
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 6));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      p.volumen(el(x, y - 1, 4, 2.6), ORO, { alto: 1.6, ...op, brillo: 0.9 });
      p.volumen(cap(x, y + 1, x, y + 5, 1, 0.6), ORO, { alto: 1, ...op });
      if (k % 2 === 0) p.volumen(ci(x, y - 1.4, 1.3), [ROSA, TURQUESA, VERDE][(i + k) % 3]!, { alto: 1, brillo: 1, borde: false });
    }
  }
}

/** Las escamas de arriba que ondean (cada grupo es una parte). */
function escamasArriba(p: Pintura, grupo: 0 | 1) {
  const lista: [number, number, number, number][] =
    grupo === 0
      ? [
          [-50, -46, 8, 1],
          [-38, -54, 8.5, 2],
          [-24, -52, 9, 3],
        ]
      : [
          [-10, -46, 9, 0],
          [4, -40, 8.5, 1],
          [16, -32, 8, 2],
        ];
  for (const [x, y, r, k] of lista) escama(p, x, y, r, k);
}

// ---------- El cuerpo y la cabeza ----------

/** El pecho: el traje rojo de lentejuelas bajo la barba, con el canesú dorado y la pechera de rombos. */
function pecho(p: Pintura) {
  const { x, y } = H;
  const forma = pol([x - 28, y + 30], [x + 24, y + 30], [x + 34, y + 52], [x + 32, y + 74], [x + 6, y + 88], [x - 20, y + 80], [x - 32, y + 56]);
  // La túnica de paños: rojo de lentejuela entre paños verdes, morados y turquesas de rombitos, con galones dorados.
  const pano = (q: { x: number; y: number }) => {
    const u = q.x - OX - x + (q.y - OY - y) * 0.18 + 40;
    return { k: Math.floor(u / 9), f: (u % 9) / 9 };
  };
  p.volumen(forma, ROJO, {
    alto: 20,
    ...op,
    patron: (q) => {
      const { k } = pano(q);
      return k % 2 ? [VERDE, MORADO, TURQUESA][Math.floor(k / 2) % 3]! : ROJO;
    },
    pinta: (q, c) => {
      const { k, f } = pano(q);
      if (f < 0.12 || f > 0.9) return tono(ORO, f < 0.12 ? 4 : 2);
      if (k % 2) {
        const v = q.y - OY - y;
        const d = Math.abs(f - 0.5) * 9 + Math.abs(((v % 6) + 6) % 6 - 3);
        if (d < 1.6) return tono(AMARILLO, 4);
        return c;
      }
      return lentejuela(q, c, ROJO);
    },
  });
  // El canesú dorado de festón (el cuello del traje).
  for (let k = 0; k < 9; k++) {
    const t = k / 8;
    const cx = x - 30 + t * 62;
    const cy = y + 34 + Math.sin(t * Math.PI) * 8;
    p.volumen(el(cx, cy, 5, 4), ORO, { alto: 2, ...op, brillo: 0.9, sombra: 0.3 });
    p.volumen(ci(cx, cy + 1, 1.4), [ROSA, TURQUESA, VERDE][k % 3]!, { alto: 1, brillo: 1, borde: false });
  }
}

/** Un cuerno a rayas (rojo, dorado, turquesa) que sale de la frente y se curva hacia adentro en la punta. */
function cuerno(p: Pintura, lado: -1 | 1) {
  const { x, y } = H;
  const pts: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    const a = Math.PI * (0.05 + t * 0.85);
    pts.push({ x: x + lado * (14 + Math.sin(a) * 14 - t * 6), y: y - 22 - t * 34 - Math.sin(t * Math.PI) * 4, r: 6.4 * (1 - t * 0.85) + 0.6 });
  }
  const forma = union(...pts.slice(1).map((q, i) => cap(pts[i]!.x, pts[i]!.y, q.x, q.y, pts[i]!.r, q.r)));
  // Las rayas van de través: cada píxel toma la banda del punto del cuerno más cercano.
  const banda = (q: { x: number; y: number }) => {
    let best = 0;
    let dmin = Infinity;
    pts.forEach((c, i) => {
      const d = Math.hypot(q.x + 0.5 - OX - c.x, q.y + 0.5 - OY - c.y);
      if (d < dmin) {
        dmin = d;
        best = i;
      }
    });
    return [ROJO, AMARILLO, TURQUESA, AMARILLO][Math.floor(best / 2.6) % 4]!;
  };
  p.volumen(forma, ROJO, { alto: 5, ...op, brillo: 0.8, sombra: 0.35, patron: banda });
}

/** Las cintas que cuelgan de la base de un cuerno (parte aparte: se mecen). Devuelve el pivote. */
function cintas(p: Pintura, lado: -1 | 1) {
  const bx = H.x + lado * 24;
  const by = H.y - 30;
  const cols = [ROSA, TURQUESA, MORADO, AMARILLO];
  cols.forEach((col, k) => {
    const largo = 26 + k * 5;
    let px = bx;
    let py = by;
    for (let i = 1; i <= 14; i++) {
      const t = i / 14;
      const qx = bx + lado * (6 + t * (10 + k * 3)) + Math.sin(t * 7 + k) * 2.6;
      const qy = by + t * largo - (1 - t) * 4;
      p.volumen(cap(px, py, qx, qy, 2.1, 1.9), col, { alto: 1.2, ...op, brillo: 0.7 });
      px = qx;
      py = qy;
    }
  });
  return { x: bx, y: by };
}

/** La corona dorada con sus piedras y el penacho de plumas detrás. */
function corona(p: Pintura) {
  const { x, y } = H;
  const plumas: [number, Ramp][] = [
    [-2.3, TURQUESA],
    [-1.95, AMARILLO],
    [-1.6, ROSA],
    [-1.3, TURQUESA],
    [-1.0, MORADO],
  ];
  for (const [a, col] of plumas) pluma(p, x + OX + Math.cos(a) * 4, y + OY - 28 + Math.sin(a) * 3, a, 28, 8, col);
  const base = pol([x - 14, y - 22], [x + 13, y - 22], [x + 12, y - 30], [x + 8, y - 26], [x + 5, y - 36], [x + 1, y - 27], [x - 3, y - 38], [x - 6, y - 27], [x - 10, y - 35], [x - 12, y - 27], [x - 15, y - 30]);
  p.volumen(base, ORO, { alto: 3, ...op, brillo: 0.9, sombra: 0.35 });
  p.plano(pol([x - 14, y - 25], [x + 13, y - 25], [x + 13, y - 23], [x - 14, y - 23]), tono(ORO, 5));
  for (const [cx, cy, col] of [
    [x - 9, y - 26, ROJO],
    [x - 1, y - 27, TURQUESA],
    [x + 7, y - 26, ROJO],
    [x - 3, y - 34, ROSA],
  ] as const)
    p.volumen(el(cx, cy, 2, 2.4), col, { alto: 1.4, ...op, brillo: 1 });
}

/** Las orejas puntiagudas (con arete dorado y piedra morada). */
function orejas(p: Pintura) {
  const { x, y } = H;
  for (const l of [-1, 1] as const) {
    p.volumen(pol([x + l * 18, y - 10], [x + l * 38, y - 24], [x + l * 30, y - 6], [x + l * 21, y + 6]), CARA, { alto: 4, ...op, sombra: 0.3, base: l > 0 ? -0.5 : 0 });
    p.volumen(pol([x + l * 21, y - 6], [x + l * 33, y - 18], [x + l * 27, y - 6], [x + l * 22, y + 2]), rampa("#a8182a"), { alto: 2, borde: false });
    p.volumen(ci(x + l * 25, y + 10, 2.4), ORO, { alto: 1.4, ...op, brillo: 1 });
    p.volumen(pol([x + l * 25, y + 12], [x + l * 28, y + 16], [x + l * 25, y + 21], [x + l * 22, y + 16]), MORADO, { alto: 1.6, ...op, brillo: 1 });
  }
}

/** Una filigrana dorada (espiral) pintada en la cara. */
function espiral(p: Pintura, x: number, y: number, r: number, lado: 1 | -1, col: RGBA) {
  let px = x;
  let py = y;
  for (let i = 1; i <= 18; i++) {
    const t = i / 18;
    const a = t * Math.PI * 2.4;
    const rr = r * t;
    const qx = x + lado * Math.cos(a) * rr;
    const qy = y - Math.sin(a) * rr;
    p.trazo(px + OX, py + OY, qx + OX, qy + OY, col, 1);
    px = qx;
    py = qy;
  }
}

/** La cara: el rostro rojo de lentejuela, los ojos saltones, las cejas negras, la nariz, el bigote y la boca de arriba. */
function cara(p: Pintura) {
  const { x, y } = H;
  const forma = union(el(x, y - 4, 24, 22), el(x, y + 12, 21, 18), el(x - 14, y + 6, 10, 10), el(x + 14, y + 6, 10, 10));
  p.volumen(forma, CARA, { alto: 16, ...op, pinta: (q, c) => lentejuela(q, c, CARA, 0.9) });
  // El lado de la sombra y la luz de la frente.
  p.volumen(resta(forma, el(x - 10, y, 30, 30)), CARA, { alto: 8, base: -1.2, borde: false });
  p.volumen(el(x - 8, y - 18, 10, 4, -0.2), CARA, { alto: 2, base: 1, borde: false });
  // Filigrana dorada: la frente y las sienes.
  const oro = tono(ORO, 5);
  curvaP(p, x - 6, y - 14, x, y - 22, x + 6, y - 14, oro, 1);
  p.volumen(pol([x, y - 20], [x + 2.2, y - 16], [x, y - 12], [x - 2.2, y - 16]), MORADO, { alto: 1, ...op, brillo: 1 });
  espiral(p, x - 18, y - 8, 4, -1, oro);
  espiral(p, x + 18, y - 8, 4, 1, oro);
  // Los pómulos levantados por la risa.
  for (const l of [-1, 1]) p.volumen(el(x + l * 13, y + 6, 6, 4.4), CARA, { alto: 3, base: 0.7, borde: false, sombra: 0.3 });
  // Las cejas: negras, gruesas y arqueadas, con filo dorado.
  for (const l of [-1, 1] as const) {
    curvaP(p, x + l * 3, y - 10, x + l * 9, y - 18, x + l * 18, y - 13, tono(ORO, 4), 3);
    curvaP(p, x + l * 3, y - 10, x + l * 9, y - 18, x + l * 18, y - 13, tono(NEGRO, 2), 1.8);
  }
  // Los ojos saltones (miran hacia la vereda).
  for (const l of [-1, 1] as const) ojo(p, x + OX + l * 9.5, y + OY - 3, 13, 5.6, 5, l, { iris: AZUL_OJO, pestanas: 0, mira: -1.4, linea: 1.6 });
  // La nariz redonda y grande.
  p.volumen(union(el(x, y + 4, 5.5, 4.5), el(x, y - 1, 2.6, 5)), CARA, { alto: 4, base: 0.6, borde: "oscuro", sombra: 0.4, brillo: 0.9 });
  for (const l of [-1, 1]) p.plano(el(x + l * 2.4, y + 6.4, 1.4, 0.9), tono(BOCA, 1));
  // La boca abierta (el hueco) y los dientes de arriba con los colmillos.
  p.volumen(el(x, y + 22, 15, 10.5), BOCA, { alto: 3, base: -0.8, borde: "oscuro" });
  // Los dientes de arriba: una hilera blanca (con la rayita entre uno y otro) y los dos colmillos largos.
  p.plano(el(x, y + 14, 12, 4.4), (qx, qy) => {
    const u = qx + 0.5 - OX - x;
    const v = qy + 0.5 - OY - y;
    if (v < 13.4) return null;
    if (Math.abs(((u + 1.5) % 3.4 + 3.4) % 3.4) < 0.6) return tono(BLANCO, 1);
    return tono(BLANCO, v > 16.4 ? 3 : 5);
  });
  for (const l of [-1, 1]) p.volumen(pol([x + l * 8, y + 14.5], [x + l * 12, y + 15], [x + l * 10.6, y + 25]), BLANCO, { alto: 1.4, planos: true, borde: "propio", brillo: 1 });
  // El bigote: dos alas negras, gruesas en el medio, que bajan y suben en punta enroscada, con filo dorado.
  for (const l of [-1, 1] as const) {
    const ala = union(el(x + l * 5, y + 10.5, 6, 2.6, l * 0.25), cap(x + l * 9, y + 11.5, x + l * 15, y + 8, 2.2, 1.4), cap(x + l * 15, y + 8, x + l * 17, y + 3, 1.4, 1));
    p.volumen(engordarF(ala, 1), ORO, { alto: 1.5, ...op, brillo: 0.9 });
    p.volumen(ala, NEGRO, { alto: 2, ...op, brillo: 0.6 });
    espiral(p, x + l * 15.6, y + 2.6, 2.4, l, tono(NEGRO, 1));
  }
}

const caja2 = (x0: number, y0: number, x1: number, y1: number): Forma => pol([x0, y0], [x1, y0], [x1, y1], [x0, y1]);

/** La quijada (se abre al reírse): el labio de abajo, la lengua, los dientes de abajo y la barba de candado. */
function quijada(p: Pintura) {
  const { x, y } = H;
  const barba = resta(union(el(x, y + 31, 19, 10), pol([x - 18, y + 29], [x + 18, y + 29], [x + 4, y + 51], [x, y + 55], [x - 4, y + 51])), el(x, y + 20, 13.5, 9));
  p.volumen(barba, rampa("#b81c28"), {
    alto: 8,
    ...op,
    // Los pelos de la barba: mechas que bajan.
    pinta: (q, c) => {
      const s = Math.sin((q.x - OX - x) * 1.3 + (q.y - OY) * 0.25);
      return s > 0.7 ? tono(rampa("#b81c28"), 4) : s < -0.75 ? tono(rampa("#b81c28"), 1) : c;
    },
  });
  // El labio, la lengua y los dientes de abajo.
  curvaP(p, x - 13, y + 24, x, y + 33, x + 13, y + 24, tono(CARA, 2), 2.6);
  p.volumen(el(x + 1, y + 26, 8, 4), LENGUA, { alto: 2, brillo: 0.8, borde: "oscuro" });
  p.trazo(x + 1 + OX, y + 24 + OY, x + 1 + OX, y + 28 + OY, tono(LENGUA, 1), 1);
  for (const l of [-1, 1]) p.volumen(pol([x + l * 6, y + 30], [x + l * 9.6, y + 29], [x + l * 7.6, y + 23]), BLANCO, { alto: 1, planos: true, borde: "propio", brillo: 1 });
}

// ---------- Los angelitos y los diablitos ----------

/** Un angelito (pies en x, y): alas blancas, rizos con corona de flores, vestido tornasolado y un brazo arriba. */
function angelito(p: Pintura, x: number, y: number, s: number, k: number) {
  const S = (v: number) => v * s;
  const piel = PIEL[k % 3]!;
  const pelo = RIZOS[k % 3]!;
  const vestido = VESTIDOS[k % 4]!;
  // Las alas, detrás de los hombros (la de la derecha en sombra).
  for (const l of [-1, 1] as const) {
    const ax = x + l * S(7);
    const ay = y - S(21);
    const ala = union(el(ax, ay, S(6.4), S(4.4), l * -0.55), el(ax + l * S(2), ay + S(3), S(4.4), S(3), l * -0.3), pol([ax + l * S(2), ay - S(4)], [ax + l * S(9), ay - S(6)], [ax + l * S(7), ay + S(1)]));
    p.volumen(ala, BLANCO, { alto: S(3), ...op, base: l > 0 ? -0.6 : 0.3, sombra: 0.3, pinta: (q, c) => (Math.abs(((q.x - OX - ax) * l * 0.6 + (q.y - OY - ay)) % 3) < 0.6 ? tono(BLANCO, 2) : c) });
  }
  // Las piernitas con sandalias doradas.
  for (const l of [-1, 1]) {
    p.volumen(cap(x + l * S(2), y - S(8), x + l * S(2.4), y - S(1.5), S(1.4)), piel, { alto: 1, ...op });
    p.volumen(el(x + l * S(2.6), y - S(0.8), S(1.8), S(1)), ORO, { alto: 1, ...op });
  }
  // El vestido de campana, tornasolado, con el ruedo blanco de vuelos.
  const falda = pol([x - S(3.6), y - S(16)], [x + S(3.6), y - S(16)], [x + S(8), y - S(6)], [x - S(8), y - S(6)]);
  p.volumen(falda, vestido, { alto: S(4), ...op, patron: (q) => (Math.floor((q.x - OX - x + S(10)) / S(2.6)) % 3 === 1 ? VESTIDOS[(k + 1) % 4]! : vestido) });
  for (let i = -3; i <= 3; i++) p.volumen(ci(x + i * S(2.3), y - S(6), S(1.6)), BLANCO, { alto: 1, ...op });
  p.volumen(el(x, y - S(17), S(4), S(3)), vestido, { alto: S(2), ...op });
  // Los brazos: uno arriba (baila) y otro abierto.
  p.volumen(cap(x + S(3), y - S(18), x + S(7.5), y - S(25), S(1.3)), piel, { alto: 1, ...op });
  p.volumen(ci(x + S(8), y - S(26), S(1.6)), piel, { alto: 1, ...op });
  p.volumen(cap(x - S(3), y - S(18), x - S(7.5), y - S(15), S(1.3)), piel, { alto: 1, ...op });
  p.volumen(ci(x - S(8), y - S(14.5), S(1.6)), piel, { alto: 1, ...op });
  // La cabeza: los rizos de atrás, la cara redonda, el fleco y la corona de flores.
  const hy = y - S(26);
  p.volumen(union(ci(x - S(5), hy + S(1), S(3)), ci(x + S(5), hy + S(1), S(3)), ci(x - S(4.6), hy + S(4.6), S(2.4)), ci(x + S(4.6), hy + S(4.6), S(2.4)), ci(x, hy - S(3), S(5.6))), pelo, { alto: S(3), ...op });
  p.volumen(el(x, hy + S(1), S(5.2), S(5)), piel, { alto: S(3), ...op, brillo: 0.6 });
  for (const i of [-1, 0, 1]) p.volumen(ci(x + i * S(3), hy - S(3.4), S(2.2)), pelo, { alto: 1.4, ...op });
  for (let i = -2; i <= 2; i++) p.volumen(ci(x + i * S(2.6), hy - S(5.4) + Math.abs(i) * S(0.6), S(1.3)), [ROSA, AMARILLO, rampa("#5ab0e8"), ROSA, AMARILLO][i + 2]!, { alto: 1, brillo: 1, borde: "oscuro" });
  for (const l of [-1, 1]) {
    p.plano(el(x + l * S(2), hy + S(1), Math.max(0.6, S(0.8)), Math.max(0.8, S(1.1))), LINEA);
    p.punto(Math.round(x + l * S(2) - 0.4 + OX), Math.round(hy + S(0.2) + OY), BRILLO);
    mejilla(p, x + OX + l * S(3.6), hy + OY + S(3), S(1.4), S(0.9), tono(rampa("#ef6ba0"), 3));
  }
  curvaP(p, x - S(1.6), hy + S(3.2), x, hy + S(5), x + S(1.6), hy + S(3.2), LINEA, 1);
}

/** Un diablito (pies en x, y): rojo, de cuernitos dorados, cola de flecha, collar de oro, bailando con los puños arriba. */
function diablito(p: Pintura, x: number, y: number, s: number, lado: 1 | -1) {
  const S = (v: number) => v * s;
  const col = ROJO;
  // La cola de flecha, detrás.
  curvaP(p, x - lado * S(3), y - S(9), x - lado * S(12), y - S(6), x - lado * S(10), y - S(16), tono(rampa("#a8182a"), 2), Math.max(1.4, S(1.6)));
  p.volumen(pol([x - lado * S(10), y - S(15)], [x - lado * S(13), y - S(18)], [x - lado * S(8), y - S(20)]), col, { alto: 1, ...op });
  // Las piernas: una doblada arriba (baila) y la otra de apoyo, con pezuñas negras.
  p.volumen(cap(x + lado * S(2.6), y - S(9), x + lado * S(6), y - S(6), S(2.2), S(1.8)), col, { alto: 1.4, ...op });
  p.volumen(cap(x + lado * S(6), y - S(6), x + lado * S(4.4), y - S(1.6), S(1.7)), col, { alto: 1.4, ...op });
  p.volumen(el(x + lado * S(4.4), y - S(1), S(1.8), S(1.1)), NEGRO, { alto: 1, ...op });
  p.volumen(cap(x - lado * S(2.4), y - S(9), x - lado * S(2.8), y - S(1.6), S(2)), col, { alto: 1.4, ...op });
  p.volumen(el(x - lado * S(2.8), y - S(1), S(1.9), S(1.1)), NEGRO, { alto: 1, ...op });
  // El cuerpo y la barriga.
  p.volumen(el(x, y - S(13), S(5.4), S(5.6)), col, { alto: S(3), ...op, sombra: 0.3 });
  p.volumen(el(x - S(0.6), y - S(12), S(3), S(3.4)), rampa("#e85a40"), { alto: 1.4, borde: false });
  // Los brazos: puños arriba.
  for (const l of [-1, 1]) {
    p.volumen(cap(x + l * S(4.6), y - S(16), x + l * S(9), y - S(19), S(1.7)), col, { alto: 1, ...op });
    p.volumen(cap(x + l * S(9), y - S(19), x + l * S(8.4), y - S(25), S(1.5)), col, { alto: 1, ...op });
    p.volumen(ci(x + l * S(8.4), y - S(26), S(2.1)), col, { alto: 1, ...op });
  }
  // El collar de oro con su medalla.
  curvaP(p, x - S(4), y - S(17), x, y - S(14), x + S(4), y - S(17), tono(ORO, 4), Math.max(1, S(1.2)));
  p.volumen(ci(x, y - S(14.4), S(1.4)), ORO, { alto: 1, brillo: 1, borde: "oscuro" });
  // La cabeza: orejas puntudas, cuernitos dorados, cara de risa.
  const hy = y - S(23);
  for (const l of [-1, 1]) {
    p.volumen(pol([x + l * S(4), hy - S(1)], [x + l * S(9), hy - S(4)], [x + l * S(5), hy + S(2)]), col, { alto: 1, ...op });
    p.volumen(pol([x + l * S(2.4), hy - S(4)], [x + l * S(6.6), hy - S(11)], [x + l * S(4.6), hy - S(3)]), ORO, { alto: 1.2, ...op, brillo: 0.9 });
  }
  p.volumen(el(x, hy, S(5.2), S(5)), col, { alto: S(3), ...op, brillo: 0.6 });
  for (const l of [-1, 1]) {
    p.plano(el(x + l * S(2.1), hy - S(0.6), S(1.3), S(1.1)), tono(AMARILLO, 5));
    p.plano(ci(x + l * S(2.1) + lado * S(0.3), hy - S(0.5), Math.max(0.6, S(0.6))), LINEA);
    p.trazo(x + l * S(0.8) + OX, hy - S(2.2) + OY, x + l * S(3.6) + OX, hy - S(3) + OY, LINEA, 1);
  }
  p.volumen(el(x, hy + S(2.6), S(3), S(1.6)), BOCA, { alto: 1, borde: "oscuro" });
  p.plano(caja2(x - S(2.2), hy + S(1.4), x + S(2.2), hy + S(2.2)), tono(BLANCO, 4));
}

/** Un bailarín de la capa (cada uno es una parte, a su propio ritmo). */
function bailarin(f: Figura, id: string, u: number, v: number, k: number, angel: boolean, s = 1): Parte {
  const p = f.lienzo();
  const q = pantalla(u, v, 0);
  if (angel) angelito(p, q.x, q.y, s, k);
  else diablito(p, q.x, q.y, s, k % 2 ? 1 : -1);
  const mov = angel
    ? { vaiven: { dy: -1.6, periodo: 900 + k * 70, fase: k * 0.23 }, gira: { amp: 0.08, periodo: 1500 + k * 110, fase: k * 0.3 } }
    : { vaiven: { dy: -1.8, periodo: 520 + k * 40, fase: k * 0.37 }, gira: { amp: 0.13, periodo: 1040 + k * 80, fase: k * 0.21 } };
  return f.parte(id, p, ...P(q.x, q.y), { mov });
}

/** La máscara de diablo sobre el faldón, en la esquina de adelante. */
function mascara(p: Pintura) {
  const m = pantalla(LARGO, ANCHO * 0.62, -2);
  const x = m.x - 2;
  const y = m.y - 4;
  for (const l of [-1, 1]) p.volumen(union(cap(x + l * 6, y - 6, x + l * 11, y - 12, 2.6, 2), cap(x + l * 11, y - 12, x + l * 9, y - 18, 2, 1)), AMARILLO, { alto: 2, ...op, brillo: 0.9 });
  for (const l of [-1, 1]) p.volumen(pol([x + l * 8, y - 2], [x + l * 15, y - 6], [x + l * 9, y + 4]), CARA, { alto: 1.4, ...op });
  p.volumen(union(el(x, y, 9, 9), el(x, y + 6, 7, 6)), CARA, { alto: 6, ...op, pinta: (q, c) => lentejuela(q, c, CARA) });
  for (const l of [-1, 1]) {
    p.trazo(x + l * 1.5 + OX, y - 4 + OY, x + l * 7 + OX, y - 6 + OY, LINEA, 1.6);
    p.plano(el(x + l * 3.6, y - 1.6, 2, 1.4), tono(AMARILLO, 5));
    p.plano(ci(x + l * 3.6, y - 1.4, 0.9), LINEA);
  }
  p.volumen(el(x, y + 2, 2.2, 1.8), CARA, { alto: 1, base: 0.6, borde: "oscuro" });
  p.volumen(el(x, y + 7, 5, 2.6), BOCA, { alto: 1, borde: "oscuro" });
  p.plano(caja2(x - 4, y + 5.4, x + 4, y + 6.4), tono(BLANCO, 4));
  for (const l of [-1, 1]) p.volumen(pol([x + l * 2.4, y + 6], [x + l * 4, y + 6], [x + l * 3.2, y + 9]), BLANCO, { alto: 1, borde: false });
}

/** El faldón del diablo: rojo de lentejuela con festones dorados, triangulitos y rosetas de colores. */
function faldon(u: number, v: number, alto: number): RGBA {
  const cell = 10;
  const k = Math.floor(u / cell);
  const fu = (((u % cell) + cell) % cell) - cell / 2;
  const swag = alto - 3 - (1 - (fu / 5) ** 2) * 2.6;
  if (Math.abs(v - swag) < 0.6) return tono(ORO, 4);
  if (v > swag) return Math.floor(u * 1.5) % 3 === 0 ? tono(k % 2 ? VERDE : MORADO, 3) : tono(ROJO, 3);
  const bajo = swag - v;
  if (Math.abs(fu) < 3 - bajo * 0.9 && bajo < 3.4) return tono(ORO, bajo < 1.4 ? 4 : 3);
  const dr = Math.hypot(Math.abs(fu) - 5, (v - 3.4) * 1.3);
  if (dr < 1.5) return tono(dr < 0.7 ? AMARILLO : k % 2 ? ROSA : TURQUESA, 4);
  return tono(ROJO, (Math.floor(u * 2) + Math.floor(v * 2)) % 4 === 0 ? 4 : (Math.floor(u) + Math.floor(v)) % 5 === 0 ? 2 : 3);
}

export function diablo(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon, cubierta: (u, v) => tono(Math.floor(u / 4) % 2 ? CAPA : ROJO, v > ANCHO - 3 ? 2 : 3), flecos: [ORO, ORO, ROJO, ORO] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // La capa (quieta) y las escamas de arriba, que ondean.
  const manto = f.lienzo();
  capa(manto);
  partes.push(f.parte("capa", manto, ...P(-10, 20)));
  for (const g of [0, 1] as const) {
    const p = f.lienzo();
    escamasArriba(p, g);
    const piv = g === 0 ? P(-36, -40) : P(2, -28);
    partes.push(f.parte(`capa-ola-${g}`, p, ...piv, { padre: "capa", mov: { gira: { amp: 0.07, periodo: 2400, fase: g * 0.3 }, vaiven: { dy: -1.4, periodo: 2400, fase: g * 0.3 + 0.25 } } }));
  }

  // Los de atrás: dos diablitos y un angelito delante de la capa.
  partes.push(bailarin(f, "fila-1", 14, 22, 0, false, 0.92));
  partes.push(bailarin(f, "fila-2", 34, 24, 1, true, 0.92));
  partes.push(bailarin(f, "fila-3", 52, 25, 2, false, 0.92));

  // El cuerpo: el pecho bajo la barba.
  const cu = f.lienzo();
  pecho(cu);
  partes.push(f.parte("cuerpo", cu, ...P(H.x, H.y + 80), { mov: { gira: { amp: 0.008, periodo: 5600 } } }));

  // Las cintas (detrás de la cabeza), la cabeza, los párpados y la quijada.
  for (const l of [-1, 1] as const) {
    const p = f.lienzo();
    const b = cintas(p, l);
    partes.push(f.parte(l < 0 ? "cintas-izq" : "cintas-der", p, ...P(b.x, b.y), { padre: "cabeza", mov: { gira: { amp: 0.14, periodo: 1700, fase: l < 0 ? 0 : 0.4 } } }));
  }
  const cab = f.lienzo();
  orejas(cab);
  cuerno(cab, -1);
  cuerno(cab, 1);
  corona(cab);
  cara(cab);
  partes.push(f.parte("cabeza", cab, ...P(H.x, H.y + 30), { padre: "cuerpo", mov: { gira: { amp: 0.05, periodo: 3200 } } }));
  const parp = f.lienzo();
  for (const l of [-1, 1] as const) parpado(parp, H.x + OX + l * 9.5, H.y + OY - 3, 13, 5.6, 5, l, CARA);
  partes.push(f.parte("parpados", parp, ...P(H.x, H.y + 30), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3400, dura: 190 } } }));
  const qui = f.lienzo();
  quijada(qui);
  partes.push(f.parte("quijada", qui, ...P(H.x, H.y + 18), { padre: "cabeza", mov: { vaiven: { dy: 2, periodo: 700 } } }));

  // Adelante: angelitos y diablitos que bailan en la orilla, uno que vuela junto a la cabeza y la máscara.
  partes.push(bailarin(f, "baile-1", 6, 37, 3, true));
  partes.push(bailarin(f, "baile-2", 22, 38, 4, false));
  partes.push(bailarin(f, "baile-3", 38, 38, 5, true));
  partes.push(bailarin(f, "baile-4", 56, 38, 6, false));
  const vuela = f.lienzo();
  angelito(vuela, H.x + 40, H.y + 12, 0.9, 7);
  partes.push(f.parte("angel-vuela", vuela, ...P(H.x + 40, H.y + 12), { mov: { vaiven: { dy: -3, periodo: 2000 }, gira: { amp: 0.1, periodo: 2600 } } }));
  const mas = f.lienzo();
  mascara(mas);
  const m = pantalla(LARGO, ANCHO * 0.62, -2);
  partes.push(f.parte("mascara", mas, ...P(m.x, m.y + 6)));
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}
