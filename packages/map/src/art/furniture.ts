// Dibujo de cada mueble del catálogo en coordenadas locales de arte (tile = 16), mirando hacia +x
// ("front") o hacia -x ("back"). Las orientaciones "down"/"up" son el espejo horizontal de estas.
import { BOOKS, C, OUT, mix } from "./palette";
import {
  L,
  alpha,
  at,
  bayer,
  flat,
  hex,
  noise,
  renderSprite,
  solidBox,
  type Box,
  type Ramp,
  type RGBA,
  type Shader,
  type Sprite,
} from "./pixel";
import { PAINTING_BASE_TYPE, paintingIdOf } from "@hyvento/shared";
import { catalogItem } from "../world/catalog";
import { DECOR } from "./decor";
import { cushion, leg, shadowSpace, shadowUnder, volume, type Variant } from "./kit";
import { drawOutdoor, hasOutdoor } from "./outdoor";
import { SHOP } from "./shop";
import { CASINO_DRAW } from "./casino";
import { MESAS_DRAW } from "./mesas";
import { CINEMA_DRAW } from "./cinema";
import { CLUB_DRAW } from "./club";
import { EXTERIOR_DRAW } from "./exterior";
import { INTERIOR_DRAW } from "./interior";
import { LEISURE_DRAW } from "./leisure";
import { photoBoard } from "./photos";
import { cuadro } from "./painting";
import { acuario } from "./acuario";
import { RACE_DRAW } from "./race";
import { SOTANO_DRAW } from "./sotano";
import { CASA_DRAW } from "./casa-viva";
import { PLANTAS_DRAW } from "./plantas";
import { PHONE_DRAW } from "./phone";
import { GARAJE_DRAW } from "./garaje";
import { CASA_ARBOL_DRAW } from "./casa-arbol";
import { BUS_DRAW } from "./bus";
import { BUS_INSIDE_DRAW } from "./bus-adentro";
import { AGUA_DRAW } from "./agua";
import { ESCENARIO_DRAW } from "./escenario";
import { PODCAST_DRAW } from "./podcast";
import { GRANJA_DRAW } from "./granja";
import { OBSERVATORIO_DRAW } from "./observatorio";
import { PESCA_DRAW } from "./pesca";
import { CASA_PROPIA_DRAW } from "./casa-propia";
import { CASA_PROPIA_EXTERIOR_DRAW } from "./casa-propia-exterior";
import { BRUJAS_DRAW } from "./brujas";
import { NOVENAS_DRAW } from "./novenas";

export type { Variant } from "./kit";

// ---------- Oficina ----------

const screenShader: Shader = (u, v, fw, fh) => {
  if (u < 1 || u >= fw - 1 || v < 1 || v >= fh - 1) return at(C.metal, 1);
  if (v >= fh - 3) return at(C.screen, 3);
  const lines: [number, number, RGBA][] = [
    [2, 8, at(C.screen, 5)],
    [4, 6, at(C.gold, 4)],
    [4, 9, at(C.rug, 4)],
    [2, 5, at(C.screen, 4)],
  ];
  for (let r = 0; r < lines.length; r++) {
    const [ind, len, col] = lines[r]!;
    const vy = fh - 5 - r * 2;
    if (v >= vy && v < vy + 1 && u >= 2 + ind && u < 2 + ind + len) return col;
  }
  return at(C.screen, 1);
};

function deskPc(): Sprite {
  return renderSprite(
    [
      solidBox({ x: 1, y: 1, z: 0, w: 12, d: 3, h: 12 }, C.woodDark, 3),
      {
        x: 1,
        y: 18,
        z: 0,
        w: 12,
        d: 13,
        h: 12,
        top: flat(at(C.wood, 3)),
        left: flat(at(C.wood, 2)),
        right: (u, v, fw) => {
          if (u < 1 || u >= fw - 1) return at(C.wood, 1);
          if (Math.floor(v) === 4 || Math.floor(v) === 8) return at(C.wood, 1);
          if (Math.abs(u - fw / 2) < 1 && [2, 6, 10].includes(Math.floor(v))) return at(C.gold, 4);
          return at(C.wood, 3);
        },
      },
      {
        x: 0,
        y: 0,
        z: 12,
        w: 15,
        d: 32,
        h: 3,
        top: (u) => at(C.wood, noise(0, Math.floor(u / 6), 2) < 0.5 ? 4 : 5),
        left: flat(at(C.wood, 2)),
        right: (_u, v) => at(C.wood, v >= 2 ? 4 : 3),
      },
      solidBox({ x: 7, y: 10, z: 15, w: 4, d: 11, h: 1 }, C.cream, 3),
      solidBox({ x: 2, y: 14, z: 15, w: 3, d: 4, h: 3 }, C.metal, 3),
      { x: 1, y: 6, z: 18, w: 3, d: 20, h: 13, top: flat(at(C.metal, 3)), left: flat(at(C.metal, 2)), right: screenShader },
      {
        x: 10,
        y: 25,
        z: 15,
        w: 3,
        d: 3,
        h: 4,
        top: flat(at(C.woodDark, 1)),
        left: (_u, v) => (Math.floor(v) === 2 ? at(C.rug, 3) : at(C.cream, 4)),
        right: (_u, v) => (Math.floor(v) === 2 ? at(C.rug, 2) : at(C.cream, 3)),
      },
      volume(10, 25, 19, 3, 3, 8),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 15, 32),
      extra: (c, p) => {
        for (let i = 0; i < 5; i++) {
          const k = p(9, 12 + i * 2, 16);
          c.set(k.x, k.y, at(C.cream, 1));
        }
        const s = p(11.5, 26.5, 20);
        c.set(s.x, s.y - 1, alpha(at(C.cream, 5), 0.8));
        c.set(s.x + 1, s.y - 3, alpha(at(C.cream, 5), 0.6));
        c.set(s.x, s.y - 5, alpha(at(C.cream, 5), 0.4));
      },
    },
  );
}

