// La casa de cada persona (docs/planes/plan-casas.md): lo que no había en la cabaña. Afuera, la casa de finca
// por fuera, el refugio de la parada "Casa", las mecedoras del corredor y el tendedero; adentro, las
// camas, el armario, el tocador, la tina, la mesa del comedor, la lámpara colgada y el baúl. Dibujos en
// art/casa-propia-exterior.ts (lo de afuera; la casa y el refugio con versión de noche) y
// art/casa-propia.ts (lo de adentro). El resto de la casa reusa muebles que ya existían.
import type { CatalogItem } from "./catalog";

/** Luz tibia de bombillo de casa. */
const WARM = { color: "#ffc76a" };

export const CASA_PROPIA_CATALOG = {
  // ----- Afuera
  // La casa de finca por fuera: dos pisos, basa de piedra, troncos y bahareque encalado, techo de tejas,
  // el corredor con su baranda y el balcón de arriba. Fija (dibujada en coordenadas del mundo): el frente
  // con la puerta mira a +y; la puerta son los tiles x 6..7 de la fila de adelante y la de atrás, la fila
  // y = 4 del costado este (+x), que da al patio. La luz es el farol de la puerta.
  "casa-finca": { name: "Casa", size: [14, 9], fixed: true, hasNight: true, light: { at: [94, 122, 24], ...WARM, radius: 70 } },
  // El refugio de la parada "Casa": techo, vidrio atrás, la banca y el letrero. La fila de atrás (la banca
  // contra el vidrio) bloquea y se sienta mirando a la calle; la de adelante se camina bajo el techo.
  "parada-casa": {
    name: "Parada Casa",
    size: [4, 2],
    fixed: true,
    hasNight: true,
    seeThrough: true,
    blocks: [[0, 0], [1, 0], [2, 0], [3, 0]],
    seats: [[0, 0, "down"], [1, 0, "down"], [2, 0, "down"], [3, 0, "down"]],
    light: { at: [32, 16, 44], color: "#fff1c4", radius: 60 },
  },
  mecedora: { name: "Mecedora", size: [1, 1], seats: [[0, 0]], hasBack: true },
  tendedero: { name: "Tendedero", size: [1, 3] },
  // ----- Adentro
  "cama-doble": { name: "Cama doble", size: [2, 2], hasBack: true },
  "cama-sencilla": { name: "Cama sencilla", size: [2, 1], hasBack: true },
  armario: { name: "Armario", size: [1, 2] },
  tocador: { name: "Tocador", size: [1, 1] },
  "tina-bano": { name: "Tina", size: [2, 1] },
  "mesa-comedor": { name: "Mesa del comedor", size: [2, 2] },
  // Cuelga del techo sobre la mesa del comedor: no bloquea (la mesa de abajo ya bloquea).
  "lampara-colgante": { name: "Lámpara colgada", size: [1, 1], solid: false, light: { at: [8, 8, 46], ...WARM, radius: 60 } },
  baul: { name: "Baúl", size: [1, 1] },
  // ----- Para pasarla bien: la barra de la sala de fiestas (se piden tragos con E), el equipo de sonido
  // (pone música para los de la casa), la bola de discoteca (cuelga del techo; brilla con fiesta), el
  // juego de la rana y la mesa de billar del cuarto de juegos.
  "barra-casa": { name: "Barra de la casa", size: [1, 3], light: { at: [5, 24, 22], ...WARM, radius: 50 } },
  "equipo-sonido": { name: "Equipo de sonido", size: [1, 2] },
  "bola-disco": { name: "Bola de discoteca", size: [1, 1], solid: false, light: { at: [8, 8, 50], color: "#ffd2f0", radius: 70 } },
  "juego-rana": { name: "Juego de la rana", size: [1, 1] },
  "mesa-billar": { name: "Mesa de billar", size: [2, 3], light: { at: [16, 24, 48], ...WARM, radius: 60 } },
} satisfies Record<string, CatalogItem>;
