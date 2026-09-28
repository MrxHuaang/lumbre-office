// El garaje del jardín por fuera (5x5 tiles = 80x80 unidades de arte), pegado al oeste de la torre.
// Bloque de cemento gastado con techo de chapa a un agua (alto adelante), el portón enrollable a medio
// subir, la puerta chica con su foco, el letrero pintado a mano, la canaleta rota y, al costado este, la
// ventana sucia, el medidor de luz, llantas y un tambor. De noche se ve la luz de adentro por la rendija
// del portón y por la ventana. Se registra en outdoor.ts (tiene versión de noche).
import { Escena, type Tinte } from "./exterior-escena";
import { cinderblockWall, RUST, ZINC } from "./garaje-room";
import { RUBBER, standingTire, tire } from "./garaje";
import { C, mix } from "./palette";
import { at, bayer, noise, smoothNoise, type RGBA, type Sprite } from "./pixel";
import { glyphOn } from "./room";

/** Paredes (sin el alero) y alturas: el frente más alto que el fondo, para que el agua caiga atrás. */
const X0 = 3;
const X1 = 66;
const Y0 = 4;
const Y1 = 76;
const HF = 56;
const HB = 44;
const K = (HF - HB) / (Y1 - Y0);
/** Alto del techo en y (el plano pasa por el tope de las dos paredes). */
const roofZ = (y: number) => HB + (y - Y0) * K;

/** Portón enrollable y puerta chica, en `u` a lo largo del frente (desde X0). */
const GATE = { u0: 4, u1: 38, top: 33, open: 12 };
const DOOR = { u0: 45, u1: 57, top: 28 };

/** El portón: láminas con canal, óxido que sube desde abajo, una abolladura y la barra de abajo. */
function gateSlats(u: number, v: number): RGBA {
  const k = (v - GATE.open) % 3;
  const rust = smoothNoise(u, v, 6, 3) + (v < GATE.open + 6 ? 0.25 : 0);
  if (v < GATE.open + 1.5) return at(C.metal, v < GATE.open + 0.6 ? 1 : 2);
  let c = at(ZINC, k < 0.6 ? 1 : k > 2.4 ? 4 : 3);
  if (rust > 0.7) c = at(RUST, k < 0.6 ? 1 : k > 2.4 ? 4 : 3);
  // Abolladura: una zona hundida, más oscura.
  if (Math.hypot(u - 26, (v - 20) * 1.6) < 4) c = at(ZINC, k < 1.5 ? 1 : 2);
  // Grafiti viejo casi borrado.
  if (Math.abs(v - 17 - Math.sin(u * 0.4) * 1.5) < 0.6 && u > 7 && u < 20) c = mix(c, at(C.fabric, 3), 0.5);
  return c;
}

/** Lo que se ve por la rendija del portón: oscuro con la silueta de una llanta y del banco; de noche, la luz del foco. */
function gateGap(u: number, v: number, night: boolean): RGBA {
  const tireHit = Math.hypot(u - 11, v - 4.5) < 4.5 && Math.hypot(u - 11, v - 4.5) > 1.8;
  const bench = (Math.abs(u - 24) < 0.8 || Math.abs(u - 31) < 0.8) && v < 9;
  if (tireHit || bench) return at(RUBBER, 0);
  // De noche, la luz del foco de adentro: más fuerte abajo, donde pega en el piso.
  if (night) return bayer(Math.floor(u), Math.floor(v)) < (v - 2) / 12 ? at(C.fire, 2) : at(C.gold, v < 4 ? 4 : 3);
  return at(C.night, v > 6 ? 0 : 1);
}

/** Puerta chica de lata verde con la pintura saltada, la manija, el ojo de la cerradura y las patadas abajo. */
function smallDoor(u: number, v: number, night: boolean): RGBA {
  const du = u - DOOR.u0;
  const w = DOOR.u1 - DOOR.u0;
  if (du < 1 || du > w - 1 || v > DOOR.top - 1) return at(C.woodDark, 1);
  if (Math.abs(du - (w - 3)) < 1 && Math.abs(v - 12) < 0.8) return at(C.metal, 4);
  if (Math.abs(du - (w - 3)) < 0.5 && Math.abs(v - 10) < 0.5) return at(C.night, 0);
  // Mirilla con luz si es de noche.
  if (Math.hypot(du - w / 2, v - 19) < 1) return night ? at(C.gold, 5) : at(C.sky, 2);
  // Paneles marcados.
  if ((Math.abs(v - 8) < 0.5 || Math.abs(v - 16) < 0.5) && du > 2 && du < w - 2) return at(C.sage, 1);
  const peel = smoothNoise(u, v, 3.5, 11);
  if (peel > 0.72) return at(RUST, peel > 0.8 ? 2 : 3);
  if (peel > 0.66) return at(C.cream, 3);
  if (v < 4 && noise(Math.floor(u), Math.floor(v), 13) > 0.7) return at(C.sage, 1);
  return at(C.sage, 2 + (bayer(Math.floor(u), Math.floor(v)) < 0.1 ? 1 : 0));
}

