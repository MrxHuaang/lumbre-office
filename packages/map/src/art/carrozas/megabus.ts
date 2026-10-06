// El Megabús de la alegría, que cierra el desfile (pixel art pintado): el bus verde lima de la parada vuelto
// un monstruo feliz de papel maché, con el cuerpo de anillos (cada uno con su rejilla de vidrios oscuros),
// los ojos saltones que miran a la gente y parpadean, y la boca enorme de oreja a oreja con los dientes y
// la lengua. Por abajo, una guirnalda de plumas de todos los colores; arriba, en la terraza, la comparsa
// bailando con sus tocados de plumas alrededor de un loro gigante, y el confeti y las serpentinas que caen.
import type { Ramp, RGBA } from "../pixel";
import { BRILLO, Figura, LINEA, parpado, pluma } from "./figuras";
import { persona } from "./gentecita";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { capsula, circulo, elipse, fundir, Pintura, poligono, rampa, tono, union, type Forma } from "./pintura";

const LARGO = 132;
/** Lo alto del bus (z del techo). */
const ALTO = 38;
const LIMA = rampa("#a6d23a");
const LIMA2 = rampa("#86b02a");
const VIDRIO = rampa("#1c2a3a");
const PISO = rampa("#7a4a2a");
const BOCA = rampa("#5a1028");
const LENGUA = rampa("#e04a5a");
const DIENTE = rampa("#f6f0e0");
const BLANCO = rampa("#f2f0ea");
const IRIS = rampa("#1f8aa8");
const VERDE = rampa("#3db842");
const AMARILLO = rampa("#f6c81c");
const NARANJA = rampa("#f2861c");
const COLORES = ["#e0283c", "#f2711c", "#f7c518", "#3db842", "#1fb8b0", "#2f6fd6", "#8a3cc8", "#e0509a"].map(rampa);
const PIELES = [rampa("#e8b088"), rampa("#c98a5a"), rampa("#a8704a"), rampa("#f0c098")];

const OX = 80;
const OY = 125;
const fig = () => new Figura(256, 240, OX, OY, [0, 0, 0]);
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);
const op = { planos: true, borde: "oscuro" as const };
/** Un punto del mundo de la carroza en px de pantalla. */
const W = (x: number, y: number, z: number): [number, number] => {
  const s = pantalla(x, y, z);
  return [s.x, s.y];
};

/** Lunares de confeti pintados sobre la lata (pocos y de colores). */
const lunar = (q: { x: number; y: number }): RGBA | null => {
  const h = (q.x * 73856093) ^ (q.y * 19349663);
  if ((h >>> 0) % 37 !== 0) return null;
  return tono(COLORES[(h >>> 3) % COLORES.length]!, 4);
};

// ---------- La carrocería ----------

/** Los anillos del costado, cada uno inflado, con su rejilla de vidrios oscuros. */
function costado(p: Pintura) {
  const n = 7;
  const u0 = 2;
  const u1 = LARGO - 4;
  const paso = (u1 - u0) / n;
  for (let k = 0; k < n; k++) {
    const a = u0 + k * paso;
    const b = a + paso - 1;
    const forma = fundir(pol(W(a, ANCHO, -8), W(b, ANCHO, -8), W(b, ANCHO, ALTO - 3), W(a, ANCHO, ALTO - 3)), pol(W(a + 1, ANCHO - 6, ALTO), W(b - 1, ANCHO - 6, ALTO), W(b, ANCHO, ALTO - 3), W(a, ANCHO, ALTO - 3)), 3);
    p.volumen(forma, LIMA, {
      alto: 6,
      ...op,
      sombra: 0.3,
      pinta: (q, c) => {
        const sx = q.x + 0.5 - OX;
        const sy = q.y + 0.5 - OY;
        const u = sx + ANCHO - a;
        const z = (sx + ANCHO * 2) / 2 - sy;
        // La rejilla: tres vidrios oscuros con el marco lima.
        if (u > 3 && u < paso - 4 && z > 14 && z < 31) {
          const f = (z - 14) % 6;
          if (f < 4) return tono(VIDRIO, f < 1 ? 1 : u < 5 ? 4 : 3);
          return tono(LIMA2, 2);
        }
        return lunar(q) ?? c;
      },
    });
  }
}

