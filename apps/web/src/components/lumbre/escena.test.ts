// La portada y el login importan la escena: si un mueble del catálogo cambia de nombre o un recorrido
// queda sobre algo sólido, este test avisa antes de que se note en producción.
import { buildArea, canStandAt, canWalkBetween, catalogItem, TILE_SIZE, type AreaDef } from "@hyvento/map";
import { composeArea } from "@hyvento/map/art";
import { describe, expect, it } from "vitest";
import { enRecorrido, ESCENA, JUEGOS, largo, LLEGADA, lucesDeEscena, OBJETOS, OFICINA, PASEO, RONDA, type Recorrido } from "./escena";
import { bannerSvg, ESLOGAN, llamaPixeles, MARCA, textoPixeles } from "./marca";

const SALAS: [string, AreaDef][] = [
  ["la escena de la portada", ESCENA],
  ["la oficina en chiquito", OFICINA],
  ["el sótano en chiquito", JUEGOS],
];

describe("escena de la portada", () => {
  it.each(SALAS)("%s solo usa muebles del catálogo y se dibuja con el motor", (_, sala) => {
    for (const f of sala.furniture) expect(() => catalogItem(f.type), f.type).not.toThrow();
    const map = buildArea(sala);
    const dibujo = composeArea(map, true, 40);
    expect(dibujo.width).toBeGreaterThan(0);
    expect(dibujo.data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
  });

  const mapa = buildArea(ESCENA);
  const px = (t: number) => t * TILE_SIZE;

  it.each([
    ["PASEO", PASEO],
    ["LLEGADA", LLEGADA],
  ] as [string, Recorrido][])("el recorrido %s se camina entero sin atravesar nada", (_, r) => {
    expect(largo(r)).toBeGreaterThan(1);
    for (const p of r) expect(canStandAt(mapa, px(p.x), px(p.y)), `${p.x},${p.y}`).toBe(true);
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1]!;
      const b = r[i]!;
      expect(canWalkBetween(mapa, px(a.x), px(a.y), px(b.x), px(b.y)), `tramo ${i}`).toBe(true);
    }
  });

  it("los de la fogata están parados en el piso", () => {
    for (const p of RONDA) expect(canStandAt(mapa, px(p.x), px(p.y)), `${p.x},${p.y}`).toBe(true);
  });

  it("un caminante va y vuelve y se queda en las puntas", () => {
    const total = largo(PASEO);
    expect(enRecorrido(PASEO, 0, 2)).toMatchObject({ x: PASEO[0]!.x, y: PASEO[0]!.y, caminando: true });
    expect(enRecorrido(PASEO, total + 1, 2)).toMatchObject({ x: PASEO.at(-1)!.x, y: PASEO.at(-1)!.y, caminando: false });
    // Una vuelta completa (ida, pausa, vuelta, pausa) lo deja donde empezó.
    const vuelta = enRecorrido(PASEO, 2 * (total + 2), 2);
    expect(vuelta.x).toBeCloseTo(PASEO[0]!.x);
    expect(vuelta.y).toBeCloseTo(PASEO[0]!.y);
  });

  it("tiene las luces de los faroles y la fogata", () => {
    const luces = lucesDeEscena();
    expect(luces.length).toBeGreaterThan(3);
    expect(luces.some((l) => l.fuego)).toBe(true);
  });

  it.each(OBJETOS.map((o) => [o.nombre, o] as const))("el objeto %s tiene dibujo", (_, o) => {
    const c = o.dibujar();
    expect(c.width * c.height).toBeGreaterThan(0);
    expect(c.data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
  });
});

describe("marca", () => {
  it("la llamita tiene contorno en sus dos cuadros", () => {
    for (const cuadro of [0, 1] as const) {
      const { w, h, pixeles } = llamaPixeles(cuadro);
      expect(pixeles.length).toBeGreaterThan(50);
      for (const p of pixeles) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(w);
        expect(p.y).toBeLessThan(h);
      }
    }
  });

  it("las letras pixel alcanzan para el nombre y el eslogan", () => {
    // Si falta una letra, queda un hueco del ancho de un espacio: el texto sale más angosto.
    const conTodas = (t: string) => [...t.toUpperCase()].reduce((w, ch) => w + (ch === " " ? 3 : ch === "I" ? 4 : 6), 0) - 1;
    expect(textoPixeles(MARCA).w).toBe(conTodas(MARCA));
    expect(textoPixeles(ESLOGAN).w).toBe(conTodas(ESLOGAN));
  });

  it("el banner cabe en su lienzo", () => {
    const svg = bannerSvg();
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain(`viewBox="0 0 400 120"`);
    // El eslogan entra con margen a los lados (no se corta en el borde).
    expect(textoPixeles(ESLOGAN).w).toBeLessThanOrEqual(400 - 16);
  });
});
