// Amor y amistad por código (VIR-162): el cofre del amigo secreto, el puesto de chocolates y flores, la
// banca de los enamorados con su arco de corazón, el farol rosado (un corazón de papel que de noche se
// prende), la guirnalda de corazones, el arco de flores del patio y los globos de corazón. Coordenadas
// locales de arte (tile = 16). Lo de enfrente mira a +y, donde se para la gente. Cálido y de primavera:
// madera, rosas, papel rojo, rosado y blanco; nada gris.
import { Escena, type Tinte } from "./exterior-escena";
import { C } from "./palette";
import { at, hex, noise, ramp, type Ramp, type RGBA, type Sprite } from "./pixel";

const scene = (w: number, d: number, h: number, pad = 6) => new Escena({ x0: -pad, y0: -pad, z0: -4, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const flatT = (c: RGBA): Tinte => () => c;

/** Los colores de la fiesta: rojo de rosa, rosado de papel y blanco crema. */
const ROJO = ramp("#4a0c18", "#7a1428", "#a81e34", "#d0304a", "#ec5a72", "#ffa0b0");
const ROSADO = ramp("#6a2040", "#a03a64", "#d0547a", "#e87a9a", "#f4a8c0", "#ffd8e6");
const BLANCO = ramp("#a8896a", "#cdb08a", "#e6d0a6", "#f7ebc8", "#fffaf0", "#ffffff");
const PAPELES: Ramp[] = [ROJO, ROSADO, BLANCO];
const WOOD = C.wood;

/**
 * ¿(u, v) cae dentro de un corazón de radio 1? (u a lo ancho, v hacia arriba; la punta abajo). Devuelve
 * cuánto adentro (0 en el borde) o null si cae afuera.
 */
function enCorazon(u: number, v: number): number | null {
  const x = u * 1.15;
  const y = v * 1.15 + 0.15;
  const f = (x * x + y * y - 1) ** 3 - x * x * y ** 3;
  return f <= 0 ? Math.min(1, -f * 6) : null;
}

/**
 * Un corazón de pie en el plano xz (mirando a +y), de radio `r` y centrado en (cx, cz), a la altura y = cy.
 * Con `bulto` se infla hacia +y (los globos y el farol). `borde`: solo el contorno (un corazón de rosas).
 */
function corazon(s: Escena, cx: number, cy: number, cz: number, r: number, col: Ramp, opts: { bulto?: number; borde?: number; brillo?: boolean } = {}) {
  for (let u = -1.1; u <= 1.1; u += 0.32 / r)
    for (let v = -1.1; v <= 1.1; v += 0.32 / r) {
      const k = enCorazon(u, v);
      if (k === null) continue;
      if (opts.borde && k > opts.borde) continue;
      const luz = -u * 0.6 + v * 0.7;
      const h = opts.bulto ? Math.sqrt(k) * opts.bulto : 0;
      const c = opts.brillo && u < -0.3 && u > -0.6 && v > 0.15 && v < 0.45 ? at(col, 5) : at(col, 2.6 + luz * 1.2 + (opts.bulto ? Math.sqrt(k) * 0.6 : 0));
      s.plot(cx + u * r, cy + h, cz + v * r, c);
    }
}

/** Una rosa: un domo apretado con el pliegue de los pétalos (vista hacia `out`). */
function rosa(s: Escena, x: number, y: number, z: number, r: number, col: Ramp, out: [number, number, number] = [0, 1, 0]) {
  const u: [number, number, number] = out[2] ? [1, 0, 0] : [-out[1], out[0], 0];
  const v: [number, number, number] = out[2] ? [0, 1, 0] : [0, 0, 1];
  for (let a = -r; a <= r; a += 0.3)
    for (let b = -r; b <= r; b += 0.3) {
      const d2 = a * a + b * b;
      if (d2 > r * r) continue;
      const h = Math.sqrt(r * r - d2) * 0.8;
      // El espiral de los pétalos: anillos más oscuros que giran.
      const ang = Math.atan2(b, a) + Math.sqrt(d2) * 2.2;
      const pliegue = Math.sin(ang * 2) > 0.55 ? -1 : 0;
      const luz = (-a + b) / r;
      s.plot(x + u[0] * a + v[0] * b + out[0] * h, y + u[1] * a + v[1] * b + out[1] * h, z + u[2] * a + v[2] * b + out[2] * h, at(col, 3 + luz + pliegue));
    }
}

/** Follaje: puntos verdes al azar alrededor de (x, y, z). */
function hojas(s: Escena, x: number, y: number, z: number, r: number, n: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const t = noise(i, 1, seed) * Math.PI * 2;
    const k = Math.sqrt(noise(i, 2, seed)) * r;
    const e = (noise(i, 3, seed) - 0.5) * r * 1.2;
    s.plot(x + Math.cos(t) * k, y + Math.sin(t) * k, z + e, at(C.leaf, 2 + noise(i, 4, seed) * 3));
  }
}

/** Un poste de madera oscura. */
const poste = (s: Escena, x: number, y: number, h: number, w = 1.6) => s.solid(x - w / 2, y - w / 2, 0, w, w, h, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));