function bookshelf(): Sprite {
  return renderSprite(
    [
      {
        x: 0,
        y: 0,
        z: 0,
        w: 10,
        d: 32,
        h: 44,
        top: flat(at(C.woodDark, 4)),
        left: (u) => at(C.woodDark, u >= 9 ? 3 : 1),
        right: (u, v, fw, fh) => {
          if (u < 2 || u >= fw - 2 || v >= fh - 2) return at(C.woodDark, u < 1 || v >= fh - 1 ? 5 : 3);
          const s = Math.floor(v / 11);
          const lv = v % 11;
          if (lv < 2) return at(C.woodDark, lv >= 1 ? 5 : 3);
          const col = Math.floor(u - 2);
          const off = Math.floor(noise(s, 1, 5) * 3);
          const id = Math.floor((col + off) / 3);
          const nb = noise(id, s, 9);
          const hb = 5 + Math.floor(noise(id, s, 4) * 4);
          if (nb > 0.1 && lv - 2 < hb) {
            const base = BOOKS[Math.floor(nb * BOOKS.length) % BOOKS.length]!;
            if (nb > 0.7 && Math.floor(lv - 2) === hb - 2) return at(C.gold, 4);
            return (col + off) % 3 === 0 ? mix(base, hex("#ffffff"), 0.25) : base;
          }
          return at(C.woodDark, lv > 8 ? 0 : 1);
        },
      },
    ],
    { outline: OUT, under: shadowUnder(0, 0, 10, 32) },
  );
}

/** Silla de madera con cojín; el respaldo queda del lado contrario a donde mira quien se sienta. */
function chair(variant: Variant): Sprite {
  const back = variant === "back";
  const bx = back ? 12 : 2;
  const post = (y: number): Box => solidBox({ x: bx, y, z: 10, w: 2, d: 2, h: 14 }, C.wood, 3);
  const rest: Box[] = [
    post(2),
    post(12),
    { x: bx, y: 2, z: 20, w: 2, d: 12, h: 4, top: flat(at(C.wood, 5)), left: flat(at(C.wood, 3)), right: flat(at(C.wood, 4)) },
    { x: bx, y: 4, z: 14, w: 2, d: 8, h: 2, top: flat(at(C.wood, 4)), left: flat(at(C.wood, 2)), right: flat(at(C.wood, 3)) },
  ];
  const seat: Box[] = [
    { x: 2, y: 2, z: 8, w: 12, d: 12, h: 2, top: flat(at(C.wood, 4)), left: flat(at(C.wood, 2)), right: flat(at(C.wood, 3)) },
    cushion(back ? 3 : 4, 4, 10, 9, 8, 1, C.sage),
  ];
  const legs = [leg(3, 3, 8, C.wood), leg(11, 3, 8, C.wood), leg(3, 11, 8, C.wood), leg(11, 11, 8, C.wood)];
  return renderSprite(back ? [...legs, ...seat, ...rest] : [...legs, ...rest, ...seat], {
    outline: OUT,
    under: shadowUnder(2, 2, 12, 12),
  });
}

/**
 * Silla de oficina con ruedas (la única que gira): cruz de patas con ruedas, pistón, asiento y
 * respaldo acolchados del color de la oficina. Como la silla, el respaldo va del lado contrario a
 * donde mira quien se sienta.
 */
