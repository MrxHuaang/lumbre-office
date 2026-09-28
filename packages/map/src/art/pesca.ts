// El puesto de pesca de la orilla del lago, por código: la caseta de tablas con techito de lona a rayas,
// cañas colgadas y el letrero "PESCA"; el mostrador con el balde de lombrices y el frasco de la carnada
// buena; las cañas paradas en su soporte y la nevera de icopor. Coordenadas locales de arte (tile = 16),
// mirando al lago (+x); todo es fijo. Estética de la cabaña: madera cálida, lona crema y roja, nada gris.
import { Escena, type Tinte } from "./exterior-escena";
import { C, mix } from "./palette";
import { at, hex, noise, type Ramp, type RGBA, type Sprite } from "./pixel";
import { glyphOn } from "./room";

const scene = (w: number, d: number, h: number, pad = 8) => new Escena({ x0: -pad, y0: -pad, z0: -2, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const flatT = (c: RGBA): Tinte => () => c;

/** Tablas verticales (juntas cada `pitch` a lo largo de u), con tono por tabla y alguna veta. */
const boards =
  (r: Ramp, base = 4, pitch = 4, seed = 1): Tinte =>
  (u, v) => {
    if (u % pitch < 0.7) return at(r, base - 2);
    const n = noise(Math.floor(u / pitch), 0, seed);
    if (noise(Math.floor(u), Math.floor(v / 3), seed + 7) > 0.93) return at(r, base - 1);
    return at(r, base + (n < 0.35 ? -1 : n > 0.85 ? 1 : 0));
  };

/** Colores de cada caña (de la familia de ROD_COLORS_BY en fish.ts, un poco más claros para el dibujo chico). */
export const PESCA_ROD_TONES = {
  bambu: { rod: hex("#c9a25a"), ring: hex("#8a6a34"), grip: hex("#a65132") },
  fibra: { rod: hex("#4f9a6a"), ring: hex("#2e6a48"), grip: hex("#e6d0a6") },
  carbono: { rod: hex("#34447c"), ring: hex("#f3d672"), grip: hex("#7a3a25") },
} as const;
type RodTone = (typeof PESCA_ROD_TONES)[keyof typeof PESCA_ROD_TONES];

/** Una caña en línea recta de `a` a `b` (mundo), con anillos cada tanto, el mango y el carrete. */
function rodLine(s: Escena, a: [number, number, number], b: [number, number, number], tone: RodTone, bamboo = false) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  for (let t = 0; t <= len; t += 0.35) {
    const k = t / len;
    const x = a[0] + (b[0] - a[0]) * k;
    const y = a[1] + (b[1] - a[1]) * k;
    const z = a[2] + (b[2] - a[2]) * k;
    const grip = t < 4;
    // El bambú lleva sus nudos; las otras, anillos de guía.
    const ring = bamboo ? t % 5 < 0.5 : t > 6 && t % 6 < 0.45;
    s.plot(x, y, z, grip ? tone.grip : ring ? tone.ring : tone.rod);
  }
  // El carrete, un poquito arriba del mango.
  const k = 5 / len;
  const cx = a[0] + (b[0] - a[0]) * k;
  const cy = a[1] + (b[1] - a[1]) * k;
  const cz = a[2] + (b[2] - a[2]) * k;
  s.box(cx - 0.3, cy - 0.9, cz - 0.9, 1.4, 1.8, 1.8, flatT(at(C.gold, 4)), flatT(at(C.gold, 3)), flatT(at(C.gold, 2)));
}

/** Lona a rayas crema y roja, con las rayas a lo largo de `u`. */
const canvasStripes =
  (luz = 0): Tinte =>
  (u, v) => {
    const band = Math.floor(u / 4) % 2;
    const base = band ? at(C.rug, 3 + luz) : at(C.cream, 4 + luz);
    // Un pliegue suave cada tanto a lo largo de la caída.
    if (v % 9 < 0.6) return band ? at(C.rug, 2 + luz) : at(C.cream, 3 + luz);
    return base;
  };

/** Farolito de madera con vidrio dorado (cálido, nada de fierro gris). */
function woodLantern(s: Escena, x: number, y: number, z: number) {
  const glass = (u: number, v: number) => (u < 0.7 || u > 2.3 || v < 0.6 ? at(C.woodDark, 2) : at(C.gold, v > 2.2 ? 5 : 4));
  s.box(x - 1.5, y - 1.5, z, 3, 3, 3.6, flatT(at(C.woodDark, 3)), glass, (u, v) => (u < 0.7 || u > 2.3 ? at(C.woodDark, 1) : at(C.gold, v > 2.2 ? 4 : 3)));
  s.solid(x - 2, y - 2, z + 3.6, 4, 4, 1, at(C.woodDark, 4), at(C.woodDark, 2), at(C.woodDark, 1));
  for (let dz = 0; dz < 3; dz += 0.4) s.plot(x, y, z + 4.6 + dz, at(C.cork, 2));
}

// ---------- La caseta ----------

/**
 * La caseta (2x3): cuarto de tablas con la puertica atrás de Don Evelio, cañas colgadas y un salvavidas;
 * techo de lona a rayas a un agua que sale hacia el frente (sobre él, con tornapuntas de palo) y, arriba,
 * el letrero "PESCA" en una tabla.
 */
function caseta(): Sprite {
  const s = scene(2, 3, 70, 10);
  const X0 = 3, X1 = 24, Y0 = 4, Y1 = 44, H = 28;
  s.shadow(X0 - 1, Y0 - 1, X1 - X0 + 20, Y1 - Y0 + 4, 0.26);
  // Basas de piedra de río (la caseta queda un poquito levantada del barro de la orilla).
  for (const [x, y] of [
    [X0, Y0],
    [X1 - 3, Y0],
    [X0, Y1 - 3],
    [X1 - 3, Y1 - 3],
  ] as const)
    s.solid(x, y, 0, 3, 3, 2, at(C.stone, 4), at(C.stone, 3), at(C.stone, 2));
  // Paredes de tablas: el costado (+y) con el salvavidas y el frente (+x) con la puertica y las cañas.
  const side = boards(C.wood, 4, 4, 3);
  const front = boards(C.wood, 4, 4, 5);
  s.box(X0, Y0, 2, X1 - X0, Y1 - Y0, H, flatT(at(C.wood, 3)), side, (u, v) => {
    // La puertica (entreabierta: adentro oscuro cálido) justo detrás de donde se para Don Evelio.
    const du = u - (Y1 - Y0) / 2;
    if (Math.abs(du) < 5.5 && v < 21) return Math.abs(du) > 4.6 || v > 20 ? at(C.woodDark, 2) : du > 1.5 ? at(C.woodDark, 3) : at(C.woodDark, 1);
    // La ventanita de atender del lado de las cañas, con su tablita.
    if (u > 4 && u < 11 && v > 12 && v < 20) return u < 4.8 || u > 10.2 || v < 12.8 || v > 19.2 ? at(C.cream, 4) : at(C.woodDark, 1);
    return front(u, v);
  });
  // Remates claros en las esquinas.
  s.solid(X1 - 1.2, Y1 - 1.2, 2, 1.6, 1.6, H + 0.5, at(C.cream, 5), at(C.cream, 4), at(C.cream, 3));
  s.solid(X1 - 1.2, Y0 - 0.4, 2, 1.6, 1.6, H + 0.5, at(C.cream, 5), at(C.cream, 4), at(C.cream, 3));
  // Salvavidas rojo y crema colgado en el costado.
  {
    const cx = (X0 + X1) / 2;
    const cz = 16;
    for (let a = 0; a < Math.PI * 2; a += 0.05)
      for (let r = 3.2; r <= 5.4; r += 0.35) {
        const seg = Math.floor(((a + 0.4) / (Math.PI * 2)) * 8) % 2;
        s.plot(cx + Math.cos(a) * r, Y1 + 0.5, cz + Math.sin(a) * r, seg ? at(C.rug, 3) : at(C.cream, 5));
      }
    for (let z = cz + 5; z < cz + 9; z += 0.4) s.plot(cx, Y1 + 0.5, z, at(C.cork, 2));
  }
  // Cañas colgadas en el frente, a la izquierda de la puerta (se ven sobre la nevera).
  const FX = X1 + 0.5;
  rodLine(s, [FX, Y1 - 2, 6], [FX, Y1 - 9, 26], PESCA_ROD_TONES.bambu, true);
  rodLine(s, [FX, Y1 - 5, 5], [FX, Y1 - 12, 25], PESCA_ROD_TONES.fibra);
  // Un pescado de madera pintado sobre la ventanita.
  for (let u = -4; u <= 4; u += 0.35)
    for (let v = -1.6; v <= 1.6; v += 0.35) {
      const body = (u * u) / 16 + (v * v) / 2.6 <= 1;
      const tail = u > 3.2 && u < 5.6 && Math.abs(v) < (u - 3.2) * 0.9;
      if (body || tail) s.plot(FX, Y0 + 7.5 - u, 23.5 + v, Math.abs(u + 2.4) < 0.5 && v > 0.2 ? at(C.woodDark, 1) : body ? at(C.sky, 1) : at(C.sky, 0));
    }
  // Techo de lona a un agua: alto atrás, bajo adelante, saliendo sobre Don Evelio.
  const zBack = H + 18, zFront = H + 9, xBack = X0 - 3, xFront = 40;
  const slope = (zBack - zFront) / (xFront - xBack);
  const k = Math.hypot(1, slope);
  s.quad([xBack, Y0 - 3, zBack], [0, 1, 0], [1, 0, -slope], Y1 - Y0 + 6, xFront - xBack, (u, v) => canvasStripes(noise(Math.floor(u / 4), 1, 9) < 0.2 ? -1 : 0)(u, v * k));
  // El faldón con piquitos en el borde de adelante.
  s.quad([xFront, Y0 - 3, zFront], [0, 1, 0], [0, 0, -1], Y1 - Y0 + 6, 4, (u, v) => {
    const tip = 2.6 + Math.abs(((u % 4) - 2) / 2) * -1.4;
    if (v > tip + 1.2) return null;
    return canvasStripes(-1)(u, 0);
  });
  // El palo del borde y las tornapuntas que sostienen el techito desde la pared.
  s.box(xFront - 1, Y0 - 3, zFront - 1, 1.2, Y1 - Y0 + 6, 1.2, flatT(at(C.logs, 4)), flatT(at(C.logs, 3)), flatT(at(C.logs, 2)));
  for (const y of [Y0 + 1, Y1 - 1])
    for (let t = 0; t <= 1; t += 0.03) s.plot(X1 + 0.6 + (xFront - 1 - X1) * t, y, 18 + (zFront - 1.5 - 18) * t, at(C.logs, 3));
  // Farolito colgado en la esquina del frente (de noche alumbra el mostrador).
  for (let z = zFront - 5; z < zFront; z += 0.4) s.plot(X1 + 3, Y0 + 1, z, at(C.cork, 2));
  woodLantern(s, X1 + 3, Y0 + 1, zFront - 10);
  // El letrero: tabla sobre dos palitos, parada encima del techo, con "PESCA" en letras claras.
  const SX = X0 + 2, SZ = zBack + 3, SW = 34, SH = 11, SY1 = (Y0 + Y1) / 2 + SW / 2;
  for (const y of [SY1 - 6, SY1 - SW + 6]) s.box(SX - 0.5, y - 0.6, zBack - 3, 1.2, 1.2, SZ - zBack + 5, flatT(at(C.logs, 4)), flatT(at(C.logs, 3)), flatT(at(C.logs, 2)));
  const TEXT = "PESCA";
  const px = 1.4;
  const tw = (TEXT.length * 4 - 1) * px;
  s.quad([SX + 0.8, SY1, SZ], [0, -1, 0], [0, 0, 1], SW, SH, (u, v) => {
    if (u < 1 || u > SW - 1 || v < 1 || v > SH - 1) return at(C.woodDark, 3);
    const gx = Math.floor((u - (SW - tw) / 2) / px);
    const gy = Math.floor((SH - 1.8 - v) / px);
    if (gx >= 0 && gy >= 0 && gy < 5) {
      const ch = TEXT[Math.floor(gx / 4)];
      if (ch && gx % 4 < 3 && glyphOn(ch, gx % 4, gy)) return at(C.cream, 5);
    }
    return noise(Math.floor(u / 3), Math.floor(v / 5), 4) < 0.3 ? at(C.wood, 2) : at(C.wood, 3);
  });
  s.box(SX, SY1 - SW, SZ, 0.8, SW, SH, flatT(at(C.wood, 3)), flatT(at(C.woodDark, 2)), null);
  return s.sprite();
}

// ---------- El mostrador ----------

/**
 * Mostrador de tablas (1x3) con un pescado pintado al frente; encima, el balde de lombrices, el frasco de
 * la carnada buena y la caja de aparejos abierta con señuelos de colores.
 */
function mostrador(): Sprite {
  const s = scene(1, 3, 28, 8);
  const X0 = 2, X1 = 14, Y0 = 1, Y1 = 47, H = 12;
  s.shadow(X0, Y0, X1 - X0 + 2, Y1 - Y0 + 1, 0.26);
  s.box(X0, Y0, 0, X1 - X0, Y1 - Y0, H, flatT(at(C.wood, 3)), boards(C.wood, 3, 4, 8), (u, v) => {
    // Un pescado dorado pintado en el medio del frente y un zócalo más oscuro.
    const du = u - (Y1 - Y0) / 2;
    const dv = v - 6.5;
    const body = (du * du) / 30 + (dv * dv) / 5 <= 1;
    const tail = du < -4.8 && du > -8.5 && Math.abs(dv) < (-4.8 - du) * 0.8;
    if (body || tail) return du > 3 && du < 3.9 && dv > 0.3 && dv < 1.3 ? at(C.woodDark, 1) : at(C.mustard, body ? 4 : 3);
    if (v < 2) return at(C.woodDark, 3);
    return boards(C.wood, 4, 4, 9)(u, v);
  });
  // La tabla de encima, que sobresale un poco.
  s.box(X0 - 1, Y0 - 0.8, H, X1 - X0 + 2.5, Y1 - Y0 + 1.6, 1.6, (u, v) => (v % 6 < 0.5 ? at(C.wood, 3) : at(C.wood, 5)), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  const TOP = H + 1.6;
  // Balde rojo con tierra negra y lombrices rosadas.
  s.cylinder(8, 9, TOP, 3.4, 5.5, (_a, v, luz) => (v > 4.8 ? at(C.rug, 4) : at(C.rug, luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2)));
  s.disc(8, 9, TOP + 5.5, 3.1, (dx, dy) => {
    if (Math.hypot(dx, dy) > 2.8) return at(C.rug, 2);
    const worm = Math.abs(Math.sin(dx * 1.6 + dy * 0.7) * 1.2 - dy) < 0.35 && Math.abs(dx) < 2.2;
    return worm ? at(C.rose, 4) : at(C.dirt, noise(Math.floor(dx * 2 + 9), Math.floor(dy * 2 + 9), 3) < 0.3 ? 2 : 1);
  });
  for (let a = 0; a <= Math.PI; a += 0.08) s.plot(8 + Math.cos(a) * 3.4, 9, TOP + 5.5 + Math.sin(a) * 3, at(C.woodDark, 2));
  // El frasco de la carnada buena: vidrio con camarones naranja y la tapa dorada.
  s.cylinder(7.5, 22, TOP, 2.3, 5, (a, v, luz) => {
    const shrimp = noise(Math.floor(a * 4), Math.floor(v * 1.4), 6) < 0.55 && v < 4.2;
    return shrimp ? at(C.terracotta, luz > 0 ? 4 : 3) : mix(at(C.sky, 3), at(C.cream, 5), luz > 0.4 ? 0.6 : 0.25);
  });
  s.cylinder(7.5, 22, TOP + 5, 2.4, 1.2, (_a, _v, luz) => at(C.gold, luz > 0 ? 4 : 3));
  s.disc(7.5, 22, TOP + 6.2, 2.4, () => at(C.gold, 5));
  // La caja de aparejos verde, cerrada y bajita (queda delante de Don Evelio: no le tapa la cara), con
  // el broche dorado y un señuelo rojo colgando del borde.
  const BX = 4, BY = 35, BW = 8, BD = 10;
  s.box(BX, BY, TOP, BW, BD, 3, (u, v) => (Math.abs(v - BD / 2) < 0.5 ? at(C.green, 2) : at(C.green, 4)), flatT(at(C.green, 3)), (u, v) =>
    Math.abs(u - BD / 2) < 1 && v > 1 && v < 2.4 ? at(C.gold, 4) : at(C.green, 2),
  );
  s.solid(BX + BW, BY + 2, TOP + 0.6, 0.8, 1.6, 1.4, at(C.rug, 4), at(C.rug, 3), at(C.rug, 2));
  return s.sprite();
}

// ---------- Las cañas en su soporte ----------

/** Soporte de tablas con tres cañas paradas (bambú, fibra y carbono) y la nasa de aro rojo. */
function canas(): Sprite {
  const s = scene(1, 1, 50, 8);
  s.shadow(2, 2, 13, 13, 0.25);
  // La base: una tabla gruesa con tres huecos, y el travesaño de arriba.
  s.box(3, 2, 0, 9, 12, 3, (u, v) => ([3, 6, 9].some((y) => Math.hypot(u - 4.5, v - y) < 1) ? at(C.woodDark, 1) : at(C.wood, 4)), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  for (const y of [2.5, 12.5]) s.box(3.2, y - 0.6, 3, 1.2, 1.2, 22, flatT(at(C.logs, 4)), flatT(at(C.logs, 3)), flatT(at(C.logs, 2)));
  s.box(2.8, 1.6, 25, 1.6, 11.8, 1.4, flatT(at(C.logs, 5)), flatT(at(C.logs, 3)), flatT(at(C.logs, 2)));
  // Las cañas, un poco recostadas hacia atrás contra el travesaño.
  rodLine(s, [7.5, 5, 2], [2.5, 4.2, 44], PESCA_ROD_TONES.bambu, true);
  rodLine(s, [7.5, 8, 2], [2.8, 8.6, 46], PESCA_ROD_TONES.fibra);
  rodLine(s, [7.5, 11, 2], [2.5, 12.2, 45], PESCA_ROD_TONES.carbono);
  // La nasa: mango de palo y aro rojo con la red crema, recostada al lado.
  for (let t = 0; t <= 1; t += 0.03) s.plot(12 + t * 1.5, 13 - t * 0.5, 1 + t * 16, at(C.logs, 3));
  for (let a = 0; a < Math.PI * 2; a += 0.06) {
    const x = 13.6;
    const y = 12.4 + Math.cos(a) * 3.2;
    const z = 21 + Math.sin(a) * 3.6;
    s.plot(x, y, z, at(C.rug, 3));
  }
  for (let y = -2.6; y <= 2.6; y += 0.9) for (let z = -3; z <= 3; z += 0.9) if ((y * y) / 9 + (z * z) / 12 < 0.9) s.plot(13.4, 12.4 + y, 21 + z, at(C.cream, 3));
  return s.sprite();
}

// ---------- La nevera de icopor ----------

/** Icopor: blanco cálido con las bolitas que se notan de cerca. */
const icopor =
  (base: number): Tinte =>
  (u, v) =>
    noise(Math.floor(u * 1.5), Math.floor(v * 1.5), 12) < 0.12 ? at(C.cream, base - 1) : at(C.cream, base);

/** La nevera de icopor con su tapa y, asomándose, la cola de un pescado y unos hielos. */
function nevera(): Sprite {
  const s = scene(1, 1, 22, 8);
  s.shadow(2, 3, 13, 11, 0.26);
  s.box(2.5, 3.5, 0, 11, 9, 9, icopor(5), icopor(4), icopor(3));
  // La tapa, un poquito corrida (por ahí se asoma el pescado).
  s.box(2, 3, 9, 11, 10, 2, icopor(5), icopor(4), icopor(3));
  // Una franja azul cielo pintada alrededor (la de todas las neveras de paseo).
  s.quad([2.5, 12.5, 4], [1, 0, 0], [0, 0, 1], 11, 1.4, () => at(C.sky, 1));
  s.quad([13.5, 3.5, 4], [0, 1, 0], [0, 0, 1], 9, 1.4, () => at(C.sky, 0));
  // La cola del pescado y dos hielos que se salieron.
  for (let t = 0; t < 4; t += 0.3)
    for (let w = -t * 0.55; w <= t * 0.55; w += 0.3) s.plot(13.6 + t * 0.35, 6 + w, 11 + t * 0.5, t > 3.2 ? at(C.rose, 3) : at(C.sky, 2));
  s.solid(12, 13.2, 0, 1.8, 1.8, 1.6, at(C.sky, 4), at(C.sky, 3), at(C.sky, 2));
  s.solid(9.5, 14, 0, 1.4, 1.4, 1.2, at(C.sky, 4), at(C.sky, 3), at(C.sky, 2));
  return s.sprite();
}

export const PESCA_DRAW: Record<string, () => Sprite> = {
  "pesca-caseta": caseta,
  "pesca-mostrador": mostrador,
  "pesca-canas": canas,
  "pesca-nevera": nevera,
};