/** El techo: el borde lima redondeado y la terraza de madera con la baranda dorada. */
function techo(p: Pintura) {
  const borde = pol(W(0, 0, ALTO), W(LARGO, 0, ALTO), W(LARGO, ANCHO, ALTO), W(0, ANCHO, ALTO));
  p.volumen(borde, LIMA, { alto: 4, ...op, base: 0.6, pinta: (q, c) => lunar(q) ?? c });
  p.volumen(pol(W(4, 3, ALTO), W(LARGO - 5, 3, ALTO), W(LARGO - 5, ANCHO - 4, ALTO), W(4, ANCHO - 4, ALTO)), PISO, {
    alto: 1,
    planos: true,
    borde: false,
    brillo: 0,
    pinta: (q, c) => {
      const sx = q.x + 0.5 - OX;
      const sy = q.y + 0.5 - OY;
      const wx = (sx + 2 * (sy + ALTO)) / 2;
      const wy = (2 * (sy + ALTO) - sx) / 2;
      if (wx < 5 || wx > LARGO - 6 || wy < 4 || wy > ANCHO - 5) return tono(ORO, 4);
      return Math.floor(wx / 4) % 2 ? tono(PISO, 3) : tono(PISO, 2);
    },
  });
}

/** Cómo se ve un punto de pantalla en la trompa (x = LARGO): `a` de la esquina de la calle hacia adentro y `b` hacia arriba. */
const trompa = (sx: number, sy: number) => {
  const wy = LARGO + 1 - sx;
  return { a: ANCHO - wy, b: (LARGO + 1 + wy) / 2 - sy };
};
/** Un punto de la trompa en px de pantalla. */
const T = (a: number, b: number) => W(LARGO + 1, ANCHO - a, b);

/** La boca: el borde de arriba (con las comisuras levantadas) y el de abajo. */
const BOCA_A = { c: 20, r: 17 };
const bocaArriba = (a: number) => 23 + 5 * ((a - BOCA_A.c) / BOCA_A.r) ** 2;
const bocaAbajo = (a: number) => 22 - 17 * Math.sqrt(Math.max(0, 1 - ((a - BOCA_A.c) / BOCA_A.r) ** 2));
const bocaForma = (): Forma => {
  const [x0, y0] = T(BOCA_A.c - BOCA_A.r - 1, 26);
  const [x1, y1] = T(BOCA_A.c + BOCA_A.r + 1, 2);
  return {
    d: (px, py) => {
      const { a, b } = trompa(px - OX, py - OY);
      return Math.max(Math.abs(a - BOCA_A.c) - BOCA_A.r, bocaAbajo(a) - b, b - bocaArriba(a));
    },
    x0: Math.min(x0, x1) + OX - 2,
    y0: Math.min(y0, y1) + OY - 22,
    x1: Math.max(x0, x1) + OX + 2,
    y1: Math.max(y0, y1) + OY + 22,
  };
};

