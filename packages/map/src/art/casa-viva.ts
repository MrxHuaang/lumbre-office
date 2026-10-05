// Casa viva: los muebles nuevos (la escalera del balcón al jardín, la radio, las camas de las mascotas y
// la casita del perro). Mismo estilo que interior.ts: cajas con shaders por cara, contorno café y la luz
// desde arriba a la izquierda, mirando hacia +x.
import { C, OUT, mix } from "./palette";
import { at, flat, hex, noise, ramp, renderSprite, solidBox, type Box, type Ramp, type Shader, type Sprite } from "./pixel";
import { leg, roundShadow, shadowUnder, volume } from "./kit";

/** Baquelita verde agua de la radio. */
const MINT: Ramp = ramp("#2a4741", "#3d675d", "#578d80", "#7cb09f", "#a6d0bf", "#d4eee2");

/** Tabla con veta a lo largo de `u` y el canto claro. */
const plank =
  (r: Ramp, every = 5): Shader =>
  (u, v, _fw, fh) => {
    if (v < 0.8 || v >= fh - 0.8) return at(r, 3);
    return at(r, noise(Math.floor(u / every), Math.floor(v), 13) < 0.35 ? 3 : 4);
  };

// ---------- Escalera del balcón ----------

/**
 * La salida del balcón a la escalera exterior: dos postes como los de la baranda (el hueco entre ellos
 * es por donde se baja) y la escalera de madera que baja hacia +x, fuera del balcón, con sus zancas y el
 * pasamanos a los dos lados.
 */
function balconyStair(): Sprite {
  const w = C.wood;
  const STEPS = 6;
  const RUN = 5.5;
  const RISE = 4.2;
  const X0 = 15;
  const boxes: Box[] = [];
  // Zanca de atrás (lado -y): tablas cortas escalonadas que siguen la pendiente.
  const stringer = (y: number) => {
    for (let k = 0; k < STEPS * 2; k++) {
      const x = X0 + (k * RUN) / 2;
      const z = -((k + 1) * RISE) / 2 - 3;
      boxes.push({ x, y, z, w: RUN / 2 + 0.3, d: 1.4, h: 4, top: flat(at(C.woodDark, 4)), left: flat(at(C.woodDark, 3)), right: flat(at(C.woodDark, 2)) });
    }
  };
  const rail = (y: number) => {
    // Pasamanos: baja desde el poste del balcón hasta el último escalón, con postes cada dos escalones.
    for (let k = 0; k <= STEPS * 4; k++) {
      const x = X0 - 1 + (k * RUN) / 4;
      const z = 16 - (k * RISE) / 4;
      boxes.push({ x, y: y - 0.2, z, w: RUN / 4 + 0.4, d: 1.8, h: 1.4, top: flat(at(w, 5)), left: flat(at(w, 3)), right: flat(at(w, 4)) });
    }
    for (const i of [2, 4, 6]) {
      const x = X0 + i * RUN - 1.5;
      const top = 16 - (i * RISE) - 0.5;
      const bottom = -(i * RISE);
      boxes.push(solidBox({ x, y, z: bottom, w: 1.6, d: 1.6, h: top - bottom }, C.woodDark, 4));
    }
  };
  const post = (y: number) => [
    solidBox({ x: 13, y, z: 0, w: 2.2, d: 2.2, h: 17 }, C.woodDark, 4),
    solidBox({ x: 12.7, y: y - 0.3, z: 17, w: 2.8, d: 2.8, h: 1.2 }, w, 5),
  ];
  stringer(0.6);
  rail(0.4);
  boxes.push(...post(0));
  // Escalones: de arriba (atrás) hacia abajo (adelante), huella clara con el canto gastado.
  for (let i = 0; i < STEPS; i++) {
    const x = X0 + i * RUN;
    const z = -(i + 1) * RISE;
    boxes.push({
      x,
      y: 1.8,
      z: z - 1.4,
      w: RUN + 0.4,
      d: 12.4,
      h: 1.4,
      top: (u, v, fw) => at(w, u > fw - 1 ? 5 : noise(i, Math.floor(v / 4), 3) < 0.3 ? 3 : 4),
      left: flat(at(w, 2)),
      right: flat(at(w, 3)),
    });
  }
  stringer(14.2);
  boxes.push(...post(13.8));
  rail(14.2);
  return renderSprite(boxes, { outline: OUT });
}

// ---------- Radio ----------

