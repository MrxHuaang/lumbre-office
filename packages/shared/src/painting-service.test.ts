import { describe, expect, it } from "vitest";
import {
  BLANK_PAINTING,
  cleanPaintingTitle,
  PAINTING,
  PAINTING_PALETTE,
  PAINTING_PIXELS,
  paintingIdOf,
  paintingItemId,
} from "./painting";
import { createPainting, deletePainting, getPainting, listMyPaintings, type PaintingRecord, type PaintingStore } from "./painting-service";

/** Almacén en memoria: la mochila es un Set de ids por persona; `hang` simula colgarlo en la oficina. */
function memoryStore() {
  const rows: PaintingRecord[] = [];
  const backpack = new Set<string>();
  let n = 0;
  const store: PaintingStore = {
    async create(input, rules) {
      if (rows.filter((r) => r.userId === input.userId).length >= rules.max) return "limit";
      const row = { ...input, id: `cuadro${String(++n).padStart(4, "0")}`, authorName: `Nombre de ${input.userId}`, createdAt: new Date(1_700_000_000_000 + n) };
      rows.push(row);
      backpack.add(row.id);
      return row;
    },
    async listByUser(userId) {
      return rows
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((r) => ({ ...r, inBackpack: backpack.has(r.id) }));
    },
    async find(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async removeFromBackpack(userId, id) {
      const i = rows.findIndex((r) => r.id === id && r.userId === userId);
      if (i < 0) return "not-found";
      if (!backpack.has(id)) return "hung";
      backpack.delete(id);
      rows.splice(i, 1);
      return "ok";
    },
  };
  return { store, hang: (id: string) => backpack.delete(id) };
}

const ana = { id: "u-ana" };
const beto = { id: "u-beto" };
/** Un corazón rojo con cielo al lado (con letras, para probar las mayúsculas). */
const heart = BLANK_PAINTING.slice(0, 100) + "77bb" + BLANK_PAINTING.slice(104);

describe("reglas de la Pintura", () => {
  it("la paleta tiene un color por dígito hexadecimal y el lienzo es de 16x16", () => {
    expect(PAINTING_PALETTE).toHaveLength(16);
    expect(PAINTING_PIXELS).toBe(256);
    expect(BLANK_PAINTING).toHaveLength(256);
  });

  it("el mueble de un cuadro es cuadro:<id> y se reconoce solo si el id es válido", () => {
    expect(paintingItemId("abc12345")).toBe("cuadro:abc12345");
    expect(paintingIdOf("cuadro:abc12345")).toBe("abc12345");
    expect(paintingIdOf("cuadro:")).toBeNull();
    expect(paintingIdOf("cuadro:../../x")).toBeNull();
    expect(paintingIdOf("cuadro:ABC12345")).toBeNull();
    expect(paintingIdOf("plant")).toBeNull();
  });

  it("limpia el título y pone uno si viene vacío", () => {
    expect(cleanPaintingTitle("  mi   gato  ")).toBe("mi gato");
    expect(cleanPaintingTitle("   ")).toBe("Sin título");
    expect(cleanPaintingTitle("x".repeat(100))).toHaveLength(PAINTING.titleMax);
  });
});

describe("API de la Pintura", () => {
  it("guarda un cuadro en la mochila de quien lo pintó", async () => {
    const { store } = memoryStore();
    const res = await createPainting(store, ana, { title: "Corazón", pixels: heart });
    expect(res).toMatchObject({ ok: true, value: { title: "Corazón", pixels: heart, inBackpack: true } });
    const mine = await listMyPaintings(store, ana);
    expect(mine.ok && mine.value.map((p) => p.title)).toEqual(["Corazón"]);
    const others = await listMyPaintings(store, beto);
    expect(others.ok && others.value).toEqual([]);
  });

  it("rechaza sin sesión, lienzos mal formados y en blanco", async () => {
    const { store } = memoryStore();
    expect(await createPainting(store, null, { pixels: heart })).toEqual({ ok: false, error: "auth" });
    expect(await createPainting(store, ana, { pixels: "0".repeat(255) })).toEqual({ ok: false, error: "invalid" });
    expect(await createPainting(store, ana, { pixels: heart.replace("7", "g") })).toEqual({ ok: false, error: "invalid" });
    expect(await createPainting(store, ana, { pixels: heart.toUpperCase() })).toEqual({ ok: false, error: "invalid" });
    expect(await createPainting(store, ana, { pixels: BLANK_PAINTING })).toEqual({ ok: false, error: "blank" });
  });

  it("tiene un tope de cuadros por persona", async () => {
    const { store } = memoryStore();
    for (let i = 0; i < PAINTING.maxPerUser; i++) expect((await createPainting(store, ana, { pixels: heart })).ok).toBe(true);
    expect(await createPainting(store, ana, { pixels: heart })).toEqual({ ok: false, error: "limit" });
    // El tope es por persona.
    expect((await createPainting(store, beto, { pixels: heart })).ok).toBe(true);
  });

  it("cualquiera con sesión ve un cuadro colgado (para dibujarlo)", async () => {
    const { store } = memoryStore();
    const res = await createPainting(store, ana, { pixels: heart });
    const id = res.ok ? res.value.id : "";
    expect(await getPainting(store, beto, id)).toMatchObject({ ok: true, value: { pixels: heart } });
    expect(await getPainting(store, null, id)).toEqual({ ok: false, error: "auth" });
    expect(await getPainting(store, beto, "nada")).toEqual({ ok: false, error: "not-found" });
  });

  it("solo se borra un cuadro propio y que esté en la mochila", async () => {
    const { store, hang } = memoryStore();
    const a = await createPainting(store, ana, { pixels: heart });
    const b = await createPainting(store, ana, { pixels: heart });
    const [ida, idb] = [a.ok ? a.value.id : "", b.ok ? b.value.id : ""];
    expect(await deletePainting(store, beto, ida)).toEqual({ ok: false, error: "not-found" });
    hang(idb);
    expect(await deletePainting(store, ana, idb)).toEqual({ ok: false, error: "hung" });
    expect(await deletePainting(store, ana, ida)).toEqual({ ok: true, value: null });
    const mine = await listMyPaintings(store, ana);
    expect(mine.ok && mine.value.map((p) => [p.id, p.inBackpack])).toEqual([[idb, false]]);
  });
});
