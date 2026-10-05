import { describe, expect, it } from "vitest";
import {
  DIAS_POR_AÑO,
  DIAS_POR_ESTACION,
  añoTexto,
  calendarMarks,
  cumpleañosEnEstacion,
  diaDelJuegoDeFecha,
  estacionDelDia,
  estacionDelJuego,
  fechaCorta,
  fechaDelJuego,
  fechaPlaca,
} from "./calendario";
import { GAME_DAY_REAL_MS, pauseClock } from "./clock";
import { SEASONS } from "./estaciones";

describe("el calendario del juego", () => {
  it("cada estación dura 21 días (3 semanas de 7) y el año 84", () => {
    expect(DIAS_POR_ESTACION).toBe(21);
    expect(DIAS_POR_AÑO).toBe(84);
    expect(fechaDelJuego(0)).toEqual({ año: 1, estacion: "primavera", diaDeEstacion: 1, semana: 1, diaSemana: 0, nombreDia: "lunes", diaDelAño: 0 });
    expect(fechaDelJuego(20)).toMatchObject({ estacion: "primavera", diaDeEstacion: 21, semana: 3, nombreDia: "domingo" });
    expect(fechaDelJuego(21)).toMatchObject({ estacion: "verano", diaDeEstacion: 1, semana: 1, nombreDia: "lunes" });
    expect(fechaDelJuego(65)).toMatchObject({ estacion: "invierno", diaDeEstacion: 3, diaSemana: 2, nombreDia: "miércoles" });
    expect(fechaDelJuego(84)).toMatchObject({ año: 2, estacion: "primavera", diaDeEstacion: 1, diaDelAño: 0 });
  });

  it("las estaciones van en orden y se repiten cada año", () => {
    for (let d = 0; d < 3 * DIAS_POR_AÑO; d++) {
      expect(estacionDelDia(d)).toBe(SEASONS[Math.floor((d % DIAS_POR_AÑO) / DIAS_POR_ESTACION)]);
      expect(fechaDelJuego(d).diaSemana).toBe(d % 7);
    }
  });

  it("los textos: 'Mié 3 de Otoño', la placa y el año", () => {
    const f = fechaDelJuego(2 * DIAS_POR_AÑO + 42 + 2);
    expect(fechaCorta(f)).toBe("Mié 3 de Otoño");
    expect(fechaPlaca(f)).toBe("Mié 3 · Otoño");
    expect(añoTexto(f)).toBe("año 3");
  });

  it("la estación sale del reloj del juego (y queda quieta con el reloj en pausa)", () => {
    const clock = { anchorReal: 0, anchorMinute: 20 * 1440 + 23 * 60 };
    expect(estacionDelJuego(clock, 0)).toBe("primavera");
    expect(estacionDelJuego(clock, GAME_DAY_REAL_MS / 24)).toBe("verano");
    const paused = pauseClock(clock, 0);
    expect(estacionDelJuego(paused, 100 * GAME_DAY_REAL_MS)).toBe("primavera");
  });

  it("los festivales todavía no están (los agrega otro cambio)", () => {
    for (const s of SEASONS) expect(calendarMarks(s)).toEqual([]);
  });
});

describe("los cumpleaños en el calendario", () => {
  it("una fecha real cae en un día del año del juego, con el 1 de marzo en el 1 de primavera", () => {
    expect(diaDelJuegoDeFecha("03-01")).toBe(0);
    expect(diaDelJuegoDeFecha("02-28")).toBe(83);
    expect(diaDelJuegoDeFecha("02-29")).toBe(83);
    expect(estacionDelDia(diaDelJuegoDeFecha("07-15")!)).toBe("verano");
    expect(estacionDelDia(diaDelJuegoDeFecha("10-20")!)).toBe("otono");
    expect(estacionDelDia(diaDelJuegoDeFecha("12-24")!)).toBe("invierno");
    expect(diaDelJuegoDeFecha("13-01")).toBeNull();
    expect(diaDelJuegoDeFecha("nada")).toBeNull();
    // Todo el año real (desde marzo) cae adentro del año del juego, sin saltos para atrás.
    let prev = -1;
    for (let m = 3; m < 15; m++) {
      const mes = ((m - 1) % 12) + 1;
      for (const d of [1, 15, 28]) {
        const g = diaDelJuegoDeFecha(`${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`)!;
        expect(g).toBeGreaterThanOrEqual(prev);
        expect(g).toBeLessThan(DIAS_POR_AÑO);
        prev = g;
      }
    }
  });

  it("solo salen los de esa estación, con su día", () => {
    const people = [
      { name: "Ana", birthday: "03-01" },
      { name: "Beto", birthday: "12-24" },
      { name: "Caro", birthday: "05-30" },
    ];
    const spring = cumpleañosEnEstacion(people, "primavera");
    expect(spring.map((m) => m.texto)).toEqual(["Cumpleaños de Ana", "Cumpleaños de Caro"]);
    expect(spring[0]).toMatchObject({ dia: 1, tipo: "cumpleaños" });
    expect(spring[1]!.dia).toBeLessThanOrEqual(DIAS_POR_ESTACION);
    expect(cumpleañosEnEstacion(people, "invierno").map((m) => m.texto)).toEqual(["Cumpleaños de Beto"]);
    expect(cumpleañosEnEstacion(people, "verano")).toEqual([]);
  });
});
