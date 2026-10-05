import { describe, expect, it } from "vitest";
import { bagItemInfo } from "./bolsa";
import { cineById } from "./cinematicas";
import { FESTIVAL_HORAS, festivalById } from "./festivales";
import { cleanDeseo, FAROL_ITEM, metaAlcanzada, VELITA_ITEM, VELITAS, VELITAS_CINE, velitasNoticeText, velitasTexto, type VelitasNoticeCode } from "./velitas";

describe("Noche de velitas", () => {
  it("el deseo se limpia: un renglón, sin espacios de sobra", () => {
    expect(cleanDeseo("  que   todos\nestemos\tbien  ")).toEqual({ ok: true, text: "que todos estemos bien" });
  });

  it("el deseo vacío, largo o con enlaces no se suelta", () => {
    expect(cleanDeseo("   ")).toEqual({ ok: false, error: "vacio" });
    expect(cleanDeseo("a".repeat(VELITAS.deseoMax + 1))).toEqual({ ok: false, error: "largo" });
    expect(cleanDeseo("a".repeat(VELITAS.deseoMax)).ok).toBe(true);
    for (const t of ["mira https://x.y", "entren a www.algo", "visiten casino.com ya", "mi-sitio.co"]) expect(cleanDeseo(t), t).toEqual({ ok: false, error: "enlace" });
    // Un punto al final de una frase no es un enlace.
    expect(cleanDeseo("Salud. Y amor.").ok).toBe(true);
  });

  it("las metas del equipo salen justo al llegar", () => {
    expect(metaAlcanzada(49)).toBeNull();
    expect(metaAlcanzada(50)).toBe(50);
    expect(metaAlcanzada(100)).toBe(100);
    expect(metaAlcanzada(200)).toBe(200);
    expect(metaAlcanzada(201)).toBeNull();
    expect(velitasTexto(1)).toBe("1 velita prendida");
    expect(velitasTexto(12)).toBe("12 velitas prendidas");
  });

  it("los topes dejan llegar a las metas y el regalo cabe en la mochila", () => {
    expect(VELITAS.porPersona).toBeLessThanOrEqual(VELITAS.total);
    expect(Math.max(...VELITAS.metas)).toBeLessThanOrEqual(VELITAS.total);
    expect(VELITAS.regalo).toBeLessThanOrEqual(bagItemInfo(VELITA_ITEM).max);
    expect(bagItemInfo(VELITA_ITEM).name).toBe("Velita");
    expect(bagItemInfo(FAROL_ITEM).name).toBe("Farol de deseos");
  });

  it("cada meta y la suelta de faroles tienen su cinemática", () => {
    for (const n of VELITAS.metas) expect(cineById(VELITAS_CINE.meta(n))?.kind).toBe("momento");
    expect(cineById(VELITAS_CINE.faroles)).toBeDefined();
  });

  it("la suelta de faroles es un momento del festival, ya de noche y antes del cierre", () => {
    const m = festivalById("velitas")!.momentos!;
    expect(m).toHaveLength(1);
    expect(m[0]!.cine).toBe(VELITAS_CINE.faroles);
    expect(m[0]!.minuto).toBeGreaterThanOrEqual(19 * 60);
    expect(m[0]!.minuto).toBeLessThan(FESTIVAL_HORAS.cierre * 60);
  });

  it("todo aviso tiene su texto", () => {
    const codes: VelitasNoticeCode[] = ["cerrado", "lejos", "ocupado", "bloqueado", "tope", "lleno", "sinVelitas", "llena", "regalo", "muelle", "sinFarol", "yaDeseo", "vacio", "largo", "enlace", "soltado"];
    for (const code of codes) expect(velitasNoticeText({ code }).length, code).toBeGreaterThan(5);
    expect(velitasNoticeText({ code: "regalo", n: 20, farol: true })).toContain("20 velitas y un farol");
  });
});
