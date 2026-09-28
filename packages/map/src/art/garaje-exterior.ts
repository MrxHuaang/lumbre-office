// El garaje del jardín por fuera (5x5 tiles = 80x80 unidades de arte), pegado al oeste de la torre. Es
// de la misma familia que la casa: troncos sobre una basa de piedra, techo de tejas rojizas a dos aguas
// (con musgo y un par de tejas corridas), el portón de tablas de dos hojas con herrajes oscuros, la
// puerta chica con su farol, el letrero de tabla pintado a mano y, al costado este, la ventana con
// postigos. Se usa poco pero no está abandonado: la pintura gastada, una tabla nueva de un arreglo, la
// hiedra que trepa, el pasto crecido al pie, la llanta apoyada y un barril. De noche se ve la luz de
// adentro por las rendijas del portón y por la ventana. Se registra en outdoor.ts (tiene versión de noche).
import { Escena, type Tinte } from "./exterior-escena";
import { escamas, gableX, lantern, logEnds, logWall, windowAt, type Win } from "./exterior-casa";
import { standingTire, tire } from "./garaje";
import { C, mix } from "./palette";
import { at, bayer, noise, smoothNoise, type RGBA, type Sprite } from "./pixel";
import { glyphOn } from "./room";

/** Paredes (sin el alero). El techo apoya a HW y la cumbrera corre a lo largo de x, al medio. */
const X0 = 3;
const X1 = 66;
const Y0 = 6;
const Y1 = 76;
const HW = 46;
const RIDGE_Y = (Y0 + Y1) / 2;
const SLOPE = 0.4;
const EAVE = 2;
const RIDGE_Z = HW + (Y1 + EAVE - RIDGE_Y) * SLOPE;
/** Alto del techo en y (para cortar el hastial). */
const roofZ = (y: number) => RIDGE_Z - Math.abs(y - RIDGE_Y) * SLOPE;

/** Portón de dos hojas y puerta chica, en `u` a lo largo del frente (desde X0). */
const GATE = { u0: 4, u1: 38, top: 26 };
const DOOR = { u0: 45, u1: 57, top: 25 };
/** La tabla nueva del arreglo (más clara) en la hoja derecha del portón. */
const PATCH = { u0: 29, u1: 33, v0: 5, v1: 17 };

/** Tablas verticales del portón: la veta, la pintura roja gastada que deja ver la madera y los herrajes. */
function gate(u: number, v: number, night: boolean): RGBA {
  const w = GATE.u1 - GATE.u0;
  const mid = w / 2;
  // Rendija entre las dos hojas y abajo: de noche se escapa la luz de adentro.
  if (Math.abs(u - mid) < 0.6 || v < 0.8) return night ? at(C.gold, 4) : at(C.woodDark, 0);
  // Marco y travesaños con la cruz en Z de cada hoja.
  if (u < 1.2 || u > w - 1.2 || v > GATE.top - 1.5) return at(C.woodDark, 2);
  if (Math.abs(v - 4) < 1 || Math.abs(v - 21) < 1) return at(C.woodDark, 3);
  const lu = u < mid ? u : u - mid;
  const diag = 4 + (lu / mid) * 17;
  if (v > 4 && v < 21 && Math.abs(v - diag) < 1.2) return at(C.woodDark, 3);
  // Bisagras largas de fierro oscuro y el pasador al medio.
  if ((Math.abs(v - 6) < 0.8 || Math.abs(v - 19) < 0.8) && (u < 7 || u > w - 7)) return at(C.night, 2);
  if (Math.abs(v - 12.5) < 1 && Math.abs(u - mid) < 3.5) return at(C.night, v > 12.5 ? 3 : 1);
  // La tabla nueva: madera clara, sin pintar.
  if (u >= PATCH.u0 && u < PATCH.u1 && v >= PATCH.v0 && v < PATCH.v1) return at(C.wood, (u - PATCH.u0) % 4 < 0.6 ? 3 : 5);
  // Tablas de 4 con la pintura roja descascarada donde más pega el sol (abajo y en las juntas).
  const k = (u - 1) % 4;
  if (k < 0.6) return at(C.woodDark, 2);
  const worn = smoothNoise(u, v, 4, 5) + (v < 6 ? 0.25 : 0);
  if (worn > 0.72) return at(C.wood, 3 + (noise(Math.floor(u / 4), 1, 7) < 0.5 ? 0 : 1));
  return at(C.curtain, 2 + (noise(Math.floor(u / 4), Math.floor(v / 9), 9) < 0.3 ? -1 : 0) + (k > 3 ? 1 : 0));
}