// ---------- El cofre del amigo secreto ----------

/**
 * El cofre: de madera con franjas rosadas, la tapa abombada con la ranura por donde se echan los papelitos,
 * el corazón rojo pintado al frente, la chapa dorada y un moño encima.
 */
function amigoCofre(): Sprite {
  const s = scene(1, 1, 30);
  s.shadow(2, 4, 13, 10, 0.26);
  const x0 = 2.5;
  const y0 = 4.5;
  const w = 11;
  const d = 8;
  const h = 8;
  const banda = (u: number) => u < 1.4 || u > w - 1.4 || Math.abs(u - w / 2) < 0.8;
  s.box(
    x0,
    y0,
    0,
    w,
    d,
    h,
    null,
    (u, v) => (banda(u) ? at(ROSADO, 2) : at(WOOD, 3.4 - (Math.floor(v / 2.7) % 2) * 0.6 - (noise(Math.floor(u), Math.floor(v), 4) < 0.12 ? 1 : 0))),
    (u, v) => (u < 1.2 || u > d - 1.2 ? at(ROSADO, 1) : at(WOOD, 2.2 - (Math.floor(v / 2.7) % 2) * 0.5)),
  );
  // La tapa abombada (a lo largo de x), un pelito más ancha que el cajón.
  for (let x = x0 - 0.4; x <= x0 + w + 0.4; x += 0.3)
    for (let t = 0; t <= 1; t += 0.04) {
      const a = t * Math.PI;
      const y = y0 - 0.4 + (1 - Math.cos(a)) * 0.5 * (d + 0.8);
      const z = h + Math.sin(a) * 3;
      const bx = x - x0;
      const c = Math.abs(bx - w / 2) < 0.8 || bx < 1.2 || bx > w - 1.2 ? at(ROSADO, 3 + Math.sin(a) * 0.8) : at(WOOD, 3 + Math.sin(a) * 1.4 - (t > 0.5 ? 0.6 : 0));
      s.plot(x, y, z, c);
    }
  // La ranura en lo alto de la tapa.
  for (let x = x0 + 3; x <= x0 + w - 3; x += 0.3) s.plot(x, y0 + d / 2, h + 3.05, at(C.woodDark, 0));
  // El corazón del frente y la chapa dorada.
  corazon(s, x0 + w / 2, y0 + d + 0.1, 4.2, 2.6, ROJO, { brillo: true });
  s.box(x0 + w / 2 - 0.9, y0 + d + 0.15, 7, 1.8, 0.3, 1.8, null, flatT(at(C.gold, 4)), null);
  // El moño rosado encima, con sus dos lazos y las colas.
  for (const side of [-1, 1]) {
    for (let t = 0; t <= 1; t += 0.05) {
      const a = t * Math.PI * 2;
      s.plot(x0 + w / 2 + side * (1.4 + Math.cos(a) * 1.3), y0 + d / 2, h + 4.6 + Math.sin(a) * 1, at(ROSADO, 3 + Math.sin(a)));
    }
    for (let k = 0; k < 3; k += 0.3) s.plot(x0 + w / 2 + side * (0.4 + k * 0.5), y0 + d / 2 + 0.3, h + 3.6 - k * 0.4, at(ROSADO, 2));
  }
  s.plot(x0 + w / 2, y0 + d / 2, h + 4.6, at(ROSADO, 4));
  return s.sprite();
}

// ---------- El puesto de chocolates y flores ----------