function officeChair(variant: Variant, tapiz: Ramp = C.rug): Sprite {
  const back = variant === "back";
  const bx = back ? 12 : 2;
  const wheel = (x: number, y: number): Box => solidBox({ x, y, z: 0, w: 2, d: 2, h: 1.5 }, C.night, 3);
  // Las patas en cruz (en iso se ven como la estrella de cinco puntas) con una rueda en cada punta.
  const base: Box[] = [
    wheel(7, 1),
    wheel(1, 7),
    solidBox({ x: 7.5, y: 2.5, z: 1.5, w: 1, d: 11, h: 1 }, C.metal, 2),
    solidBox({ x: 2.5, y: 7.5, z: 1.5, w: 11, d: 1, h: 1 }, C.metal, 2),
    wheel(13, 7),
    wheel(7, 13),
    solidBox({ x: 7, y: 7, z: 2, w: 2, d: 2, h: 6 }, C.metal, 3),
  ];
  const seat: Box[] = [
    solidBox({ x: 3, y: 3, z: 8, w: 10, d: 10, h: 1 }, C.metal, 2),
    cushion(3, 3, 9, 10, 10, 2, tapiz),
  ];
  // Respaldo alto con la barra que lo une al asiento y los apoyabrazos a los lados.
  const rest: Box[] = [
    solidBox({ x: bx, y: 7, z: 9, w: 2, d: 2, h: 5 }, C.metal, 3),
    { x: bx, y: 2, z: 13, w: 2, d: 12, h: 12, top: flat(at(tapiz, 4)), left: flat(at(tapiz, 2)), right: (u, v, fw, fh) => at(tapiz, u < 1 || u >= fw - 1 || v < 1 || v >= fh - 1 ? 2 : 3) },
  ];
  const arm = (y: number): Box[] => [
    solidBox({ x: 7, y, z: 11, w: 1, d: 1, h: 4 }, C.metal, 3),
    solidBox({ x: back ? 5 : 4, y, z: 15, w: 7, d: 1, h: 1 }, C.night, 3),
  ];
  const parts = back ? [...base, ...arm(2), ...seat, ...arm(13), ...rest] : [...base, ...rest, ...arm(2), ...seat, ...arm(13)];
  return renderSprite(parts, { outline: OUT, under: shadowUnder(2, 2, 12, 12) });
}

function stool(): Sprite {
  return renderSprite(
    [
      leg(4, 4, 11),
      leg(10, 4, 11),
      solidBox({ x: 5, y: 5, z: 5, w: 6, d: 6, h: 1 }, C.woodDark, 3),
      leg(4, 10, 11),
      leg(10, 10, 11),
      cushion(3, 3, 11, 10, 10, 3, C.rug),
    ],
    { outline: OUT, under: shadowUnder(3, 3, 10, 10) },
  );
}

function armchair(variant: Variant): Sprite {
  const back = variant === "back";
  const r = C.green;
  const rest: Box = {
    x: back ? 11 : 1,
    y: 1,
    z: 8,
    w: 4,
    d: 14,
    h: 13,
    top: flat(at(r, 3)),
    left: flat(at(r, 1)),
    right: (_u, v, _fw, fh) => at(r, v >= fh - 2 ? 3 : 2),
  };
  const arm = (y: number) => cushion(1, y, 8, 14, 3, 6, r);
  const body: Box = { x: 1, y: 1, z: 2, w: 14, d: 14, h: 6, top: flat(at(r, 2)), left: flat(at(r, 1)), right: flat(at(r, 2)) };
  const seat = cushion(back ? 2 : 5, 4, 8, 9, 8, 2, r);
  const legs = [leg(2, 2, 2), leg(12, 2, 2), leg(2, 12, 2), leg(12, 12, 2)];
  const parts = back ? [...legs, arm(1), body, seat, rest, arm(12)] : [...legs, arm(1), rest, body, seat, arm(12)];
  return renderSprite(parts, { outline: OUT, under: shadowUnder(1, 1, 14, 14) });
}

/** Brazo de sofá: tapa acolchada más clara y costura a media altura. */
const sofaArm = (y: number, f: Ramp = C.fabric): Box => ({
  x: 0,
  y,
  z: 2,
  w: 16,
  d: 4,
  h: 13,
  top: (u, v, fw, fh) => at(f, u < 1 || u >= fw - 1 || v < 1 || v >= fh - 1 ? 3 : 4),
  left: (_u, v, _fw, fh) => at(f, v >= fh - 1 ? 3 : Math.floor(v) === 6 ? 1 : 2),
  right: (_u, v, _fw, fh) => at(f, v >= fh - 1 ? 2 : Math.floor(v) === 6 ? 0 : 1),
});

/**
 * Sofá de dos cuerpos: el respaldo va entre los brazos y todo se apoya en patas. `f` es la tela y
 * `pillowR` el cojín (el de terciopelo del sótano es violeta con cojín dorado y patas doradas).
 */
