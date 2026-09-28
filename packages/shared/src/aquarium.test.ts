import { describe, expect, it } from "vitest";
import { aquariumEntries, pickAquariumFish, type TeamFishEntry } from "./aquarium";

const entry = (species: string, lastAt: string, count = 1): TeamFishEntry => ({
  species,
  count,
  best: 10,
  bestBy: "Ana",
  catchers: [{ name: "Ana", count }],
  people: 1,
  lastAt,
});

describe("acuario", () => {
  const entries = [
    entry("mojarra", "2026-09-20T10:00:00Z", 12),
    entry("bota", "2026-09-27T10:00:00Z", 3),
    entry("koi", "2026-09-21T10:00:00Z"),
    entry("carpa", "2026-09-26T10:00:00Z"),
    entry("bigoton", "2026-09-01T10:00:00Z"),
    entry("no-existe", "2026-09-27T10:00:00Z"),
  ];

  it("deja afuera la basura y lo que ya no está en el catálogo", () => {
    expect(aquariumEntries(entries).map((e) => e.species)).toEqual(["bigoton", "koi", "carpa", "mojarra"]);
  });

  it("primero los más raros y, entre iguales, los más recientes; con tope", () => {
    expect(pickAquariumFish(entries, 3)).toEqual(["bigoton", "koi", "carpa"]);
    expect(pickAquariumFish([], 8)).toEqual([]);
    expect(pickAquariumFish(entries, 0)).toEqual([]);
  });
});
