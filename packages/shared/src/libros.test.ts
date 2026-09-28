import { describe, expect, it } from "vitest";
import { BOOK_TITLES, bookTitle } from "./casa";
import { BOOKS, bookOf } from "./libros";

describe("libros de las estanterías", () => {
  it("cada título tiene su libro, con páginas", () => {
    for (const t of BOOK_TITLES) {
      const b = BOOKS.find((b) => b.title === t);
      expect(b, t).toBeDefined();
      expect(b!.pages.length).toBeGreaterThanOrEqual(3);
      for (const p of b!.pages) expect(p.trim().length).toBeGreaterThan(0);
    }
    expect(BOOKS).toHaveLength(BOOK_TITLES.length);
  });

  it("la semilla abre el mismo libro que dice el globo", () => {
    for (const seed of [0, 3, 17, 255, -4, 1e6 + 7]) expect(bookOf(seed).title).toBe(bookTitle(seed));
  });

  it("ninguna página es tan larga que no quepa", () => {
    for (const b of BOOKS) for (const p of b.pages) expect(p.length, `${b.title}: ${p.slice(0, 30)}`).toBeLessThanOrEqual(340);
  });
});