function sofa(variant: Variant, f: Ramp = C.fabric, pillowR: Ramp = C.mustard, legR: Ramp = C.woodDark): Sprite {
  const back = variant === "back";
  const restX = back ? 11 : 0;
  const backCushX = back ? 7 : 5;
  const seatX = back ? 0 : 8;
  const base: Box = { x: back ? 0 : 5, y: 4, z: 2, w: 11, d: 24, h: 6, top: flat(at(f, 2)), left: flat(at(f, 1)), right: flat(at(f, 2)) };
  const rest: Box = {
    x: restX,
    y: 4,
    z: 2,
    w: 5,
    d: 24,
    h: 17,
    top: (u, v, fw, fh) => at(f, u < 1 || v < 1 || u >= fw - 1 || v >= fh - 1 ? 2 : 3),
    left: flat(at(f, 1)),
    right: (_u, v, _fw, fh) => at(f, v >= fh - 1 ? 2 : 1),
  };
  const backCush = [cushion(backCushX, 5, 8, 4, 11, 10, f), cushion(backCushX, 16, 8, 4, 11, 10, f)];
  const seat = [cushion(seatX, 5, 8, 8, 11, 3, f), cushion(seatX, 16, 8, 8, 11, 3, f)];
  const pillow = cushion(back ? 3 : 9, 21, 11, 4, 6, 6, pillowR);
  const backLegs = [leg(1, 1, 2, legR), leg(13, 1, 2, legR)];
  const frontLegs = [leg(1, 29, 2, legR), leg(13, 29, 2, legR)];
  const middle = back ? [base, ...seat, pillow, ...backCush, rest] : [rest, base, ...backCush, ...seat, pillow];
  return renderSprite([...backLegs, sofaArm(0, f), ...middle, frontLegs[0]!, sofaArm(28, f), frontLegs[1]!], {
    outline: OUT,
    under: shadowUnder(0, 0, 16, 32),
  });
}

/** Banca de jardín de listones. */
function bench(variant: Variant): Sprite {
  const back = variant === "back";
  const slat = (x: number): Box => ({ x, y: 1, z: 8, w: 3, d: 30, h: 2, top: flat(at(C.wood, 4)), left: flat(at(C.wood, 2)), right: flat(at(C.wood, 3)) });
  const seat = back ? [slat(1), slat(5), slat(9)] : [slat(4), slat(8), slat(12)];
  const bx = back ? 13 : 1;
  const rest: Box[] = [
    solidBox({ x: bx, y: 2, z: 10, w: 2, d: 2, h: 12 }, C.woodDark, 3),
    solidBox({ x: bx, y: 28, z: 10, w: 2, d: 2, h: 12 }, C.woodDark, 3),
    { x: bx, y: 1, z: 15, w: 2, d: 30, h: 2, top: flat(at(C.wood, 4)), left: flat(at(C.wood, 2)), right: flat(at(C.wood, 3)) },
    { x: bx, y: 1, z: 19, w: 2, d: 30, h: 2, top: flat(at(C.wood, 5)), left: flat(at(C.wood, 2)), right: flat(at(C.wood, 3)) },
  ];
  const legs = [leg(3, 2, 8), leg(12, 2, 8), leg(3, 28, 8), leg(12, 28, 8)];
  return renderSprite(back ? [...legs, ...seat, ...rest] : [...legs, ...rest, ...seat], {
    outline: OUT,
    under: shadowUnder(1, 1, 14, 30),
  });
}

function plant(): Sprite {
  return renderSprite(
    [
      {
        x: 4,
        y: 4,
        z: 0,
        w: 9,
        d: 9,
        h: 10,
        top: flat(at(C.woodDark, 1)),
        left: (_u, v) => at(C.terracotta, Math.floor(v) === 5 ? 1 : 3),
        right: (_u, v) => at(C.terracotta, Math.floor(v) === 5 ? 0 : 2),
      },
      solidBox({ x: 3, y: 3, z: 10, w: 11, d: 11, h: 2 }, C.terracotta, 3),
      volume(-6, -6, 12, 28, 28, 40),
    ],
    {
      outline: OUT,
      under: shadowUnder(3, 3, 11, 11),
      extra: (c, p) => {
        const base = p(8.5, 8.5, 12);
        c.rect(base.x - 1, base.y - 1, 2, 2, at(C.woodDark, 1));
        // Hojas de abajo hacia arriba: [dx, dy, rx, ry], cada una con tallo, sombra, luz y nervadura.
        const leaves: [number, number, number, number][] = [
          [-8, -6, 4.5, 3],
          [8, -7, 4.5, 3],
          [-10, -13, 4, 3],
          [10, -14, 4, 3],
          [-5, -16, 5, 3.5],
          [5, -18, 5, 3.5],
          [-8, -23, 4.5, 3],
          [8, -25, 4.5, 3],
          [0, -24, 5, 3.5],
          [-3, -30, 4.5, 3],
          [4, -32, 4.5, 3],
          [0, -37, 4, 3],
        ];
        for (const [dx, dy] of leaves) c.line(base.x, base.y - 2, base.x + dx * 0.7, base.y + dy + 1, at(C.leaf, 1));
        for (const [dx, dy, rx, ry] of leaves) {
          const x = base.x + dx;
          const y = base.y + dy;
          c.ellipse(x + 1, y + 1, rx, ry, at(C.leaf, 1));
          c.ellipse(x, y, rx, ry, at(C.leaf, noise(dx, dy, 3) < 0.5 ? 3 : 2));
          c.ellipse(x - 1.2, y - 0.8, rx * 0.55, ry * 0.5, at(C.leaf, 4));
          c.line(x - rx + 1.5, y + ry - 1.5, x + rx - 1.5, y - ry + 1.5, at(C.leaf, 1));
          c.set(x - 2, y - 1, at(C.leaf, 5));
        }
      },
    },
  );
}