/** El puesto con toldo a rayas rojas y blancas: rosas en baldes, cajas de bombones, chocolatinas y tarjetas. */
function puestoAmor(): Sprite {
  const s = scene(2, 1, 52);
  s.shadow(1, 1, 30, 15, 0.22);
  for (const [x, y, h] of [[2, 2, 37], [30, 2, 37], [2, 14.5, 32], [30, 14.5, 32]] as const) poste(s, x, y, h, 1.4);
  // El mostrador: tablas al frente con el panel rosado de corazones.
  s.box(3, 8, 0, 26, 6, 12, flatT(at(WOOD, 4)), (u, v) => {
    if (v > 2 && v < 10 && u > 2 && u < 24) {
      const hx = ((u - 2) % 5.5) - 2.75;
      const k = enCorazon(hx / 1.6, (v - 6) / 1.6);
      return k !== null ? at(ROJO, 3) : at(ROSADO, 4);
    }
    return at(WOOD, 3 - (Math.floor(u / 2.6) % 2) * 0.6);
  }, flatT(at(WOOD, 1)));
  // Un balde de rosas rojas y otro de rosas blancas.
  [
    [7, ROJO],
    [12, BLANCO],
  ].forEach(([x, col], i) => {
    const cx = x as number;
    s.cylinder(cx, 10.5, 12, 2, 3.6, (_a, _v, luz) => at(C.terracotta, 2.5 + luz));
    hojas(s, cx, 10.5, 17, 2, 18, 3 + i);
    for (let k = 0; k < 5; k++) rosa(s, cx + Math.cos(k * 1.3) * 1.3, 10.5 + Math.sin(k * 1.3) * 1.3, 17.2 + (k % 2) * 0.8, 1, col as Ramp, [0, 0, 1]);
  });
  // Las cajas de bombones en pila (rojas con cinta dorada) y la bandeja de chocolatinas.
  for (let k = 0; k < 3; k++) {
    const z = 12 + k * 1.8;
    s.box(17 - k * 0.3, 9.5 + k * 0.4, z, 5, 3.6, 1.8, (u, v) => (Math.abs(u - 2.5) < 0.4 || Math.abs(v - 1.8) < 0.4 ? at(C.gold, 4) : at(ROJO, 3)), (u) => (Math.abs(u - 2.5) < 0.4 ? at(C.gold, 3) : at(ROJO, 2)), flatT(at(ROJO, 1)));
  }
  for (let k = 0; k < 4; k++) corazon(s, 24.5 + (k % 2) * 2.2, 11 + Math.floor(k / 2) * 1.6, 12.4, 0.9, ROJO);
  // Las tarjetas colgadas del travesaño de adelante.
  s.box(2, 14.7, 26, 28.4, 1, 1.2, flatT(at(C.woodDark, 4)), flatT(at(C.woodDark, 3)), null);
  for (let i = 0; i < 5; i++) {
    const x = 5 + i * 5;
    s.box(x, 15.1, 21.4, 3, 0.4, 4, null, (u, v) => (enCorazon((u - 1.5) / 1, (v - 2) / 1) !== null ? at(PAPELES[i % 2]!, 3) : at(BLANCO, v > 3.4 ? 3 : 4)), null);
  }
  // El toldo a rayas, de atrás (alto) hacia adelante, con el borde de ondas.
  const raya = (x: number) => (Math.floor(x / 3.8) % 2 ? BLANCO : ROJO);
  s.quad([1, 1, 38.4], [1, 0, 0], [0, 1, -0.38], 30.4, 15.4, (u) => at(raya(u), 3));
  for (let x = 1; x < 31.4; x += 0.4) {
    const drop = 1.2 + Math.abs(Math.sin((x / 3.8) * Math.PI)) * 1.4;
    for (let z = 0; z < drop; z += 0.4) s.plot(x, 16.4, 32.6 - z, at(raya(x - 1), 2));
  }
  // El corazón grande encima del toldo, como letrero.
  corazon(s, 16, 8, 43, 3.6, ROJO, { bulto: 1.2, brillo: true });
  return s.sprite();
}

// ---------- La banca de los enamorados ----------

/**
 * La banca: blanca, para dos, de espaldar con un corazón rojo calado; detrás, un arco en forma de corazón
 * hecho de rosas y follaje, con sus dos parales. Mira a +y (los que se sientan, a la cámara).
 */