/** Letrero de tabla pintado a mano sobre el portón: "GARAJE" en letras torcidas. */
const SIGN = { u0: 1, u1: 44, v0: 37, v1: 50 };
function sign(u: number, v: number): RGBA | null {
  if (u < SIGN.u0 || u >= SIGN.u1 || v < SIGN.v0 || v >= SIGN.v1) return null;
  const x = u - SIGN.u0 - 1;
  const y = SIGN.v1 - 1.5 - v;
  const text = "GARAJE";
  const s = 2;
  const li = Math.floor(x / 7);
  const gx = Math.floor((x - li * 7) / s);
  // Cada letra un poco más arriba o abajo (pintadas a pulso).
  const gy = Math.floor((y - (li % 2 ? 0.8 : 0)) / s);
  if (li >= 0 && li < text.length && gx < 3 && gy >= 0 && gy < 5 && glyphOn(text[li]!, gx, gy)) return at(C.cream, 5);
  if (u < SIGN.u0 + 0.8 || u >= SIGN.u1 - 0.8 || v < SIGN.v0 + 0.6 || v >= SIGN.v1 - 0.6) return at(C.woodDark, 1);
  return at(C.curtain, smoothNoise(u, v, 3, 17) > 0.7 ? 1 : 2);
}

/** Frente (+y): bloque, portón, puerta, letrero, el foco y los chorreados de la canaleta rota. */
function front(night: boolean): Tinte {
  return (u, v) => {
    if (v >= HF) return null;
    const s = sign(u, v);
    if (s) return s;
    // Marco de fierro del portón.
    if ((Math.abs(u - GATE.u0 + 0.6) < 0.9 || Math.abs(u - GATE.u1 - 0.6) < 0.9) && v < GATE.top + 1) return at(C.metal, 1);
    if (u >= GATE.u0 && u < GATE.u1 && v < GATE.top) return v < GATE.open ? gateGap(u - GATE.u0, v, night) : gateSlats(u - GATE.u0, v);
    if (u >= DOOR.u0 && u < DOOR.u1 && v < DOOR.top) return smallDoor(u, v, night);
    // Dintel de cemento sobre los vanos.
    if ((u >= GATE.u0 - 2 && u < GATE.u1 + 2 && v >= GATE.top && v < GATE.top + 2) || (u >= DOOR.u0 - 1 && u < DOOR.u1 + 1 && v >= DOOR.top && v < DOOR.top + 1.6))
      return at(C.stone, 3);
    let c = cinderblockWall(u + 7, v);
    // Chorreados de óxido y moho bajo la canaleta rota.
    if (u > 38 && u < 45 && v > 20 && smoothNoise(u * 3, v * 0.3, 2, 19) > 0.45) c = mix(c, at(RUST, 2), 0.45);
    if (u > 57 && v > 26 && smoothNoise(u * 3, v * 0.3, 2, 21) > 0.5) c = mix(c, at(C.sage, 0), 0.4);
    return c;
  };
}

