// El Carnaval de Negros y Blancos por código (docs/plan-carnaval.md): la decoración que el festival pone en
// la vereda (banderines, faroles, la tarima del palco, el puesto de máscaras, los mascarones del portón y
// serpentinas regadas) y las carrozas del desfile, que no son muebles: las arma el cliente con
// `carrozaSprite` y las mueve por la calle (ver apps/web/src/game/carnaval). Todo es papel maché blanco y
// negro con un solo color de acento por carroza, y piezas que se mueven por cuadros (alas, péndulo,
// humo, vapor). Coordenadas locales de arte (tile = 16), mirando hacia +x (el sentido del desfile).
// Las carrozas se dibujan con el origen en la esquina de atrás del lado de la vereda, a ras de la vereda:
// las ruedas bajan `CURB_DROP` hasta la calzada, como el bus.
import { COMPARSAS, type CarrozaId } from "@hyvento/shared";
import { CURB_DROP } from "../world/areas/parada";
import { textMask } from "./digits";
import { Escena, type Tinte } from "./exterior-escena";
import { C, mix } from "./palette";
import { PixelCanvas, alpha, at, hex, noise, ramp, type Ramp, type RGBA, type Sprite } from "./pixel";

/** Cuadros de las piezas que se mueven (el cliente los pasa en bucle). */
export const CARROZA_FRAMES = 4;

/** Papel maché blanco (cálido, nunca gris) y negro (tirando a morado, como las sombras de la cabaña). */
const BLANCO = ramp("#8f8778", "#bdb5a6", "#dcd6ca", "#efebe2", "#f9f7f2", "#ffffff");
const NEGRO = ramp("#121018", "#1c1924", "#26222f", "#332e3e", "#45404f", "#5c5668");
const flatT = (c: RGBA): Tinte => () => c;
const hexRamp = (h: string): Ramp => {
  const c = hex(h);
  const k = (t: number): RGBA => (t < 0 ? mix(c, [0, 0, 0, 255], -t) : mix(c, [255, 255, 255, 255], t));
  return [k(-0.55), k(-0.35), k(-0.15), c, k(0.25), k(0.5)];
};
/** El color de acento de cada carroza (el de la comparsa en @hyvento/shared). */
const ACENTO = Object.fromEntries(COMPARSAS.map((c) => [c.id, hexRamp(c.acento)])) as Record<CarrozaId, Ramp>;

const checker = (u: number, v: number, size: number) => (Math.floor(u / size) + Math.floor(v / size)) % 2 === 0;

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

/** Una nube de humo o vapor: bolitas blancas translúcidas. */
function puff(s: Escena, cx: number, cy: number, cz: number, r: number, a = 0.95) {
  orb(s, cx, cy, cz, r, r, r * 0.85, (luz) => alpha(at(BLANCO, 3.4 + luz * 1.4), a));
}

// ---------- La plataforma de todas las carrozas ----------

/** Ancho de las carrozas (en y): cabe en el carril exclusivo. */
const W = 40;
const Z = { wheel: -CURB_DROP, base: -9, top: 0 };

function rueda(s: Escena, cx: number, y: number, acento: Ramp) {
  s.quad([cx - 5.5, y + 0.3, Z.wheel], [1, 0, 0], [0, 0, 1], 11, 11, (u, v) => {
    const d = Math.hypot(u - 5.5, v - 5.5);
    if (d > 5.5) return null;
    if (d < 1.6) return at(acento, 3);
    if (d < 3.6) return Math.floor((Math.atan2(v - 5.5, u - 5.5) + Math.PI) / (Math.PI / 4)) % 2 ? at(BLANCO, 4) : at(NEGRO, 3);
    return at(NEGRO, d > 4.8 ? 1 : 2);
  });
}

/**
 * La plataforma con ruedas: faldón a cuadros blanco y negro, una franja del acento arriba, el piso blanco
 * con borde negro y, de noche, faroles prendidos en las esquinas.
 */
function plataforma(s: Escena, len: number, acento: Ramp, night: boolean) {
  const skirt: Tinte = (u, v) => {
    const z = v + Z.base;
    if (z < Z.base + 1) return at(NEGRO, 1);
    if (z > Z.top - 2) return at(acento, z > Z.top - 1 ? 4 : 3);
    return checker(u, z - Z.base, 4) ? at(BLANCO, 4) : at(NEGRO, 2);
  };
  s.box(0, 0, Z.base, len, W, Z.top - Z.base, (u, v) => (u < 1.5 || v < 1.5 || u > len - 1.5 || v > W - 1.5 ? at(NEGRO, 3) : at(BLANCO, 4 + (noise(u, v, 7) < 0.1 ? -1 : 0))), skirt, (u, v) => skirt(u, v));
  for (const x of [8, len - 8]) rueda(s, x, W, acento);
  s.shadow(0, 0, len, W, 0.32);
  // Los faroles de las esquinas (de noche, prendidos).
  for (const [x, y] of [
    [2, 2],
    [len - 3, 2],
    [2, W - 3],
    [len - 3, W - 3],
  ] as const) {
    s.solid(x, y, 0, 1.2, 1.2, 14, at(NEGRO, 3), at(NEGRO, 2), at(NEGRO, 1));
    orb(s, x + 0.6, y + 0.6, 16, 1.8, 1.8, 2.2, (luz) => (night ? at(C.fire, 4 + (luz > 0 ? 0.6 : 0)) : at(BLANCO, 3.5 + luz)));
  }
}