/** Mesita con una radio de baquelita: parlante con rejilla, el dial iluminado, dos perillas y la antena. */
function radio(): Sprite {
  const wd = C.woodDark;
  const front: Shader = (u, v, fw, fh) => {
    // Cara +x: u de izquierda a derecha en pantalla (desde el borde +y), v de abajo hacia arriba.
    if (v < 0.9 || v >= fh - 0.9 || u < 0.8 || u >= fw - 0.8) return at(MINT, 2);
    // Parlante a la izquierda: rejilla de rayas horizontales.
    if (u < fw * 0.5) return Math.floor(v) % 2 === 0 ? at(C.cream, 2) : at(MINT, 1);
    // Dial arriba a la derecha (cálido) y dos perillas abajo.
    if (v > fh * 0.55) return u > fw - 1.8 || v > fh - 1.6 ? at(C.gold, 2) : Math.floor(u) % 2 ? at(C.gold, 4) : at(C.gold, 5);
    const knob = Math.hypot(u - fw * 0.66, v - 1.9) < 0.9 || Math.hypot(u - fw * 0.88, v - 1.9) < 0.9;
    return knob ? at(C.cream, 5) : at(MINT, 3);
  };
  return renderSprite(
    [
      // La mesita.
      leg(3, 3, 9),
      leg(11, 3, 9),
      leg(3, 11, 9),
      leg(11, 11, 9),
      solidBox({ x: 3.5, y: 3.5, z: 3, w: 9, d: 9, h: 1 }, wd, 3),
      { x: 1.5, y: 1.5, z: 9, w: 13, d: 13, h: 1.8, top: plank(C.wood, 4), left: flat(at(C.wood, 2)), right: flat(at(C.wood, 3)) },
      // La radio: cuerpo redondeado arriba (la tapa más angosta) y el frente hacia +x.
      { x: 4, y: 2.8, z: 10.8, w: 7, d: 10.4, h: 7, top: flat(at(MINT, 4)), left: flat(at(MINT, 3)), right: front },
      { x: 4.8, y: 3.6, z: 17.8, w: 5.4, d: 8.8, h: 1.2, top: flat(at(MINT, 5)), left: flat(at(MINT, 4)), right: flat(at(MINT, 3)) },
      // Asa de cuero arriba.
      solidBox({ x: 6.8, y: 5, z: 19, w: 1.2, d: 1.2, h: 1.6 }, C.logs, 3),
      solidBox({ x: 6.8, y: 10, z: 19, w: 1.2, d: 1.2, h: 1.6 }, C.logs, 3),
      solidBox({ x: 6.8, y: 5, z: 20.6, w: 1.2, d: 6.2, h: 1 }, C.logs, 3),
      volume(1, 1, 18, 14, 14, 10),
    ],
    {
      outline: OUT,
      under: shadowUnder(1.5, 1.5, 13, 13),
      extra: (c, p) => {
        // La antena de metal, inclinada hacia atrás.
        const a = p(5, 3.4, 18.5);
        const b = p(3, 1, 27);
        c.line(a.x, a.y, b.x, b.y, at(C.metal, 4));
        c.set(b.x, b.y, at(C.metal, 5));
        // Una planta chiquita en una maceta al lado de la radio.
        const pl = p(12, 12.5, 11);
        c.rect(pl.x - 1, pl.y - 2, 3, 2, at(C.terracotta, 3));
        c.set(pl.x, pl.y - 3, at(C.leaf, 4));
        c.set(pl.x - 1, pl.y - 4, at(C.leaf, 3));
        c.set(pl.x + 1, pl.y - 4, at(C.leaf, 4));
      },
    },
  );
}

// ---------- Mascotas ----------

/** Cama redonda acolchada para la mascota: el borde alto de tela y el cojín hundido al medio. */
function petBed(): Sprite {
  const r = C.rose;
  const rim = (x: number, y: number, w: number, d: number): Box => ({
    x,
    y,
    z: 0,
    w,
    d,
    h: 3.6,
    top: (u, v) => at(r, (Math.floor(u) + Math.floor(v)) % 4 === 0 ? 4 : 5),
    left: (_u, v) => at(r, v > 2.6 ? 4 : 3),
    right: (_u, v) => at(r, v > 2.6 ? 3 : 2),
  });
  return renderSprite(
    [
      rim(2, 2, 12, 2.4),
      rim(2, 4.4, 2.4, 7.2),
      // El cojín del medio, más bajo y a cuadritos.
      { x: 4.4, y: 4.4, z: 0, w: 7.2, d: 7.2, h: 1.8, top: (u, v) => (Math.floor(u / 2) + Math.floor(v / 2)) % 2 ? at(C.cream, 4) : at(C.cream, 5), left: flat(at(C.cream, 3)), right: flat(at(C.cream, 2)) },
      rim(11.6, 4.4, 2.4, 7.2),
      rim(2, 11.6, 12, 2.4),
    ],
    {
      outline: OUT,
      under: roundShadow(8, 8, 7, 0.28),
      extra: (c, p) => {
        // Un huesito de juguete sobre el cojín.
        const q = p(9.5, 6.5, 2);
        c.rect(q.x - 2, q.y, 4, 1, at(C.cream, 5));
        c.set(q.x - 2, q.y - 1, at(C.cream, 5));
        c.set(q.x + 1, q.y + 1, at(C.cream, 5));
      },
    },
  );
}