/** La trompa: la cara redondeada, la boca con los dientes de arriba, la rejilla, las farolas y el bómper. */
function cara(p: Pintura) {
  const forma = fundir(pol(T(0, -8), T(ANCHO, -8), T(ANCHO, ALTO - 3), T(0, ALTO - 3)), pol(T(1, ALTO), T(ANCHO - 1, ALTO), T(ANCHO, ALTO - 3), T(0, ALTO - 3)), 4);
  p.volumen(forma, LIMA, {
    alto: 8,
    ...op,
    base: -0.3,
    pinta: (q, c) => {
      const { a, b } = trompa(q.x + 0.5 - OX, q.y + 0.5 - OY);
      // El bómper gris oscuro con las placas de colores.
      if (b < -3) return tono(rampa("#4a5048"), b < -6 ? 2 : 3);
      // La rejilla del radiador.
      if (b < 3 && b > -2 && a > 12 && a < 28) return Math.floor(b + 2) % 2 ? tono(VIDRIO, 3) : tono(LIMA2, 2);
      // Las farolas.
      for (const fa of [5, 35]) if (Math.abs(a - fa) < 4 && b > -2 && b < 3) return tono(rampa("#fff6c8"), b > 1 ? 5 : 4);
      return lunar(q) ?? c;
    },
  });
  // La boca: la encía oscura, la lengua y los dientes de arriba (triángulos parejos).
  const boca = bocaForma();
  p.volumen(boca, BOCA, {
    alto: 3,
    ...op,
    pinta: (q, c) => {
      const { a, b } = trompa(q.x + 0.5 - OX, q.y + 0.5 - OY);
      const f = ((a - BOCA_A.c + 50) % 3.4) / 3.4;
      const diente = 3.6 * (1 - Math.abs(f * 2 - 1));
      if (b > bocaArriba(a) - diente && Math.abs(a - BOCA_A.c) < BOCA_A.r - 1.5) return tono(DIENTE, b > bocaArriba(a) - 1.2 ? 3 : 4);
      return c;
    },
  });
  // El labio lima de arriba (más grueso) y los cachetes.
  for (let k = 0; k < 20; k++) {
    const a = BOCA_A.c - BOCA_A.r + (k / 19) * BOCA_A.r * 2;
    const [x, y] = T(a, bocaArriba(a) + 1);
    p.punto(Math.round(x + OX), Math.round(y + OY), tono(LIMA2, 1));
  }
  for (const a of [1.5, 38.5]) {
    const [x, y] = T(a, 22);
    p.volumen(el(x, y, 4.4, 5), LIMA, { alto: 3, ...op, base: 0.6 });
  }
}

/** La quijada (aparte, para que la boca se abra): la lengua y los dientes de abajo. */
function quijada(p: Pintura) {
  const boca = bocaForma();
  p.plano(boca, (x, y) => {
    const { a, b } = trompa(x + 0.5 - OX, y + 0.5 - OY);
    const f = ((a - BOCA_A.c + 50 + 1.7) % 3.4) / 3.4;
    const diente = 3 * (1 - Math.abs(f * 2 - 1));
    if (b < bocaAbajo(a) + diente && Math.abs(a - BOCA_A.c) < BOCA_A.r - 2.5) return tono(DIENTE, 4);
    const lengua = Math.hypot((a - BOCA_A.c) / 11, (b - 9) / 5.4);
    if (lengua < 1) return tono(LENGUA, lengua < 0.45 && a < BOCA_A.c ? 5 : Math.abs(a - BOCA_A.c) < 0.7 ? 2 : 3);
    return null;
  });
}

/** Los ojos saltones arriba de la trompa (sin la pupila, que va aparte para que mire). */
const OJOS = [T(9, ALTO + 4), T(31, ALTO + 4)];
function ojos(p: Pintura) {
  for (const [x, y] of OJOS) {
    p.volumen(el(x, y, 11, 11), LIMA, { alto: 6, ...op, sombra: 0.35, base: 0.3 });
    p.volumen(el(x, y + 1, 8.4, 8.4), BLANCO, { alto: 5, ...op, brillo: 0.3 });
  }
}
function pupilas(p: Pintura) {
  for (const [x, y] of OJOS) {
    p.volumen(ci(x + 1, y + 1.4, 5), IRIS, { alto: 3, planos: true, borde: false, brillo: 0 });
    p.plano(ci(x + 1, y + 1.4, 2.6), LINEA);
    p.plano(ci(x - 0.8, y - 0.6, 1.4), BRILLO);
    p.punto(Math.round(x + 3 + OX), Math.round(y + 3.4 + OY), BRILLO);
  }
}
function parpados(p: Pintura) {
  for (const [x, y] of OJOS) parpado(p, x + OX, y + 1 + OY, 17, 8.4, 8.4, 1, LIMA);
}