function bancaEnamorados(): Sprite {
  const s = scene(2, 1, 54, 8);
  s.shadow(1, 3, 30, 10, 0.24);
  // Los dos parales del arco, enredados de hojas.
  for (const x of [2, 30]) {
    poste(s, x, 2.5, 30, 1.4);
    for (let z = 2; z < 30; z += 1.2) hojas(s, x + Math.cos(z) * 1.2, 2.5 + Math.sin(z) * 1.2, z, 1, 3, Math.round(z * 10) + x);
  }
  // El arco: el contorno de un corazón grande de rosas (rojas, rosadas y blancas) entre los parales.
  const R = 13;
  for (let u = -1.1; u <= 1.1; u += 0.025)
    for (let v = -1.1; v <= 1.1; v += 0.025) {
      const k = enCorazon(u, v);
      if (k === null || k > 0.12) continue;
      const x = 16 + u * R;
      const z = 33 + v * R;
      if (z < 22) continue;
      const i = Math.round((u + 2) * 40 + v * 17);
      hojas(s, x, 2.5, z, 1.4, 3, i);
      if (i % 3 === 0) rosa(s, x, 3.4, z, 1.4, PAPELES[i % 3 === 0 && i % 2 ? 0 : (i >> 1) % 3]!);
    }
  // Las patas, el asiento y el espaldar (tablas blancas; el corazón rojo calado al medio).
  for (const [x, y] of [[2.5, 6], [29, 6], [2.5, 12], [29, 12]] as const) s.solid(x, y, 0, 1.4, 1.4, 6.5, at(BLANCO, 3), at(BLANCO, 2), at(BLANCO, 1));
  s.box(1.5, 5, 6.5, 29, 8.5, 1.4, (u, v) => at(BLANCO, 4 - (Math.floor(v / 2.1) % 2) * 0.5 - (noise(Math.floor(u / 3), Math.floor(v), 7) < 0.1 ? 1 : 0)), flatT(at(BLANCO, 2)), flatT(at(BLANCO, 1)));
  s.box(1.5, 4, 7.9, 29, 1.2, 10, null, (u, v) => {
    const k = enCorazon((u - 14.5) / 3.6, (v - 5) / 3.6);
    if (k !== null) return at(ROJO, 3 + (k > 0.5 ? 0.6 : 0));
    return at(BLANCO, 3.6 - (Math.floor(u / 3.2) % 2) * 0.5);
  }, flatT(at(BLANCO, 2)));
  // Los brazos de la banca.
  for (const x of [1.5, 29.1]) s.solid(x, 5, 6.5, 1.4, 8, 4.5, at(BLANCO, 4), at(BLANCO, 2), at(BLANCO, 1));
  return s.sprite();
}

// ---------- El farol rosado ----------

/** Farol de papel en forma de corazón, colgado de su poste (hacia +x): rosado de día y prendido de noche. */
function farolRosado(night: boolean): Sprite {
  const s = scene(1, 1, 46);
  s.roundShadow(4, 8.5, 2.6, 0.26);
  poste(s, 4, 8, 36, 1.8);
  s.box(3, 7.4, 34.5, 10, 1.4, 1.4, flatT(at(C.woodDark, 4)), flatT(at(C.woodDark, 3)), flatT(at(C.woodDark, 2)));
  for (let z = 30.6; z < 34.6; z += 0.4) s.plot(11.5, 8.1, z, at(C.woodDark, 1));
  const prendido = ramp("#e05a8a", "#f07aa0", "#ff9ec0", "#ffc0d6", "#ffe0ec", "#fff4f8");
  corazon(s, 11.5, 7.4, 26, 4.2, night ? prendido : ROSADO, { bulto: 2.2, brillo: true });
  // La borla de abajo.
  for (let z = 19; z < 21.5; z += 0.4) s.plot(11.5, 8.6, z, at(night ? prendido : ROJO, 3));
  return s.sprite();
}

// ---------- La guirnalda de corazones ----------

/** Dos postes con un cordel que cae en curva, lleno de corazones de papel rojos, rosados y blancos. */
function guirnaldaCorazones(): Sprite {
  const s = scene(3, 1, 40, 8);
  for (const x of [2, 46]) {
    s.roundShadow(x, 8.5, 2.2, 0.24);
    poste(s, x, 8, 31, 1.6);
    corazon(s, x, 8.9, 32.5, 1.4, ROJO);
  }
  for (let t = 0; t <= 1; t += 0.004) {
    const x = 2 + t * 44;
    const z = 29 - Math.sin(t * Math.PI) * 7;
    s.plot(x, 8, z, at(BLANCO, 1));
  }
  for (let i = 1; i < 11; i++) {
    const t = i / 11;
    const x = 2 + t * 44;
    const z = 29 - Math.sin(t * Math.PI) * 7;
    for (let k = 0; k < 1.4; k += 0.4) s.plot(x, 8.1, z - k, at(BLANCO, 1));
    corazon(s, x, 8.4, z - 3.1, 1.6, PAPELES[i % 3]!, { bulto: 0.4 });
  }
  return s.sprite();
}

// ---------- El arco de flores del patio ----------