function lamp(): Sprite {
  return renderSprite(
    [
      solidBox({ x: 5, y: 5, z: 0, w: 6, d: 6, h: 2 }, C.metal, 3),
      solidBox({ x: 7, y: 7, z: 2, w: 2, d: 2, h: 30 }, C.gold, 3),
      {
        x: 3,
        y: 3,
        z: 30,
        w: 10,
        d: 10,
        h: 9,
        top: flat(at(C.gold, 5)),
        left: (_u, v) => at(C.cream, v < 1 ? 2 : 4),
        right: (_u, v) => at(C.cream, v < 1 ? 1 : 3),
      },
    ],
    { outline: OUT, under: shadowUnder(4, 4, 8, 8) },
  );
}

function coffeeTable(): Sprite {
  return renderSprite(
    [
      leg(2, 2, 7),
      leg(12, 2, 7),
      leg(2, 12, 7),
      leg(12, 12, 7),
      {
        x: 1,
        y: 1,
        z: 7,
        w: 14,
        d: 14,
        h: 2,
        top: (_u, v) => at(C.woodDark, noise(0, Math.floor(v / 5), 3) < 0.5 ? 4 : 5),
        left: flat(at(C.woodDark, 2)),
        right: flat(at(C.woodDark, 3)),
      },
      solidBox({ x: 3, y: 3, z: 9, w: 6, d: 7, h: 2 }, C.rug, 3),
      { x: 10, y: 10, z: 9, w: 3, d: 3, h: 4, top: flat(at(C.woodDark, 1)), left: flat(at(C.cream, 4)), right: flat(at(C.cream, 3)) },
    ],
    { outline: OUT, under: shadowUnder(1, 1, 14, 14) },
  );
}

function cafeTable(): Sprite {
  const topShade = (u: number, v: number) => at(C.cream, (Math.floor(u) + Math.floor(v)) % 6 === 0 ? 3 : 4);
  return renderSprite(
    [
      solidBox({ x: 4, y: 4, z: 0, w: 8, d: 8, h: 1 }, C.metal, 2),
      solidBox({ x: 7, y: 7, z: 1, w: 2, d: 2, h: 10 }, C.metal, 3),
      { x: 1, y: 4, z: 11, w: 14, d: 8, h: 2, top: topShade, left: flat(at(C.cream, 2)), right: flat(at(C.cream, 3)) },
      { x: 4, y: 1, z: 11, w: 8, d: 14, h: 2, top: topShade, left: flat(at(C.cream, 2)), right: flat(at(C.cream, 3)) },
      solidBox({ x: 7, y: 7, z: 13, w: 2, d: 2, h: 4 }, C.sky, 3),
      shadowSpace(1, 1, 14, 14),
    ],
    {
      outline: OUT,
      under: shadowUnder(1, 1, 14, 14),
      extra: (c, p) => {
        // Florcita en el florero.
        const f = p(8, 8, 18);
        c.set(f.x, f.y, at(C.leaf, 3));
        c.set(f.x, f.y - 1, at(C.rug, 4));
        c.set(f.x - 1, f.y - 2, at(C.rug, 4));
        c.set(f.x + 1, f.y - 2, at(C.rug, 4));
        c.set(f.x, f.y - 2, at(C.gold, 5));
      },
    },
  );
}

function meetingTable(): Sprite {
  return renderSprite(
    [
      leg(3, 3, 12),
      leg(27, 3, 12),
      leg(3, 43, 12),
      leg(27, 43, 12),
      {
        x: 2,
        y: 2,
        z: 12,
        w: 28,
        d: 44,
        h: 3,
        top: (u, v, fw, fh) =>
          u < 1 || v < 1 || u >= fw - 1 || v >= fh - 1 ? at(C.wood, 3) : at(C.wood, noise(Math.floor(u / 7), 0, 4) < 0.5 ? 4 : 5),
        left: flat(at(C.wood, 2)),
        right: (_u, v) => at(C.wood, v >= 2 ? 4 : 3),
      },
      // Papeles y una laptop.
      solidBox({ x: 8, y: 10, z: 15, w: 8, d: 6, h: 1 }, C.white, 3),
      solidBox({ x: 18, y: 30, z: 15, w: 7, d: 9, h: 1 }, C.metal, 3),
      { x: 18, y: 30, z: 16, w: 2, d: 9, h: 6, top: flat(at(C.metal, 3)), left: flat(at(C.metal, 2)), right: screenShader },
      solidBox({ x: 10, y: 34, z: 15, w: 3, d: 3, h: 4 }, C.cream, 3),
    ],
    { outline: OUT, under: shadowUnder(2, 2, 28, 44) },
  );
}

// ---------- Cafetería ----------