/** La guirnalda de plumas de colores por debajo del costado y en la esquina de la trompa. */
function guirnalda(p: Pintura) {
  // Dos capas: atrás las largas, que caen hacia la cola; adelante las cortas, abiertas en abanico.
  for (const capa of [0, 1]) {
    for (let u = capa ? 2 : 0; u <= LARGO + 2; u += 4) {
      const [x, y] = W(u, ANCHO + 1, capa ? 2 : 6);
      const k = Math.round(u / 4) * 3 + capa * 5;
      const ang = Math.PI * (0.55 + (Math.round(u / 4) % 2 ? 0.16 : -0.12) + (capa ? 0.05 : 0));
      pluma(p, x + OX, y + OY, ang, capa ? 16 : 19, capa ? 9 : 10, COLORES[k % COLORES.length]!, { brillo: 0.2 });
    }
  }
  for (let a = 0; a < 9; a += 3) {
    const [x, y] = T(a, -2);
    pluma(p, x + OX, y + OY, Math.PI * (0.4 + a * 0.02), 13, 6.4, COLORES[(a * 2 + 1) % COLORES.length]!, { brillo: 0.25 });
  }
}

/** Las serpentinas que cuelgan del borde del techo. */
function serpentinas(p: Pintura) {
  for (let u = 8; u < LARGO - 4; u += 13) {
    const [x, y] = W(u, ANCHO, ALTO - 1);
    const col = tono(COLORES[(u * 3) % COLORES.length]!, 4);
    let px = x;
    let py = y;
    for (let i = 1; i <= 16; i++) {
      const qx = x + Math.sin(i * 0.9) * 2.4 - i * 0.2;
      const qy = y + i * 0.9;
      p.trazo(px + OX, py + OY, qx + OX, qy + OY, col, 1.4);
      px = qx;
      py = qy;
    }
  }
}

// ---------- La terraza: el loro y la comparsa ----------

const LORO = W(70, 12, ALTO);
function loro(p: Pintura) {
  const [x, y] = LORO;
  // La cola de plumas larga detrás.
  [VERDE, NARANJA, AMARILLO, COLORES[5]!].forEach((r, k) => pluma(p, x - 8 + OX, y - 18 + OY, Math.PI * 0.85 + k * 0.12, 30 - k * 3, 9, r, { brillo: 0.3 }));
  // El cuerpo de escamas verdes y el pecho amarillo.
  const cuerpo = fundir(el(x, y - 22, 15, 20, -0.15), el(x + 2, y - 6, 12, 8), 6);
  p.volumen(cuerpo, VERDE, {
    alto: 10,
    ...op,
    sombra: 0.35,
    pinta: (q, c) => {
      const yy = q.y - OY - y;
      const xx = q.x - OX - x;
      // Las escamas: arquitos oscuros en filas corridas.
      const fila = Math.floor(yy / 3.4);
      const fx = (xx + (fila % 2) * 1.7 + 40) % 3.4;
      if ((yy + 40) % 3.4 < 0.9 && fx > 0.6) return tono(VERDE, 1);
      if (xx > 2 && xx < 11 && yy > -24) return tono(AMARILLO, Math.abs(fx - 1.7) < 0.6 ? 2 : 3);
      return c;
    },
  });
  for (const d of [-1, 1]) p.volumen(cap(x + d * 4, y - 2, x + d * 5, y + 1, 1.6), rampa("#e0a428"), { alto: 1, ...op });
}
function alaLoro(p: Pintura) {
  const [x, y] = LORO;
  // El ala abierta hacia adelante: plumas naranjas y amarillas sobre la cobertera verde.
  for (let k = 0; k < 6; k++) pluma(p, x + 4 + OX, y - 30 + OY, Math.PI * (0.02 + k * 0.09), 26 - k * 2, 8, [NARANJA, AMARILLO, NARANJA, VERDE, AMARILLO, NARANJA][k]!, { brillo: 0.3 });
  p.volumen(el(x + 8, y - 28, 9, 6, 0.3), VERDE, { alto: 4, ...op, sombra: 0.3 });
}

