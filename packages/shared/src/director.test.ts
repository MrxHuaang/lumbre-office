import { describe, expect, it } from "vitest";
import { DIAS_POR_ESTACION, fechaDelJuego } from "./calendario";
import { gameTime, type GameClockState } from "./clock";
import { climaPermitido, DirectorAction, directorAccion, directorAviso, DIRECTOR_ACCIONES, irAEstacion, irAlDia, irAlFestival } from "./director";
import { FESTIVAL_IDS, festivalById } from "./festivales";

const NOW = 5_000_000;
/** Un reloj en el día `day` a la hora `h` (en el instante NOW). */
const at = (day: number, h: number): GameClockState => ({ anchorReal: NOW, anchorMinute: day * 1440 + h * 60 });
const fecha = (c: GameClockState) => {
  const t = gameTime(c, NOW);
  return { ...fechaDelJuego(t.day), hora: t.hour, day: t.day };
};

describe("acciones del director", () => {
  it("el esquema acepta lo del panel y rechaza lo raro", () => {
    expect(DirectorAction.safeParse({ kind: "festival", id: "carnaval" }).success).toBe(true);
    expect(DirectorAction.safeParse({ kind: "festival", id: null }).success).toBe(true);
    expect(DirectorAction.safeParse({ kind: "festival", id: "navidad" }).success).toBe(false);
    expect(DirectorAction.safeParse({ kind: "clima", weather: "lluvia", minutes: 30 }).success).toBe(true);
    expect(DirectorAction.safeParse({ kind: "clima", weather: "granizo" }).success).toBe(false);
    expect(DirectorAction.safeParse({ kind: "hora", minuteOfDay: 1440 }).success).toBe(false);
    expect(DirectorAction.safeParse({ kind: "dia", estacion: "verano", dia: 22 }).success).toBe(false);
  });

  it("los momentos tienen id único y, si piden festival, uno que existe", () => {
    const ids = DIRECTOR_ACCIONES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of DIRECTOR_ACCIONES) if (a.festival) expect(FESTIVAL_IDS).toContain(a.festival);
    expect(directorAccion("carnaval-desfile")?.festival).toBe("carnaval");
  });

  it("solo nieva en invierno", () => {
    expect(climaPermitido("nieve", "invierno")).toBe(true);
    expect(climaPermitido("nieve", "verano")).toBe(false);
    expect(climaPermitido("lluvia", "verano")).toBe(true);
  });
});

describe("saltos del reloj", () => {
  it("ir a un día va al próximo con esa fecha, a la misma hora, nunca para atrás", () => {
    const c = at(10, 15); // primavera 11, 15:00
    expect(fecha(irAlDia(c, NOW, "primavera", 5)!)).toMatchObject({ estacion: "primavera", diaDeEstacion: 5, hora: 15, año: 2 });
    expect(irAlDia(c, NOW, "primavera", 11)).toBeNull();
    expect(fecha(irAlDia(c, NOW, "verano", 1)!)).toMatchObject({ estacion: "verano", diaDeEstacion: 1, año: 1 });
  });

  it("los atajos de estación van al día 1 (y no hacen nada si ya es esa)", () => {
    const c = at(3, 8);
    expect(irAEstacion(c, NOW, "primavera")).toBeNull();
    expect(fecha(irAEstacion(c, NOW, "invierno")!)).toMatchObject({ estacion: "invierno", diaDeEstacion: 1, hora: 8 });
  });

  it("ir al festival llega con la fiesta abierta, a las 10:00", () => {
    const carnaval = festivalById("carnaval")!;
    expect(fecha(irAlFestival(at(0, 15), NOW, "carnaval")!)).toMatchObject({ estacion: carnaval.estacion, diaDeEstacion: carnaval.dia, hora: 10 });
    // Ese mismo día antes de abrir: solo adelanta la hora; abierto: nada; cerrado: el del año que viene.
    const dia = 1 * DIAS_POR_ESTACION + carnaval.dia - 1;
    expect(fecha(irAlFestival(at(dia, 7), NOW, "carnaval")!)).toMatchObject({ day: dia, hora: 10 });
    expect(irAlFestival(at(dia, 12), NOW, "carnaval")).toBeNull();
    expect(fecha(irAlFestival(at(dia, 23), NOW, "carnaval")!)).toMatchObject({ diaDeEstacion: carnaval.dia, año: 2 });
  });

  it("las novenas duran varios días: cerrado uno, va al siguiente de la novena", () => {
    const novenas = festivalById("novenas")!;
    const dia = 3 * DIAS_POR_ESTACION + novenas.dia - 1;
    expect(fecha(irAlFestival(at(dia, 23), NOW, "novenas")!)).toMatchObject({ day: dia + 1, hora: 10 });
  });

  it("el reloj en pausa sigue en pausa", () => {
    expect(irAEstacion({ ...at(0, 8), paused: true }, NOW, "verano")!.paused).toBe(true);
  });
});

describe("avisos del chat", () => {
  it("dicen quién y qué cambió", () => {
    expect(directorAviso("Juan", { kind: "clima", weather: "lluvia" })).toBe("Juan cambió el clima a lluvia.");
    expect(directorAviso("Juan", { kind: "clima", weather: "niebla", minutes: 30 })).toBe("Juan cambió el clima a niebla por 30 minutos.");
    expect(directorAviso("Juan", { kind: "festival", id: "carnaval" })).toBe("Juan prendió Carnaval de Negros y Blancos.");
    expect(directorAviso("Juan", { kind: "hora", minuteOfDay: 600 }, { reloj: "Lun 1 de Primavera, 10:00" })).toBe("Juan movió el reloj de la cabaña: Lun 1 de Primavera, 10:00.");
    expect(directorAviso("Juan", { kind: "momento", id: "apertura" }, { festival: "la Feria" })).toBe("Juan repitió la apertura de la Feria.");
  });
});