/**
 * El arco de la salida del patio (5 tiles a lo largo de x; se pasa por los tres del medio): parales
 * enredados de rosas, la curva cuajada de rosas rojas, rosadas y blancas y un corazón en la mitad.
 */
function arcoCorazones(): Sprite {
  const s = scene(5, 1, 74, 8);
  const yc = 8;
  for (const xc of [8, 72]) {
    s.roundShadow(xc, yc + 1, 4, 0.26);
    s.solid(xc - 1.6, yc - 1.6, 0, 3.2, 3.2, 40, at(BLANCO, 4), at(BLANCO, 3), at(BLANCO, 2));
    for (let z = 2; z < 40; z += 1.1) {
      const t = z * 0.7;
      hojas(s, xc + Math.cos(t) * 2, yc + Math.sin(t) * 2, z, 1.2, 4, Math.round(z * 10) + xc);
      if (Math.round(z) % 5 === 0) rosa(s, xc + 1.6, yc + 2, z, 1.1, PAPELES[(Math.round(z) / 5 + xc) % 3]!);
    }
  }
  for (let t = 0; t <= 1; t += 0.008) {
    const x = 8 + t * 64;
    const z = 39 + Math.sin(t * Math.PI) * 18;
    for (let k = 0; k < 5; k++) {
      const a = noise(Math.round(t * 999), k, 3) * Math.PI * 2;
      const r = 2.6 * Math.sqrt(noise(Math.round(t * 999), k, 4));
      s.plot(x, yc + Math.cos(a) * r, z + Math.sin(a) * r, at(C.leaf, 2 + (Math.sin(a) > 0 ? 2 : 1)));
    }
  }
  for (let t = 0.02; t <= 0.98; t += 0.04) {
    const x = 8 + t * 64;
    const z = 39 + Math.sin(t * Math.PI) * 18;
    const i = Math.round(t * 1000);
    rosa(s, x, yc + 2.2, z + (noise(i, 1, 9) - 0.5) * 2.4, 1.3 + noise(i, 2, 9) * 0.4, PAPELES[i % 3]!);
  }
  // El corazón de la mitad, colgado bajo la curva, y dos corazoncitos más.
  corazon(s, 40, yc + 2.6, 49, 4, ROJO, { bulto: 1.4, brillo: true });
  for (const [x, z] of [[28, 50], [52, 50]] as const) {
    for (let k = 0; k < 3; k += 0.4) s.plot(x, yc + 2.4, z + 3 - k, at(BLANCO, 1));
    corazon(s, x, yc + 2.4, z - 0.4, 1.6, ROSADO, { bulto: 0.5 });
  }
  return s.sprite();
}

// ---------- Los globos de corazón ----------

/** Tres globos de corazón amarrados a una pesita: uno rojo, uno rosado y uno dorado, a distinta altura. */
function globosCorazon(): Sprite {
  const s = scene(1, 1, 46);
  s.roundShadow(8, 9, 3, 0.24);
  s.box(6.5, 7.5, 0, 3, 3, 2.6, flatT(at(ROSADO, 4)), flatT(at(ROSADO, 3)), flatT(at(ROSADO, 2)));
  const globos: [number, number, number, Ramp][] = [
    [4.5, 7, 32, ROJO],
    [11, 8, 36, ROSADO],
    [8, 10, 27, C.gold],
  ];
  for (const [x, y, z, col] of globos) {
    for (let t = 0; t <= 1; t += 0.02) s.plot(8 + (x - 8) * t, 9 + (y - 9) * t, 2.6 + (z - 4.2 - 2.6) * t, at(BLANCO, 1));
    corazon(s, x, y, z, 3.2, col, { bulto: 1.6, brillo: true });
  }
  return s.sprite();
}

/** Lo que no cambia de noche (va en DRAW de furniture.ts). */
export const AMOR_DRAW: Record<string, () => Sprite> = {
  "amigo-cofre": amigoCofre,
  "puesto-amor": puestoAmor,
  "banca-enamorados": bancaEnamorados,
  "guirnalda-corazones": guirnaldaCorazones,
  "arco-corazones": arcoCorazones,
  "globos-corazon": globosCorazon,
};

/** Lo que se prende de noche (va en OUTDOOR de outdoor.ts). */
export const AMOR_NIGHT: Record<string, (night: boolean) => Sprite> = {
  "farol-rosado": farolRosado,
};

/** El color del marco de la foto de la banca (para el navegador). */
export const MARCO_ENAMORADOS = { papel: hex("#fde4ec"), borde: hex("#e87a9a"), corazon: hex("#d0304a"), brillo: hex("#ffa0b0") } as const;