const counterBody = (): Box[] => [
  {
    x: 0,
    y: 0,
    z: 0,
    w: 12,
    d: 16,
    h: 16,
    top: flat(at(C.wood, 3)),
    left: flat(at(C.wood, 2)),
    // Frente con paneles verticales y zócalo oscuro.
    right: (u, v) => {
      if (v < 2) return at(C.woodDark, 2);
      if (v >= 14) return at(C.wood, 1);
      const k = Math.floor(u) % 8;
      if (k === 0) return at(C.wood, 1);
      if (k === 1) return at(C.wood, 4);
      return at(C.wood, 3);
    },
  },
  {
    x: 0,
    y: 0,
    z: 16,
    w: 14,
    d: 16,
    h: 2,
    top: (u, v) => at(C.cream, noise(Math.floor(u / 3), Math.floor(v / 3), 6) < 0.15 ? 3 : 4),
    left: flat(at(C.cream, 2)),
    right: flat(at(C.cream, 3)),
  },
];

function counter(): Sprite {
  return renderSprite(counterBody(), { outline: OUT });
}

function counterCoffee(): Sprite {
  return renderSprite(
    [
      ...counterBody(),
      // Cafetera espresso.
      solidBox({ x: 2, y: 3, z: 18, w: 7, d: 10, h: 12 }, C.metal, 4),
      { x: 2, y: 3, z: 30, w: 7, d: 10, h: 2, top: flat(at(C.metal, 3)), left: flat(at(C.metal, 2)), right: flat(at(C.metal, 3)) },
      solidBox({ x: 9, y: 6, z: 22, w: 2, d: 2, h: 3 }, C.metal, 2),
      solidBox({ x: 9, y: 9, z: 18, w: 3, d: 3, h: 3 }, C.cream, 3),
      volume(2, 3, 32, 7, 10, 6),
    ],
    {
      outline: OUT,
      extra: (c, p) => {
        const g = p(9, 6, 28);
        c.set(g.x, g.y, at(C.gold, 4));
        const s = p(10, 10, 22);
        c.set(s.x, s.y - 1, alpha(at(C.cream, 5), 0.7));
        c.set(s.x - 1, s.y - 3, alpha(at(C.cream, 5), 0.5));
      },
    },
  );
}

function pastryCase(): Sprite {
  const glass: Shader = (u, v, fw, fh) => {
    if (u < 1 || u >= fw - 1 || v >= fh - 1) return at(C.metal, 3);
    if (Math.abs(u - v * 0.8 - 2) < 0.8) return alpha(at(C.white, 4), 0.7);
    return alpha(at(C.sky, 4), 0.35);
  };
  return renderSprite(
    [
      ...counterBody(),
      // Pasteles adentro de la vitrina.
      solidBox({ x: 3, y: 2, z: 18, w: 5, d: 5, h: 4 }, C.rose, 4),
      solidBox({ x: 3, y: 9, z: 18, w: 5, d: 5, h: 3 }, C.mustard, 3),
      solidBox({ x: 3, y: 5, z: 22, w: 4, d: 6, h: 2 }, C.wood, 4),
      { x: 1, y: 1, z: 18, w: 11, d: 14, h: 9, top: glass, left: glass, right: glass },
    ],
    { outline: OUT },
  );
}

function fireplace(): Sprite {
  const stone: Shader = (u, v) => {
    const row = Math.floor(v / 4);
    const off = row % 2 ? 3 : 0;
    if (Math.floor(v) % 4 === 0 || (Math.floor(u) + off) % 6 === 0) return at(C.stone, 1);
    return at(C.stone, 2 + Math.floor(noise(Math.floor((u + off) / 6), row, 3) * 2));
  };
  return renderSprite(
    [
      { x: 0, y: 0, z: 0, w: 13, d: 32, h: 3, top: stone, left: stone, right: stone },
      {
        x: 0,
        y: 2,
        z: 3,
        w: 8,
        d: 28,
        h: 26,
        top: stone,
        left: stone,
        // Boca de la chimenea con fuego.
        right: (u, v, fw) => {
          const cu = u - fw / 2;
          const inside = Math.abs(cu) < 8 && v < 16 - (Math.abs(cu) > 5 ? (Math.abs(cu) - 5) * 2 : 0);
          if (!inside) return stone(u, v, fw, 26);
          const flame = 12 - Math.abs(cu) * 1.3 + noise(Math.floor(u), 0, 7) * 3;
          if (v < 2) return at(C.woodDark, 2);
          if (v < flame * 0.35) return at(C.fire, 4);
          if (v < flame * 0.65) return at(C.fire, 3);
          if (v < flame) return at(C.fire, 2);
          return at(C.woodDark, 0);
        },
      },
      {
        x: 0,
        y: 0,
        z: 29,
        w: 10,
        d: 32,
        h: 3,
        top: flat(at(C.wood, 4)),
        left: flat(at(C.wood, 2)),
        right: flat(at(C.wood, 3)),
      },
      { x: 0, y: 7, z: 32, w: 6, d: 18, h: 24, top: stone, left: stone, right: stone },
      solidBox({ x: 3, y: 9, z: 32, w: 3, d: 3, h: 5 }, C.gold, 3),
      solidBox({ x: 3, y: 20, z: 32, w: 3, d: 3, h: 4 }, C.sage, 3),
    ],
    { outline: OUT },
  );
}

