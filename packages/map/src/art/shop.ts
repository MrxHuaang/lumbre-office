// Muebles de la tienda de la planta baja (no se venden): mostrador con caja registradora, perchero
// de ropa, estante con mercancía y el probador. Paleta común de la tienda: salvia, madera y bronce.
import { C, OUT } from "./palette";
import { alpha, at, flat, noise, renderSprite, solidBox, type Box, type Ramp, type RGBA, type Shader, type Sprite } from "./pixel";
import { shadowUnder, volume, type Variant } from "./kit";

/** Tablero pintado con recuadros de moldura (frentes del mostrador y del probador). */
function panels(paint: Ramp, every: number, opts: { base?: number; top?: number; emblem?: (u: number, v: number) => RGBA | null } = {}): Shader {
  const base = opts.base ?? 2;
  const top = opts.top ?? 1.5;
  return (u, v, fw, fh) => {
    if (v < base) return at(C.woodDark, v < base - 0.8 ? 1 : 3);
    if (v >= fh - top) return at(C.wood, v >= fh - 0.8 ? 4 : 3);
    const n = Math.max(1, Math.round(fw / every));
    const pw = fw / n;
    const k = Math.floor(u / pw);
    const pu = u - k * pw;
    const pv = v - base;
    const ph = fh - base - top;
    if (pu < 1 || pu >= pw - 1 || pv < 1 || pv >= ph - 1) return at(paint, pu < 0.5 || pu >= pw - 0.5 ? 1 : 3);
    if (pu < 1.6 || pv >= ph - 1.6) return at(paint, 2);
    if (pu >= pw - 1.6 || pv < 1.6) return at(paint, 4);
    return opts.emblem?.(u, v) ?? at(paint, 3);
  };
}