/** Letras de 5x7 sobre la cara +y (de cara a la vereda), con la base en z0 desde u0. */
function letrero(s: Escena, text: string, u0: number, y: number, z0: number, col: RGBA, bg: RGBA) {
  const m = textMask(text, 1);
  s.quad([u0 - 2, y + 0.4, z0 - 2], [1, 0, 0], [0, 0, 1], m.w + 4, m.h + 4, (u, v) => (m.on(Math.floor(u - 2), Math.floor(m.h + 1 - v)) ? col : bg));
}

// ---------- Las carrozas ----------

/** 1. La Familia Castañeda llega: la carreta con baúles, la abuela con sombrilla y el loro de papel. */
function castaneda(f: number, night: boolean): Sprite {
  const len = 64;
  const A = ACENTO.castaneda;
  const s = new Escena({ x0: -4, y0: -4, z0: Z.wheel - 2, x1: len + 6, y1: W + 6, z1: 70 }, 3);
  plataforma(s, len, A, night);
  // La carreta: cajón blanco de tablas con rayas negras y dos ruedas grandes de radios sepia.
  const tabla: Tinte = (u, v) => (Math.floor(v) % 4 === 0 ? at(NEGRO, 2) : at(BLANCO, 3.6 + (Math.floor(u) % 9 === 0 ? -1 : 0)));
  s.box(6, 6, 0, 40, 28, 12, flatT(at(BLANCO, 4)), tabla, tabla);
  for (const cx of [12, 40]) {
    s.quad([cx - 7, 34.6, 0], [1, 0, 0], [0, 0, 1], 14, 14, (u, v) => {
      const d = Math.hypot(u - 7, v - 7);
      if (d > 7) return null;
      if (d > 5.8) return at(A, 2);
      if (d < 1.4) return at(A, 4);
      const ang = Math.atan2(v - 7, u - 7) + (f * Math.PI) / 8;
      return Math.abs(Math.sin(ang * 4)) < 0.25 ? at(A, 3) : null;
    });
  }
  // Los baúles: sepia con zunchos negros y chapa dorada.
  const baul = (x: number, y: number, z: number, w: number, d: number, h: number) =>
    s.box(x, y, z, w, d, h, (u) => (Math.floor(u) % 6 < 1 ? at(NEGRO, 2) : at(A, 4)), (u, v) => (Math.floor(u) % 6 < 1 || v > h - 1.5 ? at(NEGRO, 2) : Math.abs(u - w / 2) < 1.2 && v > h - 5 ? at(C.gold, 4) : at(A, 3)), (_u, v) => (v > h - 1.5 ? at(NEGRO, 2) : at(A, 2)));
  baul(9, 10, 12, 18, 14, 9);
  baul(12, 12, 21, 12, 10, 7);
  // La abuela: falda blanca, pañolón negro, la cara de papel crema y el moño blanco.
  orb(s, 36, 20, 18, 6.5, 6.5, 7, (luz) => at(BLANCO, 3.4 + luz));
  orb(s, 36, 20, 26, 5, 5, 5, (luz, e) => (e < 0.2 ? at(NEGRO, 2.6 + luz) : at(NEGRO, 3 + luz)));
  orb(s, 36, 20, 33.5, 3.6, 3.6, 3.8, (luz) => at(C.cream, 3.4 + luz));
  orb(s, 35, 20, 37.6, 2.2, 2.2, 1.8, (luz) => at(BLANCO, 3.6 + luz));
  // Los ojos y la boca de papel (hacia +x, que mira el desfile).
  for (const [dy, dz] of [
    [-1.4, 0.8],
    [1.4, 0.8],
  ] as const)
    s.plot(39.5, 20 + dy, 33.5 + dz, at(NEGRO, 1));
  // La sombrilla: el palito y la copa a rayas que se mece con cada cuadro.
  const tilt = [0, 1.2, 0, -1.2][f % 4]!;
  for (let z = 30; z < 46; z += 0.5) s.plot(38 + tilt * ((z - 30) / 16), 22, z, at(NEGRO, 2));
  orb(s, 38 + tilt, 22, 46, 9, 9, 3.4, (luz, e, a) => (e < -0.15 ? null : Math.floor(((a + Math.PI) / (Math.PI * 2)) * 10) % 2 ? at(A, 3.6 + luz) : at(BLANCO, 3.8 + luz)));
  // El loro de papel en su percha, al frente: aletea cada dos cuadros.
  s.solid(54, 19, 0, 1.4, 1.4, 22, at(A, 3), at(A, 2), at(A, 1));
  s.solid(50, 19, 21, 9, 1.4, 1.2, at(A, 4), at(A, 3), at(A, 2));
  orb(s, 55, 19.7, 26, 2.6, 2.4, 3.6, (luz) => at(BLANCO, 3.6 + luz));
  orb(s, 56.4, 19.7, 30.4, 2, 2, 2, (luz) => at(NEGRO, 3 + luz));
  s.plot(58.4, 19.7, 30, at(C.gold, 4));
  const ala = f % 2 ? 4 : 1;
  for (let t = 0; t < 1; t += 0.1) for (let k = 0; k < 3; k += 0.5) s.plot(54 - t * 2, 21.8 + t * ala, 27 + k - t * 1.5, at(NEGRO, 2.5 + (k > 2 ? 1 : 0)));
  letrero(s, "CASTANEDA", 6, W, 2.5, at(NEGRO, 1), at(BLANCO, 5));
  return s.sprite();
}