/** Costado este (+x): bloque en sombra, la ventana sucia y el medidor de luz. */
function side(night: boolean): Tinte {
  const W0 = 42;
  const W1 = 60;
  return (u, v) => {
    if (v >= roofZ(Y0 + u)) return null;
    // Ventana: marco de fierro, malla, mugre, un vidrio roto tapado con cartón. De noche, luz tenue.
    if (u >= W0 - 1 && u < W1 + 1 && v >= 13 && v < 31) {
      if (v < 14.5) return at(C.stone, v < 13.8 ? 2 : 4);
      if (u < W0 || u >= W1 || v >= 30) return at(C.metal, 1);
      const mid = (W0 + W1) / 2;
      if (Math.abs(u - mid) < 0.6 || Math.abs(v - 22) < 0.6) return at(C.metal, 2);
      if (u < mid && v < 22) {
        if (Math.abs(v - 18 - (mid - u) * 0.15) < 0.7) return at(C.cream, 3);
        return at(C.cork, 2 + (noise(Math.floor(u), Math.floor(v / 2), 23) < 0.2 ? 1 : 0));
      }
      if ((u - v) % 3 < 0.4 || (u + v) % 3 < 0.4) return at(C.metal, night ? 1 : 2);
      const dirt = (30 - v) / 16 + smoothNoise(u, v, 3, 25) * 0.5;
      const glass = night ? at(C.gold, v > 26 ? 3 : 2) : at(C.sky, v > 25 ? 2 : 1);
      if (bayer(Math.floor(u), Math.floor(v)) < dirt * 0.5) return mix(glass, at(C.dirt, 1), 0.65);
      return glass;
    }
    // Medidor de luz con su tapa de vidrio.
    if (u >= 8 && u < 14 && v >= 20 && v < 28) {
      if (u < 8.8 || u >= 13.2 || v < 20.8 || v >= 27.2) return at(C.metal, 1);
      return Math.hypot(u - 11, v - 24) < 1.6 ? at(C.stone, 4) : at(C.stone, 2);
    }
    // Cable del medidor subiendo al alero.
    if (Math.abs(u - 11) < 0.5 && v >= 28 && v < roofZ(Y0 + u) - 1) return at(RUBBER, 2);
    return mix(cinderblockWall(u + 3, v), at(C.night, 1), 0.28);
  };
}

/** Chapa acanalada: tres láminas a lo ancho, una más nueva que las otras, óxido, hojas y musgo. */
function roofSheet(u: number, v: number): RGBA {
  const sheet = Math.floor(u / 28);
  const k = u % 6;
  // Traslapo entre láminas.
  if (u % 28 < 0.8) return at(ZINC, 0);
  const newer = sheet === 1;
  const rust = newer ? 0 : smoothNoise(u, v, 8, 31 + sheet) + (v < 10 ? 0.15 : 0);
  // Onda de la chapa (corre pendiente abajo): cresta clara, falda y el valle oscuro.
  const base = k < 2 ? 4 : k < 3.5 ? 3 : k < 5 ? 2 : 1;
  let c = rust > 0.62 ? at(RUST, base - (rust > 0.78 ? 1 : 0)) : at(ZINC, base + (newer ? 1 : 0));
  // Hilera de tornillos.
  if (Math.abs(v - 6) < 0.5 || Math.abs(v - 44) < 0.5 || Math.abs(v - 74) < 0.5) if (Math.floor(u) % 10 === 2) c = at(C.metal, 5);
  // Hojas secas y musgo que se juntan en las canaletas de la chapa.
  if (k > 5 && smoothNoise(u, v, 4, 37) > 0.7) c = at(noise(Math.floor(u), Math.floor(v), 39) < 0.5 ? C.cork : C.leaf, 2);
  return c;
}