function shopCounter(): Sprite {
  // Moneda dorada pintada en el recuadro del medio.
  const coin = (u: number, v: number): RGBA | null => {
    const d = Math.hypot(u - 15.5, (v - 8.5) * 1.1);
    if (d < 1.2) return at(C.gold, 5);
    if (d < 2.4) return at(C.gold, 4);
    if (d < 3) return at(C.gold, 2);
    return null;
  };
  // Bronce con una línea grabada a media altura.
  const brass: Shader = (_u, v) => at(C.gold, Math.floor(v) === 3 ? 2 : 3);
  const keysTop: Shader = (u, v, fw, fh) => {
    if (u < 0.6 || v < 0.6 || u >= fw - 0.6 || v >= fh - 0.6) return at(C.gold, 3);
    return Math.floor(u * 1.2) % 2 === 0 && Math.floor(v * 1.2) % 2 === 0 ? at(C.cream, 5) : at(C.woodDark, 1);
  };
  const display: Shader = (u, v, fw, fh) => {
    if (u < 0.8 || u >= fw - 0.8 || v < 0.8 || v >= fh - 0.8) return at(C.gold, 4);
    if (v > 1.6 && v < 3.6 && Math.floor(u) % 2 === 1 && u < fw - 1.4) return at(C.woodDark, 1);
    return at(C.cream, 5);
  };
  const jar: Shader = (u, v, fw, fh) => {
    if (u < 0.5 || u >= fw - 0.5) return alpha(at(C.white, 4), 0.7);
    if (v < fh - 1.2) {
      const n = noise(Math.floor(u * 1.4), Math.floor(v * 1.4), 23);
      return [at(C.rug, 4), at(C.gold, 5), at(C.sky, 3), at(C.leaf, 4), at(C.rose, 5)][Math.floor(n * 5)]!;
    }
    return alpha(at(C.sky, 4), 0.35);
  };
  return renderSprite(
    [
      {
        x: 1,
        y: 0.5,
        z: 0,
        w: 11,
        d: 31,
        h: 15,
        top: flat(at(C.wood, 3)),
        left: panels(C.sage, 12),
        right: panels(C.sage, 10.5, { emblem: coin }),
      },
      {
        x: 0,
        y: 0,
        z: 15,
        w: 14,
        d: 32,
        h: 2,
        top: (u, v, fw, fh) =>
          u < 0.8 || v < 0.8 || u >= fw - 0.8 || v >= fh - 0.8 ? at(C.wood, 4) : at(C.wood, noise(Math.floor(u / 4), Math.floor(v / 9), 3) < 0.5 ? 4 : 5),
        left: flat(at(C.wood, 2)),
        right: (_u, v) => at(C.wood, v >= 1.2 ? 4 : 3),
      },
      // Frasco de dulces.
      { x: 3.5, y: 3, z: 17, w: 4, d: 4, h: 5, top: flat(alpha(at(C.sky, 4), 0.5)), left: jar, right: jar },
      solidBox({ x: 4, y: 3.5, z: 22, w: 3, d: 3, h: 1 }, C.rug, 3),
      solidBox({ x: 5, y: 4.5, z: 23, w: 1, d: 1, h: 1 }, C.rug, 4),
      // Bolsa de papel con el borde doblado.
      {
        x: 3,
        y: 10,
        z: 17,
        w: 3.5,
        d: 4.5,
        h: 6,
        top: flat(at(C.cork, 4)),
        left: (_u, v) => (v > 4.6 ? at(C.cork, 4) : at(C.cork, 3)),
        right: (u, v, fw) => (v > 4.6 ? at(C.cork, 3) : Math.abs(u - fw / 2) < 1 && Math.abs(v - 2.5) < 1 ? at(C.rug, 3) : at(C.cork, 2)),
      },
      // Caja registradora de bronce: cajón abajo, teclado oscuro adelante y visor con el precio.
      {
        x: 2,
        y: 18.5,
        z: 17,
        w: 9.5,
        d: 9,
        h: 4.5,
        top: flat(at(C.gold, 4)),
        left: brass,
        right: (u, v, fw) => {
          if (Math.floor(v) === 2) return at(C.woodDark, 1);
          if (v < 2 && Math.abs(u - fw / 2) < 0.8) return at(C.gold, 5);
          return at(C.gold, 2);
        },
      },
      { x: 2.5, y: 20, z: 21.5, w: 4.5, d: 6, h: 5, top: flat(at(C.gold, 4)), left: flat(at(C.gold, 3)), right: display },
      solidBox({ x: 3.5, y: 21.5, z: 26.5, w: 2.5, d: 3, h: 1.5 }, C.gold, 4),
      { x: 7, y: 19, z: 21.5, w: 4, d: 8, h: 1.5, top: keysTop, left: flat(at(C.gold, 2)), right: flat(at(C.gold, 1)) },
      volume(0, 0, 17, 14, 32, 12),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 14, 32),
      extra: (c, p) => {
        // Manivela al costado de la caja.
        const m = p(6.5, 27.5, 20);
        c.set(m.x, m.y, at(C.gold, 4));
        c.set(m.x - 1, m.y + 1, at(C.gold, 4));
        c.set(m.x - 2, m.y + 1, at(C.rug, 3));
        // Timbre de mostrador.
        const b = p(9.5, 12, 17);
        c.rect(b.x - 2, b.y - 1, 5, 1, at(C.woodDark, 2));
        c.rect(b.x - 1, b.y - 3, 3, 2, at(C.gold, 4));
        c.set(b.x - 1, b.y - 3, at(C.gold, 5));
        c.set(b.x, b.y - 4, at(C.metal, 3));
      },
    },
  );
}

/** Prenda colgada: `kind` define la silueta y `r` el color. */
type Garment = { kind: "shirt" | "dress" | "coat" | "sweater"; r: Ramp };