/** 2. El Cóndor de los Andes: cuerpo negro, collar blanco, cabeza pelada y las alas que suben y bajan. */
function condor(f: number, night: boolean): Sprite {
  const len = 80;
  const A = ACENTO.condor;
  const s = new Escena({ x0: -4, y0: -40, z0: Z.wheel - 2, x1: len + 8, y1: W + 44, z1: 92 }, 3);
  plataforma(s, len, A, night);
  // Una peña de papel maché (rocas blancas con vetas negras) donde se posa.
  orb(s, 40, 20, 4, 22, 14, 9, (luz, _e, a) => (Math.abs(Math.sin(a * 5)) < 0.12 ? at(NEGRO, 2) : at(BLANCO, 3 + luz * 1.2)));
  // Las garras doradas.
  for (const dy of [-4, 4]) s.solid(44, 20 + dy - 1, 10, 3, 2, 5, at(A, 4), at(A, 3), at(A, 2));
  // El cuerpo y las plumas (un brillo morado tenue en el negro).
  orb(s, 40, 20, 26, 18, 9, 11, (luz, e, a) => at(NEGRO, 2.4 + luz * 1.4 + (Math.abs(Math.sin(a * 9 + e * 3)) < 0.1 ? 0.8 : 0)));
  // La cola en abanico, atrás.
  for (let t = 0; t < 1; t += 0.05) for (let k = -6; k <= 6; k += 0.5) s.plot(22 - t * 12, 20 + k * (1 + t * 0.8), 24 - t * 4, at(NEGRO, 2 + (Math.abs(k) > 5 ? 1 : 0)));
  // Las alas: dos planos que salen de los costados y giran hacia arriba según el cuadro; las plumas de atrás blancas.
  const ang = [0.25, 0.65, 1.0, 0.65][f % 4]!;
  const ala = (side: 1 | -1) => {
    const y0 = 20 + side * 8;
    const dy = Math.cos(ang) * side;
    const dz = Math.sin(ang);
    s.quad([18, y0, 28], [1, 0, 0], [0, dy, dz], 40, 34, (u, v) => {
      // Borde de atrás con plumas largas (dedos) en la punta.
      const tip = v > 26 && Math.floor(u / 4) % 2 === 0 && u < 30;
      if (u > 36 - v * 0.25 || (v > 26 && !tip)) return null;
      if (u < 7 && v > 6) return at(BLANCO, 3.6 + (v % 3 < 1 ? -0.6 : 0));
      return at(NEGRO, 2 + (u % 5 < 0.7 ? 1 : 0) + (side > 0 ? 0.6 : 0));
    });
  };
  ala(-1);
  ala(1);
  // El collar blanco de plumón, el cuello y la cabeza pelada (gris rosado) con el pico de hueso.
  for (let a = 0; a < Math.PI * 2; a += 0.5) orb(s, 56 + Math.cos(a) * 1.5, 20 + Math.sin(a) * 6, 33 + Math.cos(a) * 1.2, 3, 3, 2.6, (luz) => at(BLANCO, 3.8 + luz));
  orb(s, 60, 20, 37, 3, 3, 4, (luz) => at(NEGRO, 3 + luz));
  orb(s, 64, 20, 41, 4.4, 3.8, 4, (luz) => mix(at(C.rose, 1.6 + luz), at(NEGRO, 3), 0.35));
  s.solid(63, 19, 45, 3, 2, 1.6, at(C.rug, 2), at(C.rug, 1), at(C.rug, 1));
  for (let t = 0; t < 1; t += 0.08) s.box(67 + t * 4, 19.2, 41 - t * 2.5, 1.4, 1.6, 1.4, flatT(at(C.cream, 4)), flatT(at(C.cream, 3)), flatT(at(C.cream, 2)));
  s.plot(66, 22.2, 42.6, at(A, 4));
  s.plot(66, 17.8, 42.6, at(A, 4));
  letrero(s, "CONDOR", 26, W, 2.5, at(A, 4), at(NEGRO, 1));
  return s.sprite();
}