// ---------- Alfombras ----------

function rugShader(r: Ramp, accent: Ramp): Shader {
  return (u, v, fw, fh) => {
    const e = Math.min(u, v, fw - 1 - u, fh - 1 - v);
    if (e < 1) return at(r, 0);
    if (e < 3) return at(r, 1);
    if (e < 5) return at(accent, (Math.floor(u) + Math.floor(v)) % 4 < 2 ? 3 : 4);
    const cu = u - fw / 2;
    const cv = v - fh / 2;
    const m = Math.abs(cu) / (fw * 0.3) + Math.abs(cv) / (fh * 0.3);
    if ((m > 0.86 && m < 1) || (m > 0.42 && m < 0.52)) return at(accent, 3);
    if (m < 0.2) return at(C.gold, 4);
    if (Math.floor(u + v) % 10 === 0 || Math.floor(u - v + 480) % 10 === 0) return at(r, 3);
    return at(r, 2 + (bayer(Math.floor(u), Math.floor(v)) < 0.12 ? 1 : 0));
  };
}

function rug(w: number, d: number, r: Ramp, accent: Ramp): Sprite {
  const s = rugShader(r, accent);
  return renderSprite([{ x: 0.5, y: 0.5, z: 0, w: w * L - 1, d: d * L - 1, h: 1, top: s, left: flat(at(r, 0)), right: flat(at(r, 0)) }], {
    outline: OUT,
  });
}

// ---------- Escaleras ----------

/** Escalera que sube hacia -y (el escalón más bajo queda en y alto). Mide 2x3 tiles. */
function stairsUp(): Sprite {
  const steps: Box[] = [];
  const n = 6;
  for (let i = n - 1; i >= 0; i--) {
    const y = 48 - 8 * (i + 1);
    steps.push({
      x: 1,
      y,
      z: 0,
      w: 28,
      d: 8,
      h: 8 * (i + 1),
      top: (_u, v) => at(C.wood, v >= 6 ? 5 : 4),
      left: (_u, v, _fw, fh) => at(C.wood, v >= fh - 1 ? 3 : 2),
      right: flat(at(C.woodDark, 3)),
    });
  }
  // Baranda del lado abierto.
  const rail: Box[] = [];
  for (let i = 0; i < n; i += 2) rail.push(solidBox({ x: 28, y: 48 - 8 * (i + 1) + 3, z: 8 * (i + 1), w: 2, d: 2, h: 12 }, C.woodDark, 4));
  return renderSprite([...steps, ...rail], {
    outline: OUT,
    extra: (c, p) => {
      const a = p(29, 45, 20);
      const b = p(29, 3, 60);
      c.line(a.x, a.y, b.x, b.y, at(C.wood, 5));
      c.line(a.x, a.y + 1, b.x, b.y + 1, at(C.woodDark, 2));
    },
  });
}

/**
 * Hueco de escalera que baja hacia -y (se entra por +y). Marco de madera al ras del piso, escalones
 * que se oscurecen hacia el fondo con la sombra de las paredes del hueco, y barandas a los costados.
 */
function stairwell(): Sprite {
  const W = 32;
  const D = 48;
  const FRAME = 2;
  const opening: Shader = (u, v) => {
    // Marco de madera alrededor del hueco (menos en la entrada).
    if (u < FRAME || u >= W - FRAME || v < FRAME) return at(C.woodDark, u < 1 || u >= W - 1 || v < 1 ? 2 : 4);
    const depth = (D - v) / 8;
    const k = Math.floor(depth);
    const inStep = (D - v) % 8;
    // Contrahuella oscura al final de cada escalón; más abajo, más oscuro.
    let c = inStep < 1.5 ? mix(at(C.wood, 2), at(C.woodDark, 0), 0.55) : at(C.wood, inStep > 6 ? 5 : 4);
    c = mix(c, at(C.woodDark, 0), Math.min(0.85, k * 0.14));
    // Sombra de la pared izquierda del hueco sobre los escalones.
    const side = u - FRAME;
    if (side < 3 + k * 0.6) c = mix(c, at(C.woodDark, 0), 0.45);
    return c;
  };
  const post = (x: number, y: number, h = 16): Box[] => [
    solidBox({ x, y, z: 0, w: 3, d: 3, h }, C.woodDark, 4),
    solidBox({ x: x - 0.5, y: y - 0.5, z: h, w: 4, d: 4, h: 2 }, C.wood, 4),
  ];
  const rail = (x: number): Box => ({
    x,
    y: 1,
    z: 13,
    w: 2,
    d: D - 2,
    h: 2,
    top: flat(at(C.wood, 5)),
    left: flat(at(C.wood, 3)),
    right: flat(at(C.wood, 4)),
  });
  const balusters = (x: number): Box[] => [10, 18, 26, 34].map((y) => solidBox({ x: x + 0.5, y, z: 0, w: 1, d: 1, h: 13 }, C.woodDark, 3));
  return renderSprite(
    [
      { x: 0, y: 0, z: -1, w: W, d: D, h: 1, top: opening, left: flat(at(C.woodDark, 2)), right: flat(at(C.woodDark, 2)) },
      ...balusters(0),
      rail(0),
      ...post(-0.5, 2),
      ...post(-0.5, D - 3),
      ...balusters(W - 2),
      rail(W - 2),
      ...post(W - 2.5, 2),
      ...post(W - 2.5, D - 3),
    ],
    { outline: OUT },
  );
}

