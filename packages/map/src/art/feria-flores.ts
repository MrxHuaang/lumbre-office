// La Feria de las flores por código (VIR-161): el arco de flores, el exhibidor de silletas (vacío y con su
// silleta encima, que la escena pone como capa), la mesa del silletero, el puesto de las semillas, el farol
// de papel de colores, el poste con guirnaldas, el balde de flores y la silleta de adorno. Coordenadas
// locales de arte (tile = 16). Lo de enfrente mira a +y (hacia donde se para la gente, un tile al sur).
// Cálido y de primavera: madera, flores de todos los colores y papel; nada gris.
import { SILLETA, SILLETA_LETRAS, SILLETA_VACIA, type SilletaLetra } from "@hyvento/shared";
import { Escena, type Tinte } from "./exterior-escena";
import { C } from "./palette";
import { at, hex, noise, ramp, type Ramp, type RGBA, type Sprite } from "./pixel";

const scene = (w: number, d: number, h: number, pad = 6) => new Escena({ x0: -pad, y0: -pad, z0: -4, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const flatT = (c: RGBA): Tinte => () => c;

/** Las flores: de la sombra al brillo (0..5). */
const FLOR: Record<string, Ramp> = {
  clavel: ramp("#5a0c14", "#a01828", "#c82432", "#e0303c", "#f8687a", "#ffb0b8"),
  astromelia: ramp("#6a2a0c", "#b8501a", "#d86a22", "#f08a2a", "#ffb060", "#ffe0a8"),
  girasol: ramp("#6a4a0a", "#b8861a", "#e0aa22", "#f7c830", "#ffe070", "#fff6c0"),
  hortensia: ramp("#2a2a6a", "#4a4ab8", "#6a6ad8", "#7a8ae8", "#a8b0f4", "#dcdcff"),
};
const FLORES = Object.values(FLOR);
/** El centro de semillas del girasol. */
const SEMILLA = ramp("#2a1408", "#4a2a10", "#6a3a14", "#7a4a1a");
/** La madera clara de los marcos y los puestos (la de la cabaña). */
const WOOD = C.wood;
/** Papel de colores (guirnaldas, faroles, toldo). */
const PAPEL: RGBA[] = [hex("#e8457a"), hex("#f7c830"), hex("#5fb8e8"), hex("#7fc04e"), hex("#f08a2a"), hex("#b48ae0")];
const TOLDO = { a: ramp("#8a2048", "#c03060", "#e04a7a", "#f07aa0"), b: ramp("#b8a890", "#e0d4bc", "#f4ecdc", "#fffaf0") };

/** Una flor redonda (un domo que sale de la superficie hacia `n`): el tinte según la luz. */
function bloom(s: Escena, x: number, y: number, z: number, r: number, flor: Ramp, out: [number, number, number] = [0, 1, 0], center?: Ramp) {
  // Dos ejes del plano de la flor (perpendiculares a `out`).
  const u: [number, number, number] = out[2] ? [1, 0, 0] : [-out[1], out[0], 0];
  const v: [number, number, number] = out[2] ? [0, 1, 0] : [0, 0, 1];
  for (let a = -r; a <= r; a += 0.35)
    for (let b = -r; b <= r; b += 0.35) {
      const d2 = a * a + b * b;
      if (d2 > r * r) continue;
      const h = Math.sqrt(r * r - d2) * 0.75;
      const luz = (-a * u[0] - a * u[1] + b) / r + h / r;
      const c = center && d2 < r * r * 0.18 ? at(center, 2 + luz) : at(flor, 2.6 + luz * 1.3);
      s.plot(x + u[0] * a + v[0] * b + out[0] * h, y + u[1] * a + v[1] * b + out[1] * h, z + u[2] * a + v[2] * b + out[2] * h, c);
    }
}

/** Follaje: puntos verdes al azar alrededor de (x, y, z). */
function leaves(s: Escena, x: number, y: number, z: number, r: number, n: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const t = noise(i, 1, seed) * Math.PI * 2;
    const k = Math.sqrt(noise(i, 2, seed)) * r;
    const e = (noise(i, 3, seed) - 0.5) * r * 1.2;
    s.plot(x + Math.cos(t) * k, y + Math.sin(t) * k, z + e, at(C.leaf, 2 + noise(i, 4, seed) * 3));
  }
}

// ---------- La silleta ----------

/** El marco de la silleta en el exhibidor: de x0 a lo largo de x, en el plano y = y0, desde z0 hacia arriba (y el tamaño de cada casilla). */
const PANEL = { x0: 1.5, y0: 8.5, z0: 12, cell: 3.25, frame: 1.2 };

/**
 * La silleta: el marco de madera de pie (mirando a +y) con una flor por casilla del código y follaje en
 * las vacías, el copete de hojas arriba y las correas atrás. `code` puede venir incompleto (la de la mesa
 * del silletero, a medio armar): lo que falta queda de tablitas.
 */
function silleta(s: Escena, code: string, opts: { slats?: boolean; x0?: number; y0?: number; z0?: number } = {}) {
  const { cell, frame } = PANEL;
  const { x0 = PANEL.x0, y0 = PANEL.y0, z0 = PANEL.z0 } = opts;
  const w = SILLETA.cols * cell;
  const h = SILLETA.rows * cell;
  // El tablero de atrás y el marco.
  s.box(x0 - frame, y0 - 1.6, z0 - frame, w + frame * 2, 1.6, h + frame * 2, flatT(at(WOOD, 4)), (u, v) => at(WOOD, (u < frame || u > w + frame || v < frame || v > h + frame ? 3 : 2) + (noise(Math.floor(u), Math.floor(v / 2), 5) < 0.2 ? -1 : 0)), flatT(at(WOOD, 2)));
  for (let r = 0; r < SILLETA.rows; r++)
    for (let c = 0; c < SILLETA.cols; c++) {
      const ch = code[r * SILLETA.cols + c] ?? SILLETA_VACIA;
      const cx = x0 + c * cell + cell / 2;
      const cz = z0 + (SILLETA.rows - 1 - r) * cell + cell / 2;
      const flower = SILLETA_LETRAS[ch as SilletaLetra];
      if (flower) bloom(s, cx, y0, cz, cell * 0.55, FLOR[flower]!, [0, 1, 0], flower === "girasol" ? SEMILLA : undefined);
      else if (opts.slats) for (let k = -1.2; k <= 1.2; k += 0.4) s.plot(cx + k, y0 + 0.1, cz + (k > 0 ? 0.6 : -0.6), at(WOOD, 3));
      else leaves(s, cx, y0 + 0.6, cz, cell * 0.5, 22, r * 7 + c);
    }
  // El copete: un arco de hojas y florcitas encima del marco.
  for (let t = 0; t <= 1; t += 0.04) {
    const x = x0 + t * w;
    const z = z0 + h + frame + Math.sin(t * Math.PI) * 3.2;
    leaves(s, x, y0 - 0.2, z, 1.2, 3, Math.round(t * 100));
    if (Math.round(t * 25) % 4 === 0) bloom(s, x, y0 + 0.4, z + 0.8, 0.9, FLORES[Math.round(t * 25) % FLORES.length]!);
  }
}

/** El exhibidor: la tarimita de tablas y los dos parales que sostienen la silleta (o el marco vacío). */
function stand(s: Escena) {
  s.roundShadow(8, 9, 7, 0.24);
  s.box(1, 4, 0, 14, 9, 2.4, (u, v) => at(WOOD, 4 - (Math.floor(u / 3.5) % 2) * 0.6 - (noise(Math.floor(u), Math.floor(v), 2) < 0.15 ? 1 : 0)), flatT(at(WOOD, 2)), flatT(at(WOOD, 1)));
  for (const x of [1.4, 13.6]) s.solid(x, 6.4, 2.4, 1.6, 1.6, 22, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  // La plaquita del frente (sin letras: el nombre lo dice el panel).
  s.box(5.5, 12.8, 0.6, 5, 0.6, 1.6, null, flatT(at(C.cream, 3)), null);
}

/** El exhibidor vacío: el marco con sus tablitas, esperando una silleta. */
function silletaStand(): Sprite {
  const s = scene(1, 1, 44);
  stand(s);
  silleta(s, "", { slats: true });
  return s.sprite();
}

/**
 * El exhibidor con una silleta (la capa que la escena pone encima del exhibidor vacío, para todos). Mismo
 * marco que el mueble: se calza con su origen.
 */
export function silletaOnStand(code: string): Sprite {
  const s = scene(1, 1, 44);
  stand(s);
  silleta(s, code);
  return s.sprite();
}

/** Las silletas de adorno de la plaza (no se votan): una de colores y otra de hortensias. */
const DECOR_SILLETA = "cagh" + "hgac" + "cagh";

// ---------- El arco de flores ----------

/**
 * Arco de flores sobre el camino (5 tiles a lo largo de x; se pasa por los tres del medio, a lo largo de y):
 * dos parales enredados de flores y la curva de follaje cuajada de claveles, girasoles, hortensias y
 * astromelias.
 */
function flowerArch(): Sprite {
  const s = scene(5, 1, 70, 8);
  const yc = 8;
  for (const xc of [8, 72]) {
    s.roundShadow(xc, yc + 1, 4, 0.26);
    s.solid(xc - 1.6, yc - 1.6, 0, 3.2, 3.2, 40, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
    // La enredadera que sube por el paral.
    for (let z = 2; z < 40; z += 1.1) {
      const t = z * 0.7;
      leaves(s, xc + Math.cos(t) * 2, yc + Math.sin(t) * 2, z, 1.2, 4, Math.round(z * 10) + xc);
      if (Math.round(z) % 6 === 0) bloom(s, xc + 1.6, yc + 2, z, 1.1, FLORES[(Math.round(z) / 6 + xc) % FLORES.length]!);
    }
  }
  // La curva: de un paral al otro, con su copete en la mitad.
  for (let t = 0; t <= 1; t += 0.008) {
    const x = 8 + t * 64;
    const z = 39 + Math.sin(t * Math.PI) * 18;
    for (let k = 0; k < 5; k++) {
      const a = noise(Math.round(t * 999), k, 3) * Math.PI * 2;
      const r = 2.6 * Math.sqrt(noise(Math.round(t * 999), k, 4));
      s.plot(x, yc + Math.cos(a) * r, z + Math.sin(a) * r, at(C.leaf, 2 + (Math.sin(a) > 0 ? 2 : 1) + (noise(k, Math.round(t * 999), 6) < 0.3 ? 1 : 0)));
    }
  }
  for (let t = 0.02; t <= 0.98; t += 0.045) {
    const x = 8 + t * 64;
    const z = 39 + Math.sin(t * Math.PI) * 18;
    const i = Math.round(t * 1000);
    bloom(s, x, yc + 2.2, z + (noise(i, 1, 9) - 0.5) * 2.4, 1.3 + noise(i, 2, 9) * 0.5, FLORES[i % FLORES.length]!, [0, 1, 0], i % FLORES.length === 2 ? SEMILLA : undefined);
    if (i % 3 === 0) bloom(s, x, yc, z + 2.6, 1.1, FLORES[(i + 1) % FLORES.length]!, [0, 0, 1]);
  }
  // Las cintas de colores que cuelgan del medio.
  for (let k = 0; k < 6; k++) {
    const x = 30 + k * 4;
    const top = 39 + Math.sin(((x - 8) / 64) * Math.PI) * 18 - 2;
    for (let z = top; z > top - 6 - (k % 3) * 2; z -= 0.5) s.plot(x + Math.sin(z * 0.8) * 0.4, yc + 2.6, z, PAPEL[k % PAPEL.length]!);
  }
  return s.sprite();
}

// ---------- La mesa del silletero ----------

/** La mesa de trabajo: tablero con baldes de flores, ramitos sueltos y una silleta a medio armar. */
function silleteroTable(): Sprite {
  const s = scene(2, 1, 40);
  s.shadow(2, 4, 28, 10, 0.24);
  for (const [x, y] of [[3, 5], [28, 5], [3, 12], [28, 12]] as const) s.solid(x, y, 0, 1.4, 1.4, 11, at(WOOD, 3), at(WOOD, 2), at(WOOD, 1));
  s.box(2, 4, 11, 28, 10, 1.6, (u, v) => at(WOOD, 4 - (Math.floor(v / 2.5) % 2) * 0.5 - (noise(Math.floor(u / 2), Math.floor(v), 1) < 0.12 ? 1 : 0)), flatT(at(WOOD, 2)), flatT(at(WOOD, 2)));
  // La silleta a medio armar, apoyada atrás.
  silleta(s, "cg-hc-g--a--", { slats: true, x0: 4, y0: 6.2, z0: 15 });
  // Los baldes con flores y los ramitos sueltos sobre la mesa.
  for (const [x, flor] of [[21, "clavel"], [26, "girasol"]] as const) {
    s.cylinder(x, 9, 12.6, 2.2, 4, (_a, _v, luz) => at(C.terracotta, 2.5 + luz));
    s.disc(x, 9, 16.6, 2.2, () => at(C.terracotta, 1));
    for (let k = 0; k < 4; k++) bloom(s, x + Math.cos(k * 1.7) * 1.2, 9 + Math.sin(k * 1.7) * 1.2, 18 + k * 0.6, 1.1, FLOR[flor]!, [0, 0, 1], flor === "girasol" ? SEMILLA : undefined);
  }
  for (let k = 0; k < 3; k++) {
    const x = 20 + k * 3;
    for (let t = 0; t < 4; t += 0.4) s.plot(x + t * 0.5, 12.6 - t * 0.3, 12.8, at(C.leaf, 3));
    bloom(s, x + 2.4, 11.2, 13.2, 0.9, FLORES[k + 1]!, [0, 0, 1]);
  }
  return s.sprite();
}

// ---------- El puesto de las semillas ----------

/** El puesto con toldo a rayas: el mostrador de tablas con baldes de flores y los sobres de semillas. */
function flowerStall(): Sprite {
  const s = scene(2, 1, 50);
  s.shadow(1, 1, 30, 15, 0.22);
  // Los cuatro parales.
  for (const [x, y, h] of [[2, 2, 36], [29, 2, 36], [2, 14, 31], [29, 14, 31]] as const) s.solid(x, y, 0, 1.4, 1.4, h, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  // El mostrador: tablas verticales al frente y la tapa.
  s.box(3, 8, 0, 26, 6, 12, flatT(at(WOOD, 4)), (u, v) => at(WOOD, 3 - (Math.floor(u / 2.6) % 2) * 0.7 - (v > 10.5 ? -1 : 0)), flatT(at(WOOD, 1)));
  // Los baldes de flores sobre el mostrador (una flor por balde).
  ["clavel", "astromelia", "girasol", "hortensia"].forEach((f, i) => {
    const x = 6.5 + i * 6.2;
    s.cylinder(x, 11, 12, 2, 3.4, (_a, _v, luz) => at(C.terracotta, 2.5 + luz));
    for (let k = 0; k < 5; k++) bloom(s, x + Math.cos(k * 1.3) * 1.2, 11 + Math.sin(k * 1.3) * 1.2, 16.4 + (k % 2) * 0.8, 1, FLOR[f]!, [0, 0, 1], f === "girasol" ? SEMILLA : undefined);
  });
  // Los sobres de semillas colgados del travesaño de adelante.
  s.box(2, 14.2, 26, 28.4, 1, 1.2, flatT(at(C.woodDark, 4)), flatT(at(C.woodDark, 3)), null);
  ["clavel", "astromelia", "girasol", "hortensia"].forEach((f, i) => {
    const x = 7 + i * 6;
    s.box(x, 14.6, 21.6, 3, 0.4, 4, null, (u, v) => (v > 1.2 && v < 2.8 && u > 0.8 && u < 2.2 ? at(FLOR[f]!, 3) : at(C.cream, v > 3.4 ? 2 : 4)), null);
  });
  // El toldo a rayas, de atrás (alto) hacia adelante (más bajo), con el borde de ondas.
  s.quad([1, 1, 37.4], [1, 0, 0], [0, 1, -0.38], 30.4, 15.4, (u) => at(Math.floor(u / 3.8) % 2 ? TOLDO.b : TOLDO.a, 3));
  for (let x = 1; x < 31.4; x += 0.4) {
    const drop = 1.2 + Math.abs(Math.sin((x / 3.8) * Math.PI)) * 1.4;
    for (let z = 0; z < drop; z += 0.4) s.plot(x, 16.4, 31.6 - z, at(Math.floor((x - 1) / 3.8) % 2 ? TOLDO.b : TOLDO.a, 2));
  }
  return s.sprite();
}

// ---------- Farol, guirnaldas, balde y la silleta de adorno ----------

/** Esfera de papel (el farol) con aros, de día de colores y de noche prendida. */
function paperBall(s: Escena, cx: number, cy: number, cz: number, r: number, rz: number, col: RGBA, night: boolean) {
  const glow = [hex("#ff9a2a"), hex("#ffc94a"), hex("#fff0a0")];
  for (let e = -Math.PI / 2; e <= Math.PI / 2; e += 0.09)
    for (let a = -Math.PI; a < Math.PI; a += 0.09) {
      const nx = Math.cos(a) * Math.cos(e);
      const ny = Math.sin(a) * Math.cos(e);
      const luz = ny * 0.5 - nx * 0.3 + Math.sin(e) * 0.7;
      const ring = Math.abs(((Math.sin(e) * 5 + 10) % 2) - 1) > 0.8;
      const day: RGBA = luz > 0.3 ? [Math.min(255, col[0] + 40), Math.min(255, col[1] + 40), Math.min(255, col[2] + 40), 255] : luz < -0.3 ? [Math.round(col[0] * 0.7), Math.round(col[1] * 0.7), Math.round(col[2] * 0.7), 255] : col;
      s.plot(cx + nx * r, cy + ny * r, cz + Math.sin(e) * rz, night ? glow[ring ? 0 : luz > 0 ? 2 : 1]! : ring ? at(WOOD, 1) : day);
    }
}

/** Farol de papel de colores colgado de su poste (el farol hacia +x), prendido de noche. */
function feriaLantern(night: boolean): Sprite {
  const s = scene(1, 1, 46);
  s.roundShadow(4, 8.5, 2.6, 0.26);
  s.solid(3, 7.2, 0, 1.8, 1.8, 36, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  s.box(3, 7.4, 34.5, 10, 1.4, 1.4, flatT(at(C.woodDark, 4)), flatT(at(C.woodDark, 3)), flatT(at(C.woodDark, 2)));
  for (let z = 30.6; z < 34.6; z += 0.4) s.plot(11.5, 8.1, z, at(C.woodDark, 1));
  paperBall(s, 11.5, 8.1, 25.4, 4, 4.4, PAPEL[0]!, night);
  // Las tiritas de colores de abajo.
  for (let k = 0; k < 4; k++) for (let z = 17; z < 21; z += 0.5) s.plot(10 + k, 9 - k * 0.3, z - (k % 2), PAPEL[(k + 1) % PAPEL.length]!);
  return s.sprite();
}

/** Poste alto con guirnaldas de banderitas de papel que caen en arcos hacia los cuatro lados. */
function garlandPole(): Sprite {
  const s = scene(1, 1, 56, 10);
  s.roundShadow(8, 8.5, 3, 0.26);
  s.solid(7.2, 7.2, 0, 1.6, 1.6, 50, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  bloom(s, 8, 8, 51, 1.6, FLOR.girasol!, [0, 0, 1], SEMILLA);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const L = 9;
    for (let t = 0; t <= 1; t += 0.02) {
      const x = 8 + Math.cos(a) * L * t;
      const y = 8 + Math.sin(a) * L * t;
      const z = 49 - t * 16 + Math.sin(t * Math.PI) * -4;
      s.plot(x, y, z, at(C.cream, 2));
      // Las banderitas: triangulitos que cuelgan del cordel.
      if (Math.round(t * 50) % 6 === 3) for (let d = 0; d < 2.4; d += 0.4) for (let w = -1 + d * 0.4; w <= 1 - d * 0.4; w += 0.4) s.plot(x - Math.sin(a) * w, y + Math.cos(a) * w, z - d - 0.3, PAPEL[(k + Math.round(t * 50)) % PAPEL.length]!);
    }
  }
  return s.sprite();
}

/** Balde de barro con un montón de flores revueltas. */
function flowerBucket(): Sprite {
  const s = scene(1, 1, 22);
  s.roundShadow(8, 8.5, 5, 0.26);
  s.cylinder(8, 8, 0, 4.2, 7, (_a, v, luz) => at(C.terracotta, 2.4 + luz + (v > 6 ? 1 : 0)));
  s.disc(8, 8, 7, 4.2, () => at(C.terracotta, 1));
  leaves(s, 8, 8, 9, 4, 70, 4);
  for (let k = 0; k < 9; k++) {
    const t = noise(k, 1, 8) * Math.PI * 2;
    const r = Math.sqrt(noise(k, 2, 8)) * 3.4;
    const f = k % FLORES.length;
    bloom(s, 8 + Math.cos(t) * r, 8 + Math.sin(t) * r, 10.5 + noise(k, 3, 8) * 3, 1.3, FLORES[f]!, [0, 0, 1], f === 2 ? SEMILLA : undefined);
  }
  return s.sprite();
}

/** Lo que no cambia de noche (va en DRAW de furniture.ts). */
export const FERIA_DRAW: Record<string, () => Sprite> = {
  "flower-arch": flowerArch,
  "silleta-stand": silletaStand,
  "silleta-decor": () => silletaOnStand(DECOR_SILLETA),
  "silletero-table": silleteroTable,
  "flower-stall": flowerStall,
  "garland-pole": garlandPole,
  "flower-bucket": flowerBucket,
};

/** Lo que se prende de noche (va en OUTDOOR de outdoor.ts). */
export const FERIA_NIGHT: Record<string, (night: boolean) => Sprite> = {
  "feria-lantern": feriaLantern,
};