/** Puerta chica de tablas con la manija de bronce, bisagras oscuras y una ventanita arriba. */
function smallDoor(u: number, v: number, night: boolean): RGBA {
  const du = u - DOOR.u0;
  const w = DOOR.u1 - DOOR.u0;
  if (du < 1 || du > w - 1 || v > DOOR.top - 1) return at(C.woodDark, 1);
  // Ventanita con dos vidrios.
  if (v > 17 && v < 22.5 && du > 3 && du < w - 3) {
    if (Math.abs(du - w / 2) < 0.6) return at(C.woodDark, 2);
    return night ? at(C.gold, v > 20 ? 5 : 4) : mix(at(C.sky, v > 20 ? 3 : 2), at(C.cream, 3), 0.25);
  }
  if (Math.hypot(du - (w - 3), v - 12) < 1) return at(C.gold, 4);
  if ((Math.abs(v - 5) < 0.7 || Math.abs(v - 16) < 0.7) && du < 5) return at(C.night, 2);
  if ((du - 1) % 3.5 < 0.6) return at(C.woodDark, 2);
  return at(C.wood, 2 + (noise(Math.floor(du / 3.5), 0, 11) < 0.5 ? 0 : 1) + (v < 3 ? -1 : 0));
}

/** Letrero de tabla sobre el portón: "GARAJE" en crema, desteñido por el sol. */
const SIGN = { u0: 2.5, u1: 46, v0: 27.5, v1: 39 };
function sign(u: number, v: number): RGBA | null {
  if (u < SIGN.u0 || u >= SIGN.u1 || v < SIGN.v0 || v >= SIGN.v1) return null;
  if (u < SIGN.u0 + 1 || u >= SIGN.u1 - 1 || v < SIGN.v0 + 0.8 || v >= SIGN.v1 - 0.8) return at(C.woodDark, 2);
  const x = u - SIGN.u0 - 0.5;
  const y = SIGN.v1 - 0.5 - v;
  const text = "GARAJE";
  const li = Math.floor(x / 7);
  const gx = Math.floor((x - li * 7 - 0.5) / 2);
  const gy = Math.floor(y / 2);
  const faded = smoothNoise(u, v, 3, 13);
  if (li >= 0 && li < text.length && gx < 3 && gy >= 0 && gy < 5 && glyphOn(text[li]!, gx, gy)) return faded > 0.68 ? at(C.cream, 2) : at(C.cream, 4);
  // Tabla pintada de verde de postigo, gastada hasta la madera en algunas partes.
  if (faded > 0.74) return at(C.wood, 3);
  return at(C.green, 2 + ((v - SIGN.v0) % 3.6 < 0.6 ? -1 : 0));
}

/** Frente (+y): troncos sobre piedra, el portón, la puerta, el letrero y la hiedra. */
function front(night: boolean): Tinte {
  return (u, v) => {
    if (v >= HW) return null;
    const s = sign(u, v);
    if (s) return s;
    // Marco grueso del portón.
    if (u >= GATE.u0 - 2 && u < GATE.u1 + 2 && v < GATE.top + 2 && !(u >= GATE.u0 && u < GATE.u1 && v < GATE.top)) return at(C.woodDark, v >= GATE.top + 1 ? 4 : 2);
    if (u >= GATE.u0 && u < GATE.u1 && v < GATE.top) return gate(u - GATE.u0, v, night);
    if (u >= DOOR.u0 - 1 && u < DOOR.u1 + 1 && v < DOOR.top + 1.5 && !(u >= DOOR.u0 && u < DOOR.u1 && v < DOOR.top)) return at(C.woodDark, 3);
    if (u >= DOOR.u0 && u < DOOR.u1 && v < DOOR.top) return smallDoor(u, v, night);
    return logWall(u + 11, v, 31);
  };
}