// ---------- Registro ----------

const DRAW: Record<string, (v: Variant) => Sprite> = {
  "desk-pc": deskPc,
  chair,
  "office-chair": (v) => officeChair(v),
  "office-chair-mustard": (v) => officeChair(v, C.mustard),
  "office-chair-blue": (v) => officeChair(v, C.blue),
  "office-chair-rose": (v) => officeChair(v, C.rose),
  "office-chair-sage": (v) => officeChair(v, C.sage),
  stool,
  armchair,
  sofa: (v) => sofa(v),
  "lounge-sofa": (v) => sofa(v, C.violet, C.gold, C.gold),
  bench,
  bookshelf,
  plant,
  lamp,
  "coffee-table": coffeeTable,
  "cafe-table": cafeTable,
  "meeting-table": meetingTable,
  counter,
  "counter-coffee": counterCoffee,
  "pastry-case": pastryCase,
  fireplace,
  "rug-3x3": () => rug(3, 3, C.rug, C.cream),
  "rug-2x3": () => rug(2, 3, C.green, C.cream),
  "stairs-up": stairsUp,
  stairwell,
  ...DECOR,
  ...SHOP,
  ...CASINO_DRAW,
  ...MESAS_DRAW,
  ...CLUB_DRAW,
  ...CINEMA_DRAW,
  ...LEISURE_DRAW,
  ...EXTERIOR_DRAW,
  ...INTERIOR_DRAW,
  ...SOTANO_DRAW,
  ...CASA_DRAW,
  ...PLANTAS_DRAW,
  ...GARAJE_DRAW,
  ...CASA_ARBOL_DRAW,
  ...BUS_DRAW,
  ...BUS_INSIDE_DRAW,
  ...ESCENARIO_DRAW,
  ...PODCAST_DRAW,
  ...GRANJA_DRAW,
  ...OBSERVATORIO_DRAW,
  ...PESCA_DRAW,
  ...CASA_PROPIA_DRAW,
  ...CASA_PROPIA_EXTERIOR_DRAW,
  ...BRUJAS_DRAW,
  ...NOVENAS_DRAW,
  "photo-board": photoBoard,
  cuadro,
  acuario,
  ...RACE_DRAW,
  ...AGUA_DRAW,
  ...PHONE_DRAW,
};

const cache = new Map<string, Sprite>();

/**
 * Sprite de un mueble (cacheado): en coordenadas locales de arte, con el origen del mueble en (ox, oy).
 * `night` solo cambia algo en lo que tiene versión nocturna (la cabaña con las ventanas encendidas).
 */
export function drawFurniture(type: string, variant: Variant = "front", night = false): Sprite {
  // Todos los cuadros de la Pintura (`cuadro:<id>`) comparten el marco; los píxeles van en otra capa.
  if (paintingIdOf(type)) type = PAINTING_BASE_TYPE;
  const draw = DRAW[type];
  const key = draw ? `${type}:${variant}` : `${type}:${variant}:${night ? "noche" : "dia"}`;
  let s = cache.get(key);
  if (!s) {
    s = draw ? draw(variant) : hasOutdoor(type) ? drawOutdoor(type, night) : placeholder(type);
    cache.set(key, s);
  }
  return s;
}

/** Si el tipo tiene dibujo propio (si no, sale la caja rosada provisoria). */
export function hasDrawing(type: string): boolean {
  if (paintingIdOf(type)) return true;
  return type in DRAW || hasOutdoor(type);
}

/**
 * Red de seguridad para un mueble del catálogo que todavía no tiene dibujo: una caja rosada de su
 * tamaño (se nota a propósito). El test del arte exige que ningún tipo del catálogo caiga aquí.
 */
function placeholder(type: string): Sprite {
  const [w, d] = catalogItem(type).size;
  return renderSprite([solidBox({ x: 1, y: 1, z: 0, w: w * 16 - 2, d: d * 16 - 2, h: 12 }, C.rug, 3)], {
    outline: OUT,
    under: shadowUnder(1, 1, w * 16 - 2, d * 16 - 2),
  });
}
