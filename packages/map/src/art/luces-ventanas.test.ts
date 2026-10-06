import { describe, expect, it } from "vitest";
import { catalogItem } from "../world/catalog";
import { busHeadlightBeam, busNightWindows, busTailGlow } from "./luces-bus";
import { capasDeLuz, horarioDeLuz, LUCES_DE_NOCHE, luzPrendida, puntoDeLuz, semillaDeLuz, titila, titileo } from "./luces-ventanas";
import { drawOutdoor } from "./outdoor";
import { toScreen } from "./pixel";

const opacos = (c: { data: Uint8ClampedArray }) => {
  let n = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i]) n++;
  return n;
};

describe("ventanas prendidas de noche", () => {
  it("cada edificio con luces es un mueble fijo con versión de noche", () => {
    for (const type of Object.keys(LUCES_DE_NOCHE)) {
      const item = catalogItem(type);
      expect(item.fixed, type).toBe(true);
      expect(item.hasNight, type).toBe(true);
    }
  });

  it("las ventanas caen sobre su edificio y casi todas se ven prendidas en su dibujo de noche", () => {
    for (const [type, lista] of Object.entries(LUCES_DE_NOCHE)) {
      const dibujos = { noche: drawOutdoor(type, true), dia: drawOutdoor(type, false) };
      const { canvas, ox, oy } = dibujos.noche;
      let conLuz = 0;
      lista.forEach((v, i) => {
        // El centro del vidrio cae dentro del dibujo del edificio.
        const p = puntoDeLuz(v.sup, v.w / 2, v.h / 2);
        expect(p, `${type} #${i}`).not.toBeNull();
        const s = toScreen(p![0], p![1], p![2]);
        expect(s.x + ox, `${type} #${i}`).toBeGreaterThanOrEqual(0);
        expect(s.y + oy, `${type} #${i}`).toBeGreaterThanOrEqual(0);
        expect(s.x + ox, `${type} #${i}`).toBeLessThan(canvas.width);
        expect(s.y + oy, `${type} #${i}`).toBeLessThan(canvas.height);
        const c = capasDeLuz(type, i, dibujos);
        if (c && opacos(c.brillo.canvas) > 0) conLuz++;
      });
      // Las que tapa otra parte del edificio no se prenden; si el dibujo cambia y las deja todas fuera, algo
      // se corrió: hay que revisar las posiciones.
      expect(conLuz / lista.length, type).toBeGreaterThanOrEqual(0.5);
    }
  }, 30_000);

  it("solo se prenden de noche", () => {
    for (let s = 0; s < 60; s++) {
      const semilla = semillaDeLuz("house", 42, 4, s);
      for (let m = 7 * 60; m < 19 * 60; m += 7) {
        expect(luzPrendida({ horario: "hogar" }, semilla, 3, m)).toBe(false);
        expect(luzPrendida({ horario: "siempre" }, semilla, 3, m)).toBe(false);
      }
      expect(luzPrendida({ horario: "siempre" }, semilla, 3, 23 * 60)).toBe(true);
      expect(luzPrendida({ horario: "siempre" }, semilla, 3, 4 * 60)).toBe(true);
    }
  });

  it("lo que sale de la semilla es estable y se ve vivo", () => {
    expect(semillaDeLuz("house", 42, 4, 3)).toBe(semillaDeLuz("house", 42, 4, 3));
    expect(semillaDeLuz("house", 42, 4, 3)).not.toBe(semillaDeLuz("house", 42, 4, 4));
    const semillas = Array.from({ length: 300 }, (_, i) => semillaDeLuz("casa-finca", 13, 1, i));
    const prendidas = (dia: number, m: number) => semillas.filter((s) => luzPrendida({ horario: "hogar" }, s, dia, m)).length;
    // Igual cada vez que se pregunta.
    expect(prendidas(5, 21 * 60)).toBe(prendidas(5, 21 * 60));
    expect(horarioDeLuz(semillas[7]!, 5)).toEqual(horarioDeLuz(semillas[7]!, 5));
    // Al anochecer ya hay algunas; más tarde, más; pasada la medianoche se apagan unas y antes del amanecer
    // vuelven otras.
    const anochecer = prendidas(5, 19 * 60 + 10);
    const noche = prendidas(5, 22 * 60 + 30);
    const madrugada = prendidas(5, 3 * 60);
    const alba = prendidas(5, 6 * 60 + 40);
    expect(anochecer).toBeGreaterThan(0);
    expect(noche).toBeGreaterThan(anochecer);
    expect(noche).toBeLessThan(semillas.length);
    expect(madrugada).toBeLessThan(noche);
    expect(alba).toBeGreaterThan(madrugada);
    // Cada noche distinta: no todas las ventanas repiten el mismo horario.
    expect(semillas.some((s) => JSON.stringify(horarioDeLuz(s, 5)) !== JSON.stringify(horarioDeLuz(s, 6)))).toBe(true);
    // Unas pocas titilan, muy suave.
    const titilan = semillas.filter((s) => titila({ tono: "hogar" }, s)).length;
    expect(titilan).toBeGreaterThan(0);
    expect(titilan).toBeLessThan(semillas.length / 2);
    for (let ms = 0; ms < 5000; ms += 37) {
      const k = titileo(semillas[0]!, ms);
      expect(k).toBeGreaterThanOrEqual(0.7);
      expect(k).toBeLessThanOrEqual(1);
    }
  });

  it("el Megabús de noche tiene ventanas, faros y luces de atrás", () => {
    expect(opacos(busNightWindows("front").canvas)).toBeGreaterThan(500);
    expect(opacos(busNightWindows("rear").canvas)).toBeGreaterThan(500);
    expect(opacos(busHeadlightBeam().canvas)).toBeGreaterThan(200);
    expect(opacos(busTailGlow().canvas)).toBeGreaterThan(30);
  });
});