/** Costado este (+x): troncos en sombra, la ventana con postigos (un poco empolvada) y el hastial. */
function side(night: boolean): Tinte {
  const win: Win = { u0: 40, u1: 56, v0: 18, v1: 34, kind: "ventana", shutters: true };
  return (u, v) => {
    if (v >= HW) return null;
    const c = windowAt(u, v, win, night);
    if (c) {
      // De día el vidrio junta polvo abajo.
      if (!night && u > win.u0 + 2 && u < win.u1 - 2 && v > win.v0 + 2 && v < win.v1 - 2 && bayer(Math.floor(u), Math.floor(v)) < (win.v1 - v) / 40) return mix(c, at(C.cream, 2), 0.5);
      return c;
    }
    return logWall(u + 5, v, 33, -1);
  };
}

/** Hiedra que trepa desde el pie: tallos que suben ondulando y hojas en manchones. */
function ivy(s: Escena, x: number, y: number, h: number, seed: number, along: "x" | "y") {
  for (let k = 0; k < 3; k++) {
    let off = noise(k, 1, seed) * 6 - 3;
    for (let z = 0; z < h * (0.6 + noise(k, 2, seed) * 0.4); z += 0.5) {
      off += Math.sin(z * 0.35 + k * 2) * 0.35;
      const px = along === "x" ? x + off : x + 0.6;
      const py = along === "x" ? y + 0.6 : y + off;
      s.plot(px, py, z, at(C.logs, 1));
      if (noise(Math.floor(z * 2), k, seed + 3) < 0.55)
        for (const [a, b] of [
          [-1, 0.5],
          [1, 0],
          [0, 1],
        ] as const)
          s.plot(along === "x" ? px + a : px + 0.3, along === "x" ? py + 0.3 : py + a, z + b, at(C.leaf, 2 + ((Math.floor(z) + a) & 1) + (b > 0.8 ? 1 : 0)));
    }
  }
}