/** 3. El Galeras que fuma: el volcán con nieve, la boca encendida, el humo en espiral y cuyes en la falda. */
function galeras(f: number, night: boolean): Sprite {
  const len = 64;
  const A = ACENTO.galeras;
  const s = new Escena({ x0: -4, y0: -14, z0: Z.wheel - 2, x1: len + 6, y1: W + 6, z1: 112 }, 3);
  plataforma(s, len, A, night);
  // El volcán: faldas negras con vetas blancas de papel; arriba, la nieve.
  s.cone(32, 20, 0, 22, 44, (a, sl, luz) => {
    const k = sl / Math.hypot(22, 44);
    if (k > 0.8) return at(BLANCO, 3.6 + luz);
    if (k > 0.72 && Math.sin(a * 7) > 0.2) return at(BLANCO, 3 + luz);
    if (Math.abs(Math.sin(a * 6 + sl * 0.15)) < 0.1) return at(BLANCO, 2.6 + luz * 0.6);
    return at(NEGRO, 2.4 + luz * 1.3);
  });
  // La boca encendida.
  s.disc(32, 20, 40.5, 3.4, (dx, dy) => (Math.hypot(dx, dy) < 2 ? at(C.fire, 4) : at(A, 3)));
  // El humo blanco en espiral: sube y gira con los cuadros.
  for (let i = 0; i < 5; i++) {
    const t = (i + f / CARROZA_FRAMES) / 5;
    const ang = t * Math.PI * 3;
    puff(s, 32 + Math.cos(ang) * (2 + t * 6), 20 + Math.sin(ang) * (2 + t * 6), 46 + t * 52, 3 + t * 5, 0.9 - t * 0.35);
  }
  // Los cuyes de papel en la falda: blancos, negros y uno del acento.
  for (const [x, y, c] of [
    [14, 34, BLANCO],
    [26, 37, NEGRO],
    [44, 36, A],
    [52, 30, BLANCO],
  ] as const) {
    orb(s, x, y, 2.5, 3.2, 2.2, 2.2, (luz) => at(c, 3 + luz));
    s.plot(x + 3, y, 3.4, at(NEGRO, 1));
  }
  letrero(s, "GALERAS", 6, W, 2.5, at(A, 4), at(NEGRO, 1));
  return s.sprite();
}

/** 4. El Reloj de E.: un reloj de pie enorme con su péndulo y los engranajes de bronce que giran. */
function reloj(f: number, night: boolean): Sprite {
  const len = 64;
  const A = ACENTO.reloj;
  const s = new Escena({ x0: -4, y0: -4, z0: Z.wheel - 2, x1: len + 6, y1: W + 6, z1: 96 }, 3);
  plataforma(s, len, A, night);
  // La caja negra con filetes de bronce.
  const caja: Tinte = (u, v) => (u < 1.2 || v < 1.2 ? at(A, 3.6) : at(NEGRO, 2.6 + (Math.floor(v) % 12 === 0 ? 0.8 : 0)));
  s.box(30, 12, 0, 18, 16, 58, flatT(at(A, 3)), caja, caja);
  s.box(28, 10, 58, 22, 20, 6, flatT(at(A, 4)), (u, v) => (v > 4.5 ? at(A, 4) : at(NEGRO, 3)), flatT(at(NEGRO, 2)));
  s.cone(39, 20, 64, 6, 8, (_a, _s, luz) => at(A, 3.4 + luz));
  // La esfera (cara +y): blanca con las marcas y las agujas negras, aro de bronce. Marca casi la una.
  const cz = 46;
  s.quad([31, 28.4, cz - 8], [1, 0, 0], [0, 0, 1], 16, 16, (u, v) => {
    const dx = u - 8;
    const dz = v - 8;
    const d = Math.hypot(dx, dz);
    if (d > 8) return null;
    if (d > 6.8) return at(A, 4);
    const ang = Math.atan2(dz, dx);
    if (d > 5.4 && Math.abs(Math.sin(ang * 6)) < 0.22) return at(NEGRO, 1);
    const along = (a: number, len2: number) => d < len2 && Math.abs(Math.sin(ang - a)) * d < 0.7 && Math.cos(ang - a) > 0;
    if (along(Math.PI / 2, 5.2) || along(Math.PI / 2 - Math.PI / 6, 3.6)) return at(NEGRO, 1);
    return at(BLANCO, 4.5);
  });
  // La ventanita del péndulo y el péndulo que oscila (cuadro a cuadro).
  s.quad([33, 28.4, 8], [1, 0, 0], [0, 0, 1], 12, 26, (u, v) => (u < 1 || u > 11 || v < 1 || v > 25 ? at(A, 3) : alpha(at(BLANCO, 1), 0.7)));
  const sw = [-0.35, 0, 0.35, 0][f % 4]!;
  for (let t = 0; t < 1; t += 0.04) s.plot(39 + Math.sin(sw) * t * 18, 28.8, 33 - Math.cos(sw) * t * 18, at(A, 4));
  s.quad([39 + Math.sin(sw) * 18 - 3, 28.9, 33 - Math.cos(sw) * 18 - 3], [1, 0, 0], [0, 0, 1], 6, 6, (u, v) => (Math.hypot(u - 3, v - 3) < 3 ? at(A, Math.hypot(u - 2, v - 4) < 1.4 ? 5 : 3.6) : null));
  // Los engranajes de bronce a los lados (giran en sentidos contrarios).
  const engranaje = (cx: number, cz2: number, r: number, dir: 1 | -1) =>
    s.quad([cx - r - 2, 32, cz2 - r - 2], [1, 0, 0], [0, 0, 1], r * 2 + 4, r * 2 + 4, (u, v) => {
      const dx = u - r - 2;
      const dz = v - r - 2;
      const d = Math.hypot(dx, dz);
      const a = Math.atan2(dz, dx) + dir * f * (Math.PI / 12);
      const tooth = Math.cos(a * 8) > 0.3 ? 2 : 0;
      if (d > r + tooth) return null;
      if (d < 2) return at(NEGRO, 2);
      if (d < r * 0.55 && Math.abs(Math.sin(a * 3)) > 0.35) return null;
      return at(A, 3 + (dx < -dz ? 1 : 0));
    });
  engranaje(14, 26, 9, 1);
  engranaje(22, 12, 6, -1);
  engranaje(56, 20, 7, -1);
  // La firma: "E." en la frente del reloj.
  letrero(s, "E.", 35, 28.6, 59, at(A, 5), at(NEGRO, 2));
  return s.sprite();
}

