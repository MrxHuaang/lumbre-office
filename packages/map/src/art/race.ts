// La carrera de sillas del pasillo del piso 2: las líneas de salida y de meta pintadas a cuadros en el
// piso y la bandera a cuadros junto a la salida (donde se larga con E).
import { C, OUT } from "./palette";
import { at, flat, renderSprite, solidBox, type Sprite } from "./pixel";
import { shadowSpace, shadowUnder, type Variant } from "./kit";

/** Franja a cuadros de 1x3 tiles, casi al ras del piso (plana: se dibuja debajo de todo). */
function raceLine(): Sprite {
  return renderSprite([
    {
      x: 4,
      y: 0,
      z: 0,
      w: 8,
      d: 48,
      h: 0.5,
      top: (u, v) => (Math.floor(u / 4) + Math.floor(v / 4)) % 2 === 0 ? at(C.white, 4) : at(C.night, 1),
      left: flat(at(C.night, 0)),
      right: flat(at(C.night, 0)),
    },
  ]);
}

/** Bandera a cuadros en su asta, con una base de madera. */
function raceFlag(_v: Variant): Sprite {
  const cloth = {
    x: 7,
    y: 2,
    z: 22,
    w: 1,
    d: 10,
    h: 8,
    top: flat(at(C.white, 3)),
    left: (u: number, v: number) => ((Math.floor(u / 2) + Math.floor(v / 2)) % 2 === 0 ? at(C.white, 4) : at(C.night, 1)),
    right: (u: number, v: number) => ((Math.floor(u / 2) + Math.floor(v / 2)) % 2 === 0 ? at(C.white, 3) : at(C.night, 0)),
  };
  return renderSprite(
    [
      shadowSpace(4, 4, 8, 8),
      solidBox({ x: 5, y: 5, z: 0, w: 6, d: 6, h: 3 }, C.woodDark, 3),
      solidBox({ x: 7, y: 7, z: 3, w: 2, d: 2, h: 28 }, C.metal, 4),
      solidBox({ x: 7, y: 7, z: 31, w: 2, d: 2, h: 1 }, C.gold, 4),
      cloth,
    ],
    { outline: OUT, under: shadowUnder(5, 5, 6, 6) },
  );
}

export const RACE_DRAW: Record<string, (v: Variant) => Sprite> = {
  "race-line": () => raceLine(),
  "race-flag": raceFlag,
};
