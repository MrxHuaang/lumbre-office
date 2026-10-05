import type { PhotoDTO } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { casaOwnerOf, photosOfPerson } from "./casaGaleria";

const photo = (id: string, by: string, people: string[]): PhotoDTO => ({
  id,
  takenBy: { id: by, name: by },
  area: "jardin",
  caption: "",
  people: people.map((p) => ({ id: p, name: p })),
  pinned: true,
  createdAt: "2026-10-05T00:00:00.000Z",
  mime: "image/png",
  mine: false,
  canManage: false,
});

describe("la galería de la casa", () => {
  it("el dueño sale del nivel de la casa, en cualquier piso", () => {
    expect(casaOwnerOf("casa:u1")).toBe("u1");
    expect(casaOwnerOf("casa:u1:arriba")).toBe("u1");
    expect(casaOwnerOf("piso-2")).toBeNull();
  });

  it("las fotos de alguien: las que sacó y en las que sale", () => {
    const list = [photo("a", "u1", []), photo("b", "u2", ["u1", "u3"]), photo("c", "u2", ["u3"])];
    expect(photosOfPerson(list, "u1").map((p) => p.id)).toEqual(["a", "b"]);
    expect(photosOfPerson(list, "u4")).toEqual([]);
  });
});