function cabezaLoro(p: Pintura) {
  const [x, y] = LORO;
  const hx = x + 2;
  const hy = y - 46;
  // La cresta de plumas de todos los colores.
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI / 2 - 0.95 + k * 0.24;
    pluma(p, hx - 2 + OX, hy - 6 + OY, a, 22 - Math.abs(k - 4) * 1.8, 7, COLORES[k % COLORES.length]!, { brillo: 0.3 });
  }
  p.volumen(el(hx, hy, 11, 10), VERDE, { alto: 6, ...op, sombra: 0.35, base: 0.4 });
  // El pico abierto, amarillo arriba y naranja abajo, con la lengua.
  p.volumen(pol([hx + 6, hy - 3], [hx + 18, hy + 1], [hx + 13, hy + 4], [hx + 6, hy + 3]), AMARILLO, { alto: 2, ...op, brillo: 0.9 });
  p.volumen(pol([hx + 6, hy + 5], [hx + 14, hy + 6], [hx + 7, hy + 10]), NARANJA, { alto: 2, ...op });
  p.plano(pol([hx + 7, hy + 3.6], [hx + 13, hy + 4.6], [hx + 7, hy + 5.6]), tono(LENGUA, 3));
  // El ojo grande con el aro blanco.
  p.volumen(el(hx + 2, hy - 3, 4.4, 4.6), BLANCO, { alto: 2, borde: "oscuro" });
  p.plano(ci(hx + 2.8, hy - 2.6, 2.2), LINEA);
  p.punto(Math.round(hx + 2 + OX), Math.round(hy - 4 + OY), BRILLO);
}

/** Una fila de bailarines de la terraza (faldas de vuelo y tocados de plumas). */
function fila(f: Figura, id: string, y: number, xs: readonly number[], k0: number, fase: number): Parte {
  const p = f.lienzo();
  xs.forEach((x, i) => {
    const k = k0 + i;
    const [cx, by] = W(x, y, ALTO);
    const c = (n: number) => COLORES[(k * 3 + n) % COLORES.length]!;
    persona(p, cx + OX, by + OY, 0.62, {
      piel: PIELES[k % PIELES.length]!,
      pelo: rampa("#2b1b12"),
      chaqueta: c(0),
      mangas: k % 2 ? c(2) : PIELES[k % PIELES.length]!,
      pantalon: c(4),
      falda: k % 2 ? undefined : [c(1), c(5)],
      ribete: ORO,
      gorro: "plumas",
      plumas: [c(0), c(2), c(4), c(6)],
      pose: k % 3 === 2 ? "saluda" : "baila",
      lado: k % 2 ? 1 : -1,
      canta: true,
    } as Parameters<typeof persona>[4]);
  });
  const [cx, by] = W(xs[0]!, y, ALTO);
  return f.parte(id, p, cx + OX, by + OY, { mov: { vaiven: { dy: -2.2, periodo: 560, fase } } });
}

/** Un puñado de confeti y una serpentina en el aire (cae y se desvanece). */
function confeti(f: Figura, id: string, x: number, y: number, k: number): Parte {
  const p = f.lienzo();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + k;
    const r = 4 + ((i * 7 + k) % 9);
    const cx = x + Math.cos(a) * r;
    const cy = y + Math.sin(a) * r * 0.7;
    const col = COLORES[(i + k * 2) % COLORES.length]!;
    const ang = (i * 1.3 + k) % Math.PI;
    p.volumen(capsula(cx + OX - Math.cos(ang) * 1.4, cy + OY - Math.sin(ang) * 1.4, cx + OX + Math.cos(ang) * 1.4, cy + OY + Math.sin(ang) * 1.4, 0.9), col, { alto: 1, planos: true, borde: false, brillo: 0.8 });
  }
  // La serpentina enroscada.
  const col = tono(COLORES[(k * 3 + 1) % COLORES.length]!, 4);
  let px = x + 6;
  let py = y - 6;
  for (let i = 1; i <= 18; i++) {
    const a = i * 0.7;
    const qx = x + 6 + Math.cos(a) * 3 + i * 0.5;
    const qy = y - 6 + Math.sin(a) * 2.4 + i * 0.3;
    p.trazo(px + OX, py + OY, qx + OX, qy + OY, col, 1.3);
    px = qx;
    py = qy;
  }
  return f.parte(id, p, x + OX, y + OY, { contorno: false, mov: { sube: { dx: -4, dy: 22, periodo: 2800 + k * 300, fase: k / 5, crece: 0.1 } } });
}