function clothesRack(): Sprite {
  const GARMENTS: Garment[] = [
    { kind: "coat", r: C.woodDark },
    { kind: "shirt", r: C.blue },
    { kind: "dress", r: C.rose },
    { kind: "sweater", r: C.mustard },
    { kind: "shirt", r: C.cream },
    { kind: "dress", r: C.sage },
    { kind: "sweater", r: C.rug },
    { kind: "coat", r: C.fabric },
  ];
  const rack = C.gold;
  const boxes: Box[] = [
    // Patas con ruedas.
    solidBox({ x: 3, y: 1.2, z: 0.8, w: 10, d: 1.6, h: 1.2 }, rack, 3),
    solidBox({ x: 3, y: 29.2, z: 0.8, w: 10, d: 1.6, h: 1.2 }, rack, 3),
    solidBox({ x: 3, y: 1.5, z: 0, w: 1.2, d: 1, h: 0.8 }, C.metal, 2),
    solidBox({ x: 11.8, y: 1.5, z: 0, w: 1.2, d: 1, h: 0.8 }, C.metal, 2),
    solidBox({ x: 7.3, y: 1.2, z: 2, w: 1.4, d: 1.4, h: 29 }, rack, 3),
    solidBox({ x: 7.2, y: 1, z: 30.5, w: 1.6, d: 30, h: 1.4 }, rack, 4),
  ];
  const y0 = 3.4;
  const step = 3.1;
  GARMENTS.forEach((g, i) => {
    const y = y0 + i * step;
    const d = 2.3;
    const r = g.r;
    const top = 30.2;
    // Frente de la prenda (cara +y): detalles según el tipo.
    const face =
      (shade: number): Shader =>
      (u, v, fw, fh) => {
        if (v < 0.8) return at(r, shade - 1);
        if (g.kind === "shirt" && Math.abs(u - fw / 2) < 0.4 && v < fh - 1) return Math.floor(v) % 3 === 0 ? at(C.cream, 5) : at(r, shade - 1);
        if (g.kind === "sweater" && v < 2) return at(r, Math.floor(u) % 2 ? shade - 1 : shade);
        if (g.kind === "sweater" && Math.abs(v - fh * 0.6) < 0.6) return at(C.cream, 4);
        if (g.kind === "coat" && Math.abs(u - fw / 2 - (fh - v) * 0.05) < 0.4) return at(r, shade - 2);
        if (g.kind === "dress" && Math.abs(v - fh + 0.5) < 0.5) return at(C.cream, 4);
        return at(r, shade);
      };
    const part = (x: number, w: number, z: number, h: number): Box => ({ x, y, z, w, d, h, top: flat(at(r, 4)), left: face(3), right: face(2) });
    const shoulder = part(5.4, 5.2, top - 1.4, 1.4);
    switch (g.kind) {
      case "shirt":
        boxes.push(part(3.8, 8.4, top - 13, 11.6), shoulder);
        break;
      case "sweater":
        boxes.push(part(3.6, 8.8, top - 12, 10.6), shoulder);
        break;
      case "coat":
        boxes.push(part(3.8, 8.4, top - 19, 17.6), shoulder);
        break;
      case "dress":
        boxes.push(part(3.2, 9.6, top - 18, 11), part(5, 6, top - 7, 5.6), shoulder);
        break;
    }
  });
  boxes.push(solidBox({ x: 7.3, y: 29.3, z: 2, w: 1.4, d: 1.4, h: 29 }, rack, 3));
  return renderSprite([...boxes, volume(4, 0, 30, 8, 32, 4)], {
    outline: OUT,
    under: shadowUnder(3, 1, 10, 30, 0.25),
    extra: (c, p) => {
      // Ganchos de las perchas sobre la barra.
      GARMENTS.forEach((_g, i) => {
        const q = p(8, y0 + i * step + 1.1, 32);
        c.set(q.x, q.y, at(C.metal, 4));
        c.set(q.x, q.y - 1, at(C.metal, 4));
        c.set(q.x + 1, q.y - 2, at(C.metal, 3));
      });
      // Etiqueta de precio colgando de una prenda.
      const t = p(12.2, 17, 22);
      c.set(t.x, t.y, at(C.cream, 1));
      c.rect(t.x, t.y + 1, 2, 2, at(C.cream, 5));
      c.set(t.x + 1, t.y + 2, at(C.rug, 3));
    },
  });
}