/** 5. El tinto de Doña Aurora: el pocillo gigante que echa vapor y la cafetera que sirve sola. */
function tinto(f: number, night: boolean): Sprite {
  const len = 64;
  const A = ACENTO.tinto;
  const s = new Escena({ x0: -4, y0: -4, z0: Z.wheel - 2, x1: len + 6, y1: W + 6, z1: 96 }, 3);
  plataforma(s, len, A, night);
  // El plato y el pocillo: blanco con dos rayas negras, la oreja del lado de la vereda y el tinto adentro.
  s.disc(24, 20, 1, 17, (dx, dy) => (Math.hypot(dx, dy) > 15.5 ? at(NEGRO, 2) : at(BLANCO, 4.2)));
  s.cylinder(24, 20, 1.5, 13, 22, (_a, v, luz) => (Math.abs(v - 15) < 1.4 || Math.abs(v - 5) < 1.4 ? at(NEGRO, 2 + luz) : at(BLANCO, 3.6 + luz * 1.3)));
  s.disc(24, 20, 23.5, 13, (dx, dy) => (Math.hypot(dx, dy) > 11.8 ? at(BLANCO, 5) : at(A, 2 + (Math.hypot(dx + 3, dy + 3) < 3 ? 1.4 : 0))));
  for (let a = -Math.PI / 2; a < Math.PI / 2; a += 0.08) orb(s, 24, 33 + Math.cos(a) * 5.5, 12 + Math.sin(a) * 6, 1.3, 1.3, 1.3, (luz) => at(BLANCO, 3.8 + luz));
  // El vapor: tres columnas de bolitas que suben con los cuadros.
  for (let col = 0; col < 3; col++)
    for (let i = 0; i < 4; i++) {
      const t = (i + ((f + col) % CARROZA_FRAMES) / CARROZA_FRAMES) / 4;
      puff(s, 20 + col * 4 + Math.sin(t * 6 + col) * 2, 20 - col * 3, 27 + t * 40, 2 + t * 3.5, 0.75 - t * 0.5);
    }
  // La cafetera de aluminio negro y blanco, inclinada sobre el pocillo, con el chorrito.
  s.cylinder(50, 20, 0, 6, 12, (a, _v, luz) => (Math.floor((a + 3) * 2.5) % 2 ? at(NEGRO, 2.6 + luz) : at(NEGRO, 3.4 + luz)));
  s.cylinder(50, 20, 12, 5, 12, (_a, v, luz) => (v > 10.5 ? at(NEGRO, 2) : at(BLANCO, 3.4 + luz * 1.2)));
  s.cone(50, 20, 24, 5, 4, (_a, _s, luz) => at(NEGRO, 3 + luz));
  for (let t = 0; t < 1; t += 0.06) s.box(44 - t * 5, 19.4, 21 + t * 2, 1.4, 1.2, 1.2, flatT(at(BLANCO, 4)), flatT(at(BLANCO, 3)), flatT(at(BLANCO, 2)));
  // El chorrito de tinto: gotas que bajan cuadro a cuadro.
  for (let i = 0; i < 6; i++) {
    const t = (i + f / CARROZA_FRAMES) / 6;
    s.plot(38.5 - t * 4, 20, 24 - t * 1.5 - t * t * 2, at(A, 2.5));
  }
  letrero(s, "TINTO", 34, W, 2.5, at(BLANCO, 5), at(A, 2));
  return s.sprite();
}