export function drawGarage(night: boolean): Sprite {
  const s = new Escena({ x0: -6, y0: -6, z0: -2, x1: 86, y1: 86, z1: 72 }, 2);
  s.shadow(X0 - 2, Y0 - 2, X1 - X0 + 12, Y1 - Y0 + 8, 0.3);
  // Paredes y el hastial este con escamas de madera (el faldón de atrás lo tapa el de adelante).
  s.quad([X0, Y1, 0], [1, 0, 0], [0, 0, 1], X1 - X0, HW, front(night));
  s.quad([X1, Y0, 0], [0, 1, 0], [0, 0, 1], Y1 - Y0, HW, side(night));
  s.quad([X1, Y0 - EAVE, HW], [0, 1, 0], [0, 0, 1], Y1 - Y0 + EAVE * 2, RIDGE_Z - HW, (u, v) => {
    const y = Y0 - EAVE + u;
    if (HW + v > roofZ(y) - 0.5 || y < Y0 || y > Y1) return null;
    // Un ojo de buey para ventilar el entretecho.
    const d = Math.hypot(y - RIDGE_Y, v - 6);
    if (d < 3.2) return d > 2.3 ? at(C.woodDark, 2) : night ? at(C.gold, 3) : at(C.night, 2);
    if (v < 2) return at(C.woodDark, v < 1 ? 1 : 3);
    return escamas(u, v, -1);
  });
  // Puntas de los troncos en la esquina del frente, como la casa.
  logEnds(s, X1, Y1, 16, HW, "x", 7);
  // Letrero: una tabla que sobresale un poco de la pared, colgada de dos clavos.
  s.box(X0 + SIGN.u0, Y1, SIGN.v0, SIGN.u1 - SIGN.u0, 1.2, SIGN.v1 - SIGN.v0, () => at(C.woodDark, 3), (u, v) => sign(u + SIGN.u0, v + SIGN.v0), () => at(C.woodDark, 1));
  // Farol sobre la puerta chica (como los del porche).
  lantern(s, X0 + (DOOR.u0 + DOOR.u1) / 2, Y1 + 3, DOOR.top + 3, night);
  s.solid(X0 + (DOOR.u0 + DOOR.u1) / 2 - 0.5, Y1, DOOR.top + 7, 1, 3, 1, at(C.night, 3), at(C.night, 2), at(C.night, 1));
  // Techo de tejas (el mismo de la casa, con su musgo) y dos tejas corridas en el faldón del frente.
  gableX(s, X0 - 4, X1 + 4, Y0 - EAVE, RIDGE_Y, Y1 + EAVE, RIDGE_Z, SLOPE, 41);
  for (const [x, y] of [
    [22, 58],
    [50, 66],
  ] as const) {
    const z = roofZ(y) + 0.6;
    s.borde = false;
    s.box(x, y, z, 7, 4.5, 1.2, (u, v) => at(C.roof, v > 3.5 ? 5 : 4 - (u < 0.8 ? 1 : 0)), () => at(C.roof, 2), () => at(C.roof, 1));
    // El hueco que dejó: una franja oscura de la teja de abajo.
    for (let k = 0; k < 7; k += 0.4) s.plot(x + k, y - 1.2, roofZ(y - 1.2) + 0.3, at(C.roof, 1));
    s.borde = true;
  }
  // Hiedra en la esquina izquierda del frente y junto a la ventana.
  ivy(s, X0 + 1.5, Y1, HW - 4, 3, "x");
  ivy(s, X1, Y1 - 6, 30, 5, "y");
  // Al costado este: una llanta apoyada, un par acostadas y el barril de madera.
  standingTire(s, X1 + 5, 22, 7, 4.2);
  tire(s, 73.5, 57, 0, 5.8, 4, 1);
  tire(s, 74, 56.4, 4, 5.7, 4, 3);
  s.cylinder(74.5, 70.5, 0, 4.8, 13, (a, v, luz) => {
    if (Math.abs(v - 2.5) < 0.7 || Math.abs(v - 10.5) < 0.7) return at(C.metal, luz > 0 ? 3 : 1);
    if ((a * 4.8) % 2.2 < 0.35) return at(C.woodDark, 2);
    return at(C.wood, luz > 0.4 ? 4 : luz > -0.3 ? 3 : 2);
  });
  s.disc(74.5, 70.5, 13, 4.8, (dx, dy) => (Math.hypot(dx, dy) > 4 ? at(C.wood, 2) : at(C.wood, Math.floor(dx + 10) % 3 === 0 ? 3 : 4)));
  // Una regadera vieja arriba del barril.
  s.solid(73, 69, 13, 3.5, 3, 3, at(C.green, 4), at(C.green, 3), at(C.green, 2));
  // Pasto crecido al pie de las paredes (menos delante del portón y la puerta, que sí se usan).
  for (let i = 0; i < 70; i++) {
    const onFront = i < 42;
    const x = onFront ? X0 + noise(i, 1, 47) * (X1 - X0) : X1 + 0.6;
    const y = onFront ? Y1 + 0.6 : Y0 + noise(i, 2, 47) * (Y1 - Y0);
    if (onFront && ((x > X0 + GATE.u0 - 1 && x < X0 + GATE.u1 + 1) || (x > X0 + DOOR.u0 - 1 && x < X0 + DOOR.u1 + 1))) continue;
    const h = 2 + noise(i, 3, 47) * 4;
    for (let z = 0; z < h; z += 0.4) s.plot(x + (z / h) * (noise(i, 4, 47) - 0.5) * 2, y, z, at(C.grass, z > h * 0.6 ? 4 : 2));
    if (noise(i, 5, 47) < 0.12) s.plot(x, y, h, at(C.gold, 5));
  }
  return s.sprite();
}
