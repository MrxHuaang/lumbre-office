import { describe, expect, it } from "vitest";
import { getWorld, isBlockedTile, pointsOfType } from "../index";
import { drawFurniture } from "./furniture";
import { PHOTO_BOARD_PIC, PHOTO_BOARD_SLOTS, photoBoardPhotos, type PhotoThumb } from "./photos";

const opaque = (c: { data: Uint8ClampedArray }) => {
  let n = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i]) n++;
  return n;
};

/** Miniatura de un solo color. */
const thumb = (r: number, g: number, b: number): PhotoThumb => {
  const { w, h } = PHOTO_BOARD_PIC;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([r, g, b, 255], i * 4);
  return { width: w, height: h, data };
};

describe("tablón de fotos", () => {
  it("la capa de las fotos tiene el tamaño y el origen del tablón (cae justo encima)", () => {
    const base = drawFurniture("photo-board", "front");
    const layer = photoBoardPhotos([thumb(255, 0, 0)]);
    expect([layer.canvas.width, layer.canvas.height, layer.ox, layer.oy]).toEqual([base.canvas.width, base.canvas.height, base.ox, base.oy]);
  });

  it("sin fotos no pinta nada; con más fotos, más corcho tapado (hasta los lugares que hay)", () => {
    expect(opaque(photoBoardPhotos([]).canvas)).toBe(0);
    const one = opaque(photoBoardPhotos([thumb(255, 0, 0)]).canvas);
    const three = opaque(photoBoardPhotos([thumb(255, 0, 0), thumb(0, 255, 0), thumb(0, 0, 255)]).canvas);
    const full = opaque(photoBoardPhotos(Array.from({ length: PHOTO_BOARD_SLOTS }, () => thumb(9, 9, 9))).canvas);
    const extra = opaque(photoBoardPhotos(Array.from({ length: PHOTO_BOARD_SLOTS + 4 }, () => thumb(9, 9, 9))).canvas);
    expect(one).toBeGreaterThan(PHOTO_BOARD_PIC.w * PHOTO_BOARD_PIC.h * 0.8);
    expect(three).toBeGreaterThan(one * 2.5);
    expect(extra).toBe(full);
  });

  it("las fotos quedan sobre el tablón, no afuera", () => {
    const base = drawFurniture("photo-board", "front");
    const layer = photoBoardPhotos(Array.from({ length: PHOTO_BOARD_SLOTS }, () => thumb(200, 100, 50)));
    for (let i = 3; i < layer.canvas.data.length; i += 4) if (layer.canvas.data[i]) expect(base.canvas.data[i]).toBeGreaterThan(0);
  });

  it("está en la cafetería con su punto al frente, que se puede pisar", () => {
    const map = getWorld().areas.get("planta-baja")!;
    const board = map.furniture.find((f) => f.type === "photo-board");
    expect(board).toBeDefined();
    const [point] = pointsOfType(map, "photo_board");
    expect(point).toBeDefined();
    const ts = map.tileSize;
    const tx = Math.floor(point!.x / ts);
    const ty = Math.floor(point!.y / ts);
    expect(isBlockedTile(map, tx, ty)).toBe(false);
    expect(map.zones.find((z) => z.id === "cafeteria")).toBeDefined();
    // Justo delante del tablón (a un tile de su borde).
    const dx = Math.max(board!.x - tx, 0, tx - (board!.x + board!.w - 1));
    const dy = Math.max(board!.y - ty, 0, ty - (board!.y + board!.d - 1));
    expect(Math.max(dx, dy)).toBe(1);
  });
});