/** 6. El Megabús de la alegría: el bus de la parada pintado a cuadros, con cachivaches y banderas encima. */
function megabus(f: number, night: boolean): Sprite {
  const len = 96;
  const A = ACENTO.megabus;
  const s = new Escena({ x0: -4, y0: -4, z0: Z.wheel - 2, x1: len + 6, y1: W + 6, z1: 80 }, 3);
  // Sin la plataforma: el bus va sobre sus ruedas, con el faldón negro como el de verdad.
  const H = 30;
  const lado: Tinte = (u, v) => {
    const z = v + Z.base;
    if (z < Z.base + 4) return at(NEGRO, 1.6);
    if (z > 6 && z < 9) return at(A, 4);
    if (z > 12 && z < 24) {
      const k = ((u % 22) + 22) % 22;
      if (k < 2) return at(NEGRO, 2);
      return night ? at(C.gold, 4) : at(C.metal, 1 + (Math.abs(((u + z) % 30) - 15) < 1 ? 2 : 0));
    }
    if (z >= H - 3) return at(A, 4);
    return checker(u, z, 5) ? at(BLANCO, 4.4) : at(NEGRO, 2);
  };
  const frente: Tinte = (u, v) => {
    const z = v + Z.base;
    if (z < Z.base + 4) return at(NEGRO, 1.6);
    if (z > 12 && z < 26 && u > 3 && u < W - 3) return night ? mix(at(C.metal, 1), at(C.gold, 3), 0.3) : at(C.metal, 2);
    if (z < -1 && (u < 7 || u > W - 7)) return night ? at(C.gold, 5) : at(BLANCO, 5);
    return at(A, 3.6);
  };
  s.box(0, 0, Z.base, len, W, H - Z.base, (u, v) => (u < 1 || v < 1 || u > len - 1 || v > W - 1 ? at(A, 4) : checker(u, v, 8) ? at(BLANCO, 4) : at(NEGRO, 3)), lado, frente);
  for (const x of [16, 30, len - 20]) rueda(s, x, W, A);
  s.shadow(0, 0, len, W, 0.32);
  // Los cachivaches del techo: maletas, un baúl, una silla patas arriba y un costal.
  const roof = H;
  s.box(10, 6, roof, 14, 10, 8, flatT(at(BLANCO, 4)), flatT(at(BLANCO, 3)), flatT(at(BLANCO, 2)));
  s.box(12, 20, roof, 12, 12, 6, flatT(at(NEGRO, 3)), flatT(at(NEGRO, 2)), flatT(at(NEGRO, 1)));
  s.box(32, 8, roof, 16, 14, 9, (u) => (Math.floor(u) % 5 < 1 ? at(NEGRO, 2) : at(A, 4)), (u) => (Math.floor(u) % 5 < 1 ? at(NEGRO, 2) : at(A, 3)), flatT(at(A, 2)));
  orb(s, 58, 26, roof + 5, 7, 6, 5, (luz) => at(C.cream, 3 + luz));
  for (let t = 0; t < 1; t += 0.2) s.plot(58 + t * 3, 26, roof + 9 + t * 2, at(NEGRO, 1));
  // La silla patas arriba.
  s.box(70, 12, roof + 6, 10, 10, 1.5, flatT(at(BLANCO, 4)), flatT(at(BLANCO, 3)), flatT(at(BLANCO, 2)));
  for (const [x, y] of [
    [70, 12],
    [79, 12],
    [70, 21],
    [79, 21],
  ] as const)
    s.solid(x, y, roof + 7.5, 1, 1, 7, at(NEGRO, 3), at(NEGRO, 2), at(NEGRO, 1));
  // Las banderas blanquinegras en sus palos, que ondean.
  for (const [x, ph] of [
    [6, 0],
    [88, 2],
  ] as const) {
    s.solid(x, 4, roof, 1.2, 1.2, 26, at(C.logs, 4), at(C.logs, 3), at(C.logs, 2));
    s.quad([x + 1.2, 4.6, roof + 16], [1, 0, 0], [0, 0, 1], 16, 9, (u, v) => {
      const wave = Math.sin(u * 0.5 + (f + ph) * (Math.PI / 2)) * 1.4;
      const vv = v + wave * (u / 16);
      if (vv < 0 || vv > 9) return null;
      return vv > 9 - u * 0.56 ? at(NEGRO, 2) : at(BLANCO, 4.4);
    });
  }
  // El letrero de ruta en LED ámbar ("FIESTA") y el nombre al costado, de cara a la vereda.
  const m = textMask("FIESTA", 1);
  s.quad([len + 0.2, 2, 24], [0, 1, 0], [0, 0, 1], W - 4, 8, (u, v) => {
    const uu = Math.floor(W - 4 - u - (W - 4 - m.w) / 2);
    return m.on(uu, Math.floor(7.5 - v)) ? at(C.mustard, 4) : at(NEGRO, 1);
  });
  letrero(s, "ALEGRIA", 30, W, -3, at(NEGRO, 1), at(A, 4));
  return s.sprite();
}

const CARROZAS: Record<CarrozaId, (f: number, night: boolean) => Sprite> = { castaneda, condor, galeras, reloj, tinto, megabus };

/** Largo de cada carroza en la calle (tiles): de ahí para atrás va su comparsa. */
export const CARROZA_LARGO: Record<CarrozaId, number> = { castaneda: 4, condor: 5, galeras: 4, reloj: 4, tinto: 4, megabus: 6 };