/** Casita del perro: tablas pintadas de rojo, techo a dos aguas, la puerta en arco y el plato al lado. */
function dogHouse(): Sprite {
  const red = C.rug;
  const walls: Shader = (u, _v, fw) => at(red, Math.floor(u / 3) % 2 ? 3 : 4 - (u > fw - 1 ? 1 : 0));
  const frontFace: Shader = (u, v, fw, fh) => {
    // La puerta en arco al medio del frente (+x), oscura adentro y con el marco claro.
    const cu = u - fw / 2;
    const arch = 7.5 + Math.sqrt(Math.max(0, 9 - cu * cu));
    if (Math.abs(cu) < 3 && v < arch) return at(C.woodDark, 0);
    if (Math.abs(cu) < 4 && v < arch + 1) return at(C.cream, 4);
    if (v >= fh - 1) return at(red, 2);
    return at(red, Math.floor(v / 3) % 2 ? 3 : 4);
  };
  const roof: Box[] = [];
  // El techo: tejas en escalones hacia la cumbrera (a lo largo de y).
  for (let k = 0; k < 6; k++) {
    roof.push({
      x: -0.5 + k * 1.3,
      y: -0.5,
      z: 12 + k * 1.3,
      w: 16 - k * 2.6,
      d: 16,
      h: 1.4,
      top: (_u, v) => at(C.roof, Math.floor(v / 2) % 2 ? 3 : 4),
      left: flat(at(C.roof, 2)),
      right: flat(at(C.roof, 3)),
    });
  }
  return renderSprite(
    [
      { x: 1, y: 1, z: 0, w: 13, d: 13, h: 12, top: flat(at(red, 4)), left: walls, right: frontFace },
      ...roof,
      solidBox({ x: 6.8, y: -0.8, z: 19.5, w: 1.6, d: 17.6, h: 1 }, C.cream, 4),
    ],
    {
      outline: OUT,
      under: shadowUnder(1, 1, 13, 13),
      pad: 2,
      extra: (c, p) => {
        // Letrerito con un hueso sobre la puerta y el plato de comida al pie.
        const s = p(14.1, 7.5, 16.5);
        c.rect(s.x - 2, s.y - 1, 5, 2, at(C.cream, 5));
        c.set(s.x - 2, s.y - 2, at(C.cream, 5));
        c.set(s.x + 2, s.y + 1, at(C.cream, 5));
        const b = p(15.5, 12, 0);
        c.ellipse(b.x, b.y, 3, 1.5, at(C.blue, 3));
        c.rect(b.x - 2, b.y - 1, 4, 1, mix(at(C.logs, 3), at(C.dirt, 2), 0.4));
      },
    },
  );
}

/** El comedero de la casa propia: un tapete con huellitas y dos platos de metal, el de croquetas y el del agua. */
function petBowlMat(): Sprite {
  // Rojo como la casita del perro: los platos de metal resaltan encima.
  const r = C.rug;
  const bowl = (x: number, y: number): Box => ({
    x,
    y,
    z: 0.8,
    w: 4.4,
    d: 4.4,
    h: 1.8,
    top: (u, v) => (Math.hypot(u - 2.2, v - 2.2) < 1.5 ? null : at(C.metal, 5)),
    left: (_u, v) => at(C.metal, v > 1.2 ? 4 : 3),
    right: (_u, v) => at(C.metal, v > 1.2 ? 3 : 2),
  });
  return renderSprite(
    [
      // El tapete, bajito, con el borde más oscuro y dos huellitas.
      {
        x: 1.5,
        y: 2,
        z: 0,
        w: 13,
        d: 12,
        h: 0.8,
        top: (u, v, fw, fh) => {
          if (u < 0.8 || v < 0.8 || u >= fw - 0.8 || v >= fh - 0.8) return at(r, 2);
          const paw = (cx: number, cy: number) => Math.hypot(u - cx, v - cy) < 0.9 || [-1.2, 0, 1.2].some((dx) => Math.hypot(u - cx - dx, v - cy + 1.5) < 0.5);
          return paw(10, 4) || paw(4, 9.5) ? at(r, 5) : at(r, 3);
        },
        left: flat(at(r, 2)),
        right: flat(at(r, 1)),
      },
      bowl(3, 3.5),
      bowl(8.5, 7.5),
    ],
    {
      outline: OUT,
      under: shadowUnder(1.5, 2, 13, 12),
      extra: (c, p) => {
        // Las croquetas (una lomita café) y el agua (azul clara con un brillo).
        const k = p(5.2, 5.7, 2);
        c.ellipse(k.x, k.y, 2, 1, at(C.wood, 3));
        c.set(k.x - 1, k.y - 1, at(C.wood, 4));
        c.set(k.x + 1, k.y, at(C.wood, 2));
        const w = p(10.7, 9.7, 2);
        c.ellipse(w.x, w.y, 2, 1, at(C.sky, 2));
        c.set(w.x - 1, w.y, at(C.sky, 4));
      },
    },
  );
}

export const CASA_DRAW: Record<string, () => Sprite> = {
  "balcony-stair": balconyStair,
  radio,
  "pet-bed": petBed,
  "dog-house": dogHouse,
  "pet-bowl": petBowlMat,
};

/** Colores sueltos que usan también los efectos del cliente (el agua de los lavamanos, las burbujas). */
export const CASA_COLORS = { water: hex("#7fc8f0"), foam: hex("#f4fbff") };