function displayShelf(): Sprite {
  const w = C.wood;
  const backPlanks: Shader = (u) => at(w, Math.floor(u) % 5 === 0 ? 1 : 2);
  const shelf = (z: number): Box => ({ x: 2, y: 1.5, z, w: 9, d: 29, h: 1.5, top: flat(at(w, 4)), left: flat(at(w, 3)), right: flat(at(w, 3)) });
  // Frasco de vidrio con contenido de color.
  const jar = (y: number, z: number, r: Ramp): Box[] => [
    {
      x: 5,
      y,
      z,
      w: 3.5,
      d: 3.5,
      h: 5,
      top: flat(at(r, 4)),
      left: (u, v, fw) => (u < 0.6 || u >= fw - 0.6 ? alpha(at(C.white, 4), 0.8) : at(r, v > 3.6 ? 2 : 3)),
      right: (u, v) => (u < 0.6 ? alpha(at(C.white, 4), 0.8) : at(r, v > 3.6 ? 1 : 2)),
    },
    solidBox({ x: 5.2, y: y + 0.2, z: z + 5, w: 3.1, d: 3.1, h: 1 }, C.cream, 3),
  ];
  // Caja de regalo con cinta.
  const gift = (x: number, y: number, z: number, s: number, h: number, r: Ramp, ribbon: Ramp): Box => ({
    x,
    y,
    z,
    w: s,
    d: s,
    h,
    top: (u, v, fw, fh) => (Math.abs(u - fw / 2) < 0.5 || Math.abs(v - fh / 2) < 0.5 ? at(ribbon, 4) : at(r, 4)),
    left: (u, _v, fw) => (Math.abs(u - fw / 2) < 0.5 ? at(ribbon, 3) : at(r, 3)),
    right: (u, _v, fw) => (Math.abs(u - fw / 2) < 0.5 ? at(ribbon, 2) : at(r, 2)),
  });
  // Ropa doblada en pila.
  const folded = (y: number, z: number, r: Ramp, stripe: boolean): Box => ({
    x: 3,
    y,
    z,
    w: 7,
    d: 7,
    h: 1.8,
    top: flat(at(r, 4)),
    left: (_u, v) => at(r, v > 1 ? 3 : 2),
    right: (u, v) => (stripe && Math.floor(u) % 2 === 0 ? at(C.cream, 4) : at(r, v > 1 ? 2 : 1)),
  });
  const boxes: Box[] = [
    solidBox({ x: 0, y: 0, z: 0, w: 11, d: 1.5, h: 38 }, w, 3),
    { x: 0, y: 1.5, z: 0, w: 2, d: 29, h: 38, top: flat(at(w, 4)), left: flat(at(w, 2)), right: backPlanks },
    { x: 2, y: 1.5, z: 0, w: 9, d: 29, h: 3, top: flat(at(w, 4)), left: flat(at(C.woodDark, 3)), right: flat(at(C.woodDark, 3)) },
    // Abajo: ropa doblada y un canasto con ovillos.
    folded(3, 3, C.rug, false),
    folded(3, 4.8, C.cream, true),
    folded(3, 6.6, C.sage, false),
    folded(3.5, 8.4, C.fabric, true),
    {
      x: 3,
      y: 12,
      z: 3,
      w: 7,
      d: 7,
      h: 4,
      top: flat(at(C.woodDark, 1)),
      left: (u, v) => at(C.cork, (Math.floor(u / 1.5) + Math.floor(v / 1.5)) % 2 ? 3 : 2),
      right: (u, v) => at(C.cork, (Math.floor(u / 1.5) + Math.floor(v / 1.5)) % 2 ? 2 : 1),
    },
    gift(3.5, 21.5, 3, 6, 5, C.rose, C.gold),
    shelf(13),
    // Medio: frascos (mermelada, miel, encurtidos) y una matera.
    ...jar(3.5, 14.5, C.rug),
    ...jar(8.5, 14.5, C.gold),
    ...jar(13.5, 14.5, C.leaf),
    { x: 4, y: 20, z: 14.5, w: 4.5, d: 4.5, h: 4, top: flat(at(C.dirt, 1)), left: flat(at(C.terracotta, 3)), right: flat(at(C.terracotta, 2)) },
    gift(4, 25.5, 14.5, 4, 3.5, C.sky, C.rug),
    shelf(25),
    // Arriba: regalos apilados y velas.
    gift(3.5, 3, 26.5, 6, 4.5, C.fabric, C.cream),
    gift(4.5, 4, 31, 4, 3, C.mustard, C.rug),
    solidBox({ x: 5, y: 12, z: 26.5, w: 2, d: 2, h: 5 }, C.cream, 4),
    solidBox({ x: 5, y: 15, z: 26.5, w: 2, d: 2, h: 3.5 }, C.cream, 4),
    solidBox({ x: 5, y: 18, z: 26.5, w: 2, d: 2, h: 4.2 }, C.cream, 4),
    { x: 3.5, y: 22.5, z: 26.5, w: 6, d: 6, h: 5, top: flat(at(C.woodDark, 4)), left: flat(at(C.woodDark, 3)), right: (u, v, fw, fh) => (u > 1 && u < fw - 1 && v > 1 && v < fh - 1 ? at(C.gold, 4) : at(C.woodDark, 2)) },
    // Remate de arriba con un letrero.
    { x: -0.5, y: -0.5, z: 38, w: 12, d: 33, h: 2, top: flat(at(w, 5)), left: flat(at(w, 3)), right: flat(at(w, 4)) },
    { x: 1, y: 9, z: 40, w: 1.5, d: 14, h: 6, top: flat(at(w, 4)), left: flat(at(w, 2)), right: (u, v, fw, fh) => (u < 1 || u >= fw - 1 || v < 1 || v >= fh - 1 ? at(w, 3) : at(C.sage, 3)) },
    solidBox({ x: 0, y: 30.5, z: 0, w: 11, d: 1.5, h: 38 }, w, 3),
  ];
  return renderSprite(boxes, {
    outline: OUT,
    under: shadowUnder(0, 0, 11, 32),
    extra: (c, p) => {
      // Ovillos de lana en el canasto.
      for (const [y, r] of [
        [14, C.rose],
        [17, C.sky],
        [15.5, C.mustard],
      ] as const) {
        const q = p(6.5, y, 7.5);
        c.ellipse(q.x, q.y - 1, 2, 1.8, at(r, 3));
        c.set(q.x - 1, q.y - 2, at(r, 4));
        c.line(q.x - 1, q.y, q.x + 1, q.y - 2, at(r, 2));
      }
      // Plantita en la matera.
      const m = p(6.2, 22.2, 18.5);
      c.ellipse(m.x, m.y - 2, 3, 2, at(C.leaf, 2));
      c.ellipse(m.x - 1, m.y - 3, 1.8, 1.2, at(C.leaf, 4));
      // Llamitas de las velas.
      for (const [y, h] of [
        [13, 31.5],
        [16, 30],
        [19, 30.7],
      ] as const) {
        const q = p(6, y, h);
        c.set(q.x, q.y - 1, at(C.fire, 4));
        c.set(q.x, q.y - 2, at(C.fire, 3));
      }
      // Estrella dorada en el letrero de arriba.
      const s = p(2.5, 16, 43);
      c.set(s.x, s.y - 1, at(C.gold, 5));
      c.rect(s.x - 1, s.y, 3, 1, at(C.gold, 5));
      c.set(s.x - 1, s.y + 1, at(C.gold, 4));
      c.set(s.x + 1, s.y + 1, at(C.gold, 4));
    },
  });
}