/** Una carroza en el cuadro `f` (0..CARROZA_FRAMES-1), de día o de noche (los faroles prendidos). */
export function carrozaSprite(id: CarrozaId, f: number, night: boolean): Sprite {
  return CARROZAS[id](((f % CARROZA_FRAMES) + CARROZA_FRAMES) % CARROZA_FRAMES, night);
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

// ---------- La decoración de la vereda ----------

const scene = (w: number, d: number, h: number, pad = 6) => new Escena({ x0: -pad, y0: -pad, z0: -4, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const ACENTOS = [hex("#c05a4a"), hex("#dcae3f"), hex("#a6d23a"), hex("#5d93cf")];

/**
 * Banderines: dos postes en las orillas del tile y una cuerda que cuelga entre ellos con banderines
 * blancos, negros y uno de color. Puestos en fila forman una guirnalda. No bloquea (se pasa por debajo).
 */
function banderines(): Sprite {
  const s = scene(1, 1, 40);
  // Un solo poste por tile, blanco con la punta negra: la cuerda sigue hasta el poste del tile de al lado.
  s.solid(0, 7.4, 0, 1.2, 1.2, 32, at(BLANCO, 4.2), at(BLANCO, 3.2), at(BLANCO, 2.4));
  s.solid(0, 7.4, 28, 1.2, 1.2, 4, at(NEGRO, 3), at(NEGRO, 2), at(NEGRO, 1));
  const sag = (x: number) => 30 - Math.sin((x / 16) * Math.PI) * 4;
  for (let x = 0.6; x < 16; x += 0.25) s.plot(x, 8, sag(x), at(NEGRO, 2));
  [2, 6, 10, 14].forEach((x0, i) => {
    const col = i === 1 ? ACENTOS[0]! : i % 2 ? at(NEGRO, 2.4) : at(BLANCO, 4.4);
    s.quad([x0 - 1.8, 8.2, sag(x0) - 7], [1, 0, 0], [0, 0, 1], 3.6, 7, (u, v) => (Math.abs(u - 1.8) < (v / 7) * 1.8 + 0.2 ? col : null));
  });
  return s.sprite();
}

/** Farol de carnaval: papel blanco con rayas negras en su poste; de noche, prendido. */
function farolCarnaval(night: boolean): Sprite {
  const s = scene(1, 1, 48);
  s.roundShadow(8, 8, 3, 0.24);
  s.solid(7.2, 7.2, 0, 1.6, 1.6, 38, at(NEGRO, 3), at(NEGRO, 2), at(NEGRO, 1));
  s.solid(6.6, 6.6, 0, 2.8, 2.8, 2, at(NEGRO, 3), at(NEGRO, 2), at(NEGRO, 1));
  orb(s, 8, 8, 34, 4.4, 4.4, 5.4, (luz, e) => {
    const raya = Math.abs(Math.sin(e * 5)) < 0.22;
    if (night) return raya ? at(C.fire, 2.6) : at(C.gold, 4.4 + (luz > 0 ? 0.6 : 0));
    return raya ? at(NEGRO, 2.4) : at(BLANCO, 3.8 + luz);
  });
  s.disc(8, 8, 39.6, 2, () => at(NEGRO, 2));
  // La borla de color abajo.
  for (let z = 25; z < 28.6; z += 0.4) s.plot(8, 8, z, at(C.rug, 3));
  return s.sprite();
}

/**
 * La tarima de la comparsa (el palco del jurado), 3x2: piso de tablas, faldón a cuadros blanco y negro,
 * escalones al frente, el arco con banderines y el letrero "CARNAVAL".
 */
function tarimaComparsa(): Sprite {
  const s = scene(3, 2, 70);
  const len = 48;
  const dep = 32;
  const zt = 10;
  const faldon: Tinte = (u, v) => (v > zt - 2 ? at(C.rug, 3) : checker(u, v, 4) ? at(BLANCO, 4.2) : at(NEGRO, 2.2));
  s.box(0, 0, 0, len, dep, zt, (u, v) => (Math.floor(v) % 6 === 0 ? at(C.logs, 2) : at(C.logs, 3.6 + (noise(Math.floor(u / 8), Math.floor(v / 6), 2) < 0.3 ? -0.5 : 0))), faldon, faldon);
  // Los escalones del frente (+y).
  for (let i = 0; i < 2; i++) s.box(18, dep + i * 3, 0, 12, 3, zt - (i + 1) * 3.4, flatT(at(C.logs, 4)), flatT(at(C.logs, 3)), flatT(at(C.logs, 2)));
  // El arco: dos postes blancos, la viga negra y el letrero.
  for (const x of [2, len - 4]) s.solid(x, 2, zt, 2, 2, 40, at(BLANCO, 4.4), at(BLANCO, 3.4), at(BLANCO, 2.6));
  s.box(2, 2, zt + 40, len - 4, 2, 4, flatT(at(NEGRO, 3)), flatT(at(NEGRO, 2)), flatT(at(NEGRO, 1)));
  letrero(s, "CARNAVAL", 7, 4, zt + 31, at(NEGRO, 1), at(BLANCO, 5));
  // Banderines colgando de la viga.
  for (let x = 4; x < len - 4; x += 4) {
    const i = Math.floor(x / 4);
    const col = i % 4 === 1 ? ACENTOS[(i >> 2) % ACENTOS.length]! : i % 2 ? at(NEGRO, 2.4) : at(BLANCO, 4.4);
    s.quad([x - 1.4, 3.8, zt + 34], [1, 0, 0], [0, 0, 1], 2.8, 5, (u, v) => (Math.abs(u - 1.4) < (v / 5) * 1.4 + 0.2 ? col : null));
  }
  // El atril del jurado con su campana.
  s.box(36, 10, zt, 6, 6, 12, flatT(at(NEGRO, 3)), flatT(at(NEGRO, 2)), flatT(at(NEGRO, 1)));
  orb(s, 39, 13, zt + 14, 1.8, 1.8, 2, (luz) => at(C.gold, 3.6 + luz));
  return s.sprite();
}

/** El puesto de máscaras: mesón con mantel a cuadros, toldo de rayas y las máscaras colgadas. */
function puestoCarnaval(): Sprite {
  const s = scene(2, 1, 64);
  const len = 32;
  s.box(1, 2, 0, len - 2, 12, 14, flatT(at(BLANCO, 4.4)), (u, v) => (checker(u, v, 3) ? at(BLANCO, 4.2) : at(NEGRO, 2.4)), flatT(at(NEGRO, 2)));
  for (const x of [1, len - 2]) s.solid(x, 2, 14, 1.2, 1.2, 30, at(NEGRO, 3), at(NEGRO, 2), at(NEGRO, 1));
  s.quad([0, 1, 44], [1, 0, 0], [0, 0.55, -0.3], len, 22, (u) => (Math.floor(u / 4) % 2 ? at(NEGRO, 2.4) : at(BLANCO, 4.4)));
  // Las máscaras colgadas del toldo: un antifaz, un cóndor y un sol.
  const mascara = (x: number, base: RGBA, ojo: RGBA) =>
    s.quad([x, 14.2, 28], [1, 0, 0], [0, 0, 1], 6, 6, (u, v) => {
      const d = Math.hypot(u - 3, v - 3);
      if (d > 3) return null;
      if (Math.abs(v - 3.6) < 0.8 && Math.abs(Math.abs(u - 3) - 1.3) < 0.6) return ojo;
      return u < 3 ? base : mix(base, at(NEGRO, 2), 0.85);
    });
  mascara(4, at(BLANCO, 4.4), at(NEGRO, 1));
  mascara(13, at(C.gold, 4), at(NEGRO, 1));
  mascara(22, at(BLANCO, 4.4), at(C.rug, 2));
  // Bolsitas de maicena y rollos de serpentinas en el mesón.
  for (let i = 0; i < 4; i++) orb(s, 6 + i * 3, 6, 15.5, 1.3, 1.3, 1.5, (luz) => at(BLANCO, 3.8 + luz));
  for (let i = 0; i < 3; i++) s.cylinder(20 + i * 3.4, 7, 14, 1.3, 2, (_a, v) => (Math.floor(v * 2) % 2 ? at(NEGRO, 2) : at(BLANCO, 4.4)));
  return s.sprite();
}

/** Un mascarón en su poste: la cara grande de papel maché, mitad blanca y mitad negra, con penacho. */
function mascaron(): Sprite {
  const s = scene(1, 1, 64);
  s.roundShadow(8, 8, 3, 0.24);
  s.solid(7.2, 7.2, 0, 1.6, 1.6, 36, at(C.logs, 4), at(C.logs, 3), at(C.logs, 2));
  orb(s, 8, 8, 44, 7, 3, 8, (luz, e, a) => {
    const front = Math.cos(a) * 0.5 + Math.sin(a);
    // Los ojos y la boca en la mitad que mira a la cámara.
    if (front > 0.6 && ((Math.abs(e - 0.25) < 0.16 && Math.abs(Math.sin(a * 2)) > 0.6) || (Math.abs(e + 0.45) < 0.08 && front > 0.85))) return at(C.rug, 2);
    return Math.cos(a) < Math.sin(a) * 0.3 ? at(BLANCO, 3.8 + luz) : at(NEGRO, 2.4 + luz);
  });
  for (let i = -2; i <= 2; i++) orb(s, 8 + i * 1.6, 8, 53 + (2 - Math.abs(i)) * 1.6, 1.2, 1.2, 3, (luz) => at(i % 2 ? C.gold : C.rug, 3.4 + luz));
  return s.sprite();
}

/** Serpentinas y confeti regados en el pasto (planos, no bloquean). */
function serpentinasSuelo(): Sprite {
  const s = scene(1, 1, 4);
  s.borde = false;
  for (let k = 0; k < 3; k++) {
    const col = k === 1 ? at(NEGRO, 2.4) : k === 2 ? ACENTOS[k]! : at(BLANCO, 4.4);
    for (let t = 0; t < 1; t += 0.01) s.plot(2 + t * 12, 3 + k * 4 + Math.sin(t * 9 + k) * 2.4, 0.3, col);
  }
  for (let i = 0; i < 14; i++) s.plot(1 + noise(i, 1, 5) * 14, 1 + noise(i, 2, 5) * 14, 0.4, i % 3 ? at(BLANCO, 4.4) : at(NEGRO, 2));
  return s.sprite();
}

export const CARNAVAL_DRAW: Record<string, () => Sprite> = {
  "banderines-carnaval": banderines,
  "tarima-comparsa": tarimaComparsa,
  "puesto-carnaval": puestoCarnaval,
  mascaron,
  "serpentinas-suelo": serpentinasSuelo,
};

/** Lo que de noche se prende (va en OUTDOOR de outdoor.ts). */
export const CARNAVAL_NIGHT: Record<string, (night: boolean) => Sprite> = {
  "farol-carnaval": farolCarnaval,
};

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