export function drawGarage(night: boolean): Sprite {
  const s = new Escena({ x0: -6, y0: -6, z0: -2, x1: 86, y1: 86, z1: 70 }, 2);
  s.shadow(X0 - 2, Y0 - 2, X1 - X0 + 12, Y1 - Y0 + 8, 0.3);
  // Sobrecimiento de concreto.
  s.box(X0 - 0.8, Y0 - 0.8, 0, X1 - X0 + 1.6, Y1 - Y0 + 1.6, 2.5, null, (u) => at(C.stone, u % 19 < 0.7 ? 1 : 2), (u) => at(C.stone, u % 23 < 0.7 ? 0 : 1));
  // Paredes.
  s.quad([X0, Y1, 0], [1, 0, 0], [0, 0, 1], X1 - X0, HF, front(night));
  s.quad([X1, Y0, 0], [0, 1, 0], [0, 0, 1], Y1 - Y0, HF, side(night));
  // Caja del rollo del portón (sobresale del frente) y el foco sobre la puerta chica.
  s.box(X0 + GATE.u0 - 1, Y1, GATE.top - 1, GATE.u1 - GATE.u0 + 2, 2.5, 3, (u) => at(ZINC, u % 6 < 0.6 ? 2 : 4), (u) => at(ZINC, smoothNoise(u, 0, 5, 41) > 0.6 ? 2 : 3), () => at(ZINC, 1));
  const bulb = { x: X0 + (DOOR.u0 + DOOR.u1) / 2, z: DOOR.top + 5 };
  s.solid(bulb.x - 0.6, Y1, bulb.z, 1.2, 3.5, 1, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
  s.cone(bulb.x, Y1 + 3, bulb.z - 1.5, 2.4, 2, (_a, _s, luz) => at(ZINC, luz > 0.3 ? 4 : 2));
  s.disc(bulb.x, Y1 + 3, bulb.z - 1.6, 1.1, () => at(C.gold, night ? 5 : 4));
  s.solid(bulb.x - 0.9, Y1 + 2.1, bulb.z - 3.2, 1.8, 1.8, 1.7, at(C.gold, night ? 5 : 4), at(C.gold, night ? 5 : 3), at(C.gold, night ? 4 : 3));
  // Cable del foco hasta el alero.
  for (let z = bulb.z + 1; z < HF; z += 0.3) s.plot(bulb.x + 2 + Math.sin(z) * 0.3, Y1 + 0.3, z, at(RUBBER, 2));
  // Techo de chapa y sus bordes.
  const RX0 = X0 - 3;
  const RX1 = X1 + 3;
  const RY0 = Y0 - 4;
  const RY1 = Y1 + 3;
  s.quad([RX0, RY0, roofZ(RY0) + 1], [1, 0, 0], [0, 1, K], RX1 - RX0, RY1 - RY0, roofSheet);
  s.quad([RX0, RY1, roofZ(RY1) - 1], [1, 0, 0], [0, 0, 1], RX1 - RX0, 2, (u) => at(u % 28 < 0.8 ? ZINC : RUST, 1 + (smoothNoise(u, 0, 4, 43) > 0.5 ? 1 : 0)));
  s.quad([RX1, RY0, roofZ(RY0) - 1], [0, 1, K], [0, 0, 1], RY1 - RY0, 2, (u) => at(ZINC, u % 5 < 1 ? 0 : 1));
  // Canaleta del frente: entera hasta x = 50 y de ahí rota, colgando en diagonal.
  for (let x = RX0; x < RX1; x += 0.3) {
    const broken = x > X0 + 40;
    const drop = broken ? (x - X0 - 40) * 1.1 : 0;
    if (broken && x > X0 + 46) break;
    const z = roofZ(RY1) - 1.5 - drop;
    for (let t = 0; t < 2.2; t += 0.35) s.plot(x, RY1 + 1 + t * 0.4, z + t * 0.3, at(ZINC, t < 0.4 ? 1 : t > 1.8 ? 4 : 3));
  }
  // Ladrillo y una llanta sobre el techo, para que la chapa no se vuele.
  const ty = 30;
  tire(s, 46, ty, roofZ(ty) + 0.5, 6, 3.6, 4);
  s.box(16, 50, roofZ(50) + 0.5, 7, 3.5, 3.2, () => at(C.terracotta, 4), () => at(C.terracotta, 3), () => at(C.terracotta, 2));
  // Al costado este: llantas apiladas, una parada contra la pared y el tambor oxidado.
  standingTire(s, X1 + 5, 34, 7, 4.2);
  tire(s, 73.5, 55, 0, 5.8, 4.2, 1);
  tire(s, 74, 54.4, 4.2, 5.7, 4.2, 3);
  tire(s, 73.3, 55.4, 8.4, 5.6, 4, 6);
  s.cylinder(74.5, 71, 0, 4.6, 15, (a, v, luz) => {
    const k = luz > 0.35 ? 4 : luz > -0.3 ? 3 : 2;
    if (Math.abs(v - 5) < 0.6 || Math.abs(v - 10) < 0.6) return at(C.leaf, k);
    return smoothNoise(a * 4.6, v, 3, 45) > 0.6 ? at(RUST, k - 1) : at(C.leaf, k - 1);
  });
  s.disc(74.5, 71, 15, 4.6, (dx, dy) => (Math.hypot(dx - 1.5, dy + 1) < 1 ? at(C.metal, 4) : at(RUST, 3)));
  // Maleza al pie de las paredes.
  for (let i = 0; i < 60; i++) {
    const onFront = i < 36;
    const x = onFront ? X0 + noise(i, 1, 47) * (X1 - X0) : X1 + 0.6;
    const y = onFront ? Y1 + 0.6 : Y0 + noise(i, 2, 47) * (Y1 - Y0);
    // No delante de los vanos.
    if (onFront && ((x > X0 + GATE.u0 - 1 && x < X0 + GATE.u1 + 1) || (x > X0 + DOOR.u0 - 1 && x < X0 + DOOR.u1 + 1))) continue;
    const h = 1.5 + noise(i, 3, 47) * 3;
    for (let z = 0; z < h; z += 0.4) s.plot(x + (z / h) * (noise(i, 4, 47) - 0.5) * 2, y, z, at(C.grass, z > h * 0.6 ? 4 : 2));
  }
  return s.sprite();
}