export function megabus(): CarrozaArte {
  const s = escena(LARGO, ALTO + 4);
  plataforma(s, LARGO, { faldon: (u) => tono(LIMA2, Math.floor(u / 4) % 2 ? 2 : 3), cubierta: () => tono(LIMA, 3), flecos: COLORES.slice(0, 4) }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // La lata del bus (techo, anillos y trompa), con la guirnalda y las serpentinas.
  const pc = f.lienzo();
  techo(pc);
  costado(pc);
  cara(pc);
  serpentinas(pc);
  guirnalda(pc);
  const centro = W(LARGO / 2, ANCHO, 0);
  partes.push(f.parte("carroceria", pc, centro[0] + OX, centro[1] + OY, { mov: { vaiven: { dy: -0.6, periodo: 1120 } } }));

  // La terraza: la fila de atrás, el loro gigante, y las filas del medio y de adelante.
  partes.push(fila(f, "fila-atras", 8, [12, 30, 46, 96, 112], 0, 0));
  const pl = f.lienzo();
  loro(pl);
  partes.push(f.parte("loro", pl, LORO[0] + OX, LORO[1] + OY, { padre: "carroceria", mov: { gira: { amp: 0.03, periodo: 2400 } } }));
  const pa = f.lienzo();
  alaLoro(pa);
  partes.push(f.parte("ala-loro", pa, LORO[0] + 4 + OX, LORO[1] - 30 + OY, { padre: "loro", mov: { gira: { amp: 0.14, periodo: 800 } } }));
  const ph = f.lienzo();
  cabezaLoro(ph);
  partes.push(f.parte("cabeza-loro", ph, LORO[0] + 2 + OX, LORO[1] - 38 + OY, { padre: "loro", mov: { gira: { amp: 0.1, periodo: 1900 } } }));
  partes.push(fila(f, "fila-medio", 20, [18, 36, 54, 100, 116], 5, 0.33));
  partes.push(fila(f, "fila-frente", 32, [16, 36, 58, 80, 102], 10, 0.66));

  // Los ojos (encima de todo), las pupilas que miran a la gente, los párpados y la boca que se abre.
  const po = f.lienzo();
  ojos(po);
  partes.push(f.parte("ojos", po, OJOS[0]![0] + OX, OJOS[0]![1] + OY, { padre: "carroceria" }));
  const pp = f.lienzo();
  pupilas(pp);
  partes.push(f.parte("pupilas", pp, OJOS[0]![0] + OX, OJOS[0]![1] + OY, { padre: "ojos", contorno: false, mov: { vaiven: { dx: 1.6, dy: 0.5, periodo: 3600 } } }));
  const pr = f.lienzo();
  parpados(pr);
  partes.push(f.parte("parpados", pr, OJOS[0]![0] + OX, OJOS[0]![1] + OY, { padre: "ojos", contorno: false, mov: { parpadeo: { cada: 3100, dura: 210 } } }));
  const pq = f.lienzo();
  quijada(pq);
  const [qx, qy] = T(BOCA_A.c, 8);
  partes.push(f.parte("quijada", pq, qx + OX, qy + OY, { padre: "carroceria", contorno: false, mov: { vaiven: { dy: 1.6, periodo: 1000 } } }));

  // El confeti que cae sobre la carroza.
  [
    [-30, -50],
    [10, -66],
    [50, -40],
    [96, -30],
    [130, -6],
  ].forEach(([x, y], k) => partes.push(confeti(f, `confeti-${k}`, x!, y!, k)));

  void [union, ci, el, cap];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}

export type { Ramp };