function fittingBooth(): Sprite {
  const curtain = C.curtain;
  // Papel de colgadura de rayas adentro.
  const stripes: Shader = (u) => (Math.floor(u / 2) % 2 ? at(C.cream, 4) : at(C.rose, 4));
  // Pared del fondo por dentro, con un espejo ovalado (se ve por la abertura de la cortina).
  const farWall: Shader = (u, v, fw, fh) => {
    const du = (u - 16) / 3.2;
    const dv = (v - 17) / 8.5;
    const d = du * du + dv * dv;
    if (d < 1) return Math.abs(u - 15.5 - (v - 17) * 0.4) < 0.6 ? at(C.white, 4) : at(C.sky, v > 19 ? 3 : 2);
    if (d < 1.4) return at(C.gold, 4);
    return stripes(u, v, fw, fh);
  };
  // Cortina de terciopelo: pliegues, cenefa arriba y la parte recogida con una borla.
  const drape: Shader = (u, v, _fw, fh) => {
    const valance = v >= fh - 4;
    if (valance) return v < fh - 3.2 && Math.floor(u) % 2 === 0 ? at(C.gold, 4) : at(curtain, Math.floor(u * 0.8) % 2 ? 3 : 2);
    const open = u > 14 && u < 20.5 + Math.max(0, (v - 16) * 0.1);
    if (open) return null;
    const gathered = u >= 20.5;
    if (gathered && Math.abs(v - 16) < 0.8) return at(C.gold, 5);
    if (v < 1) return at(C.gold, 3);
    const fold = Math.sin(u * (gathered ? 2.6 : 1.5));
    return at(curtain, fold > 0.5 ? 4 : fold > -0.3 ? 3 : 2);
  };
  return renderSprite(
    [
      // Piso con tapete y paredes de adentro (se ven por la abertura).
      { x: 2, y: 2, z: 0, w: 27, d: 28, h: 0.5, top: (u, v) => at(C.rose, (Math.floor(u / 2) + Math.floor(v / 2)) % 2 ? 4 : 3) },
      { x: 0, y: 0, z: 0, w: 2, d: 32, h: 44, top: flat(at(C.wood, 4)), left: flat(at(C.wood, 2)), right: stripes },
      { x: 2, y: 0, z: 0, w: 27, d: 2, h: 44, top: flat(at(C.wood, 4)), left: farWall, right: flat(at(C.wood, 3)) },
      // Gancho con un vestido colgado en la pared de atrás (se ve desde arriba).
      solidBox({ x: 2, y: 17, z: 37, w: 1.5, d: 1, h: 1 }, C.gold, 4),
      solidBox({ x: 2.2, y: 15, z: 26, w: 1.4, d: 5, h: 11 }, C.sage, 3),
      solidBox({ x: 2.2, y: 14, z: 20, w: 1.4, d: 7, h: 6 }, C.sage, 3),
      // Taburete adentro, frente a la abertura.
      solidBox({ x: 18, y: 5, z: 0, w: 5, d: 5, h: 6 }, C.wood, 3),
      solidBox({ x: 17.5, y: 4.5, z: 6, w: 6, d: 6, h: 1.5 }, C.mustard, 3),
      // Cortina y su barra.
      { x: 28, y: 3, z: 1, w: 1, d: 26, h: 40, top: flat(at(curtain, 4)), left: flat(at(curtain, 2)), right: drape },
      solidBox({ x: 28, y: 1, z: 41, w: 1.2, d: 30, h: 1.2 }, C.gold, 4),
      // Pared del costado +y (por fuera, con recuadros) y postes del frente.
      { x: 2, y: 30, z: 0, w: 27, d: 2, h: 44, top: flat(at(C.wood, 4)), left: panels(C.sage, 13.5, { top: 3 }), right: flat(at(C.wood, 3)) },
      solidBox({ x: 29, y: 0, z: 0, w: 3, d: 3, h: 44 }, C.wood, 3),
      solidBox({ x: 29, y: 29, z: 0, w: 3, d: 3, h: 44 }, C.wood, 3),
      // Cornisa alrededor: arriba queda abierto y se ve el espejo y el taburete.
      ...[
        { x: -1, y: -1, w: 3.5, d: 34 },
        { x: 2.5, y: -1, w: 30.5, d: 3.5 },
        { x: 28.5, y: 2.5, w: 4.5, d: 27 },
        { x: 2.5, y: 29.5, w: 30.5, d: 3.5 },
      ].map(
        (b): Box => ({
          ...b,
          z: 44,
          h: 3,
          top: (u, v, fw, fh) => (u < 0.8 || v < 0.8 || u >= fw - 0.8 || v >= fh - 0.8 ? at(C.wood, 5) : at(C.wood, 4)),
          left: (_u, v) => at(C.wood, v < 1 ? 1 : 3),
          right: (_u, v) => at(C.wood, v < 1 ? 1 : 2),
        }),
      ),
      {
        x: 30.5,
        y: 10,
        z: 47,
        w: 1.5,
        d: 12,
        h: 6,
        top: flat(at(C.wood, 4)),
        left: flat(at(C.wood, 2)),
        right: (u, v, fw, fh) => {
          if (u < 0.8 || u >= fw - 0.8 || v < 0.8 || v >= fh - 0.8) return at(C.wood, 2);
          // Percha dibujada: gancho arriba y triángulo abajo.
          const cu = u - fw / 2;
          if (v > 3.6 && v < 4.8 && Math.abs(cu) < 0.5) return at(C.woodDark, 1);
          if (v >= 1.4 && v < 3.8 && Math.abs(Math.abs(cu) - (3.6 - v) * 1.6) < 0.6) return at(C.woodDark, 1);
          if (v >= 1.2 && v < 1.9 && Math.abs(cu) < 3.8) return at(C.woodDark, 1);
          return at(C.cream, 5);
        },
      },
    ],
    { outline: OUT, under: shadowUnder(0, 0, 32, 32) },
  );
}

/** Dibujos de los muebles de la tienda, por tipo del catálogo. */
export const SHOP: Record<string, (v: Variant) => Sprite> = {
  "shop-counter": shopCounter,
  "clothes-rack": clothesRack,
  "display-shelf": displayShelf,
  "fitting-booth": fittingBooth,
};
