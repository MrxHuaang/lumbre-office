import { describe, expect, it } from "vitest";
import { abrir, avanzar, blipEn, cerrar, conOpciones, decir, DIALOGO_VACIO, hayMas, mover, msDeLinea, msMomento, retener, tonoDeVoz, vaciar, type DialogoDef } from "./dialogo";

const efrain: DialogoDef = { quien: "efrain", nombre: "Don Efraín", lineas: ["Hola, mijo.", "¿Me trae dos mazorcas?"], opciones: [{ id: "si", label: "Entregar" }, { id: "no", label: "Ahora no" }] };
const marina: DialogoDef = { quien: "marina", nombre: "Profe Marina", lineas: ["Eso no es así."] };

describe("la tira de conversación", () => {
  it("una sola a la vez: la de otra persona espera en la cola; la de la misma, reemplaza", () => {
    let e = abrir(DIALOGO_VACIO, efrain);
    e = abrir(e, marina);
    expect(e.actual?.quien).toBe("efrain");
    expect(e.cola.map((d) => d.quien)).toEqual(["marina"]);
    e = abrir(e, { ...efrain, lineas: ["Otra cosa"] });
    expect(e.actual?.lineas).toEqual(["Otra cosa"]);
    e = cerrar(e);
    expect(e.actual?.quien).toBe("marina");
    expect(cerrar(e).actual).toBeNull();
  });

  it("línea por línea; al final, las opciones (no se cierra sin elegir) y sin opciones se cierra", () => {
    let e = abrir(DIALOGO_VACIO, efrain);
    expect(hayMas(e.actual!)).toBe(true);
    expect(conOpciones(e.actual!)).toBe(false);
    const key = e.actual!.key;
    e = avanzar(e);
    expect(e.actual!.linea).toBe(1);
    expect(e.actual!.key).not.toBe(key);
    expect(conOpciones(e.actual!)).toBe(true);
    expect(avanzar(e)).toBe(e);
    e = mover(e, 1);
    expect(e.actual!.elegida).toBe(1);
    e = mover(e, 1);
    expect(e.actual!.elegida).toBe(0);
    expect(mover(e, -1).actual!.elegida).toBe(1);
    expect(avanzar(abrir(DIALOGO_VACIO, marina)).actual).toBeNull();
  });

  it("decir cambia lo que dice quien habla (y no toca a otro)", () => {
    const e = abrir(DIALOGO_VACIO, efrain);
    const gracias = decir(e, "efrain", ["¡Gracias!"]);
    expect(gracias.actual).toMatchObject({ lineas: ["¡Gracias!"], linea: 0, opciones: undefined });
    expect(decir(e, "marina", ["x"])).toBe(e);
  });

  it("una cinemática pasa delante: la conversación vuelve a la cola, adelante, y sale después", () => {
    const cine: DialogoDef = { quien: "cine:1", nombre: "Doña Aurora", lineas: ["¡Mijo!"], prioridad: true };
    let e = abrir(abrir(DIALOGO_VACIO, efrain), marina);
    e = avanzar(e);
    e = abrir(e, cine);
    expect(e.actual?.quien).toBe("cine:1");
    expect(e.cola.map((d) => d.quien)).toEqual(["efrain", "marina"]);
    // La que vuelve empieza desde su primera línea.
    expect(e.cola[0]).not.toHaveProperty("linea");
    // Otra línea de cinemática mientras habla la primera: espera primera en la cola.
    e = abrir(e, { ...cine, quien: "cine:2" });
    expect(e.cola.map((d) => d.quien)).toEqual(["cine:2", "efrain", "marina"]);
    e = cerrar(e);
    expect(e.actual?.quien).toBe("cine:2");
    e = cerrar(e);
    expect(e.actual).toMatchObject({ quien: "efrain", linea: 0 });
  });

  it("retenida (cinemática de historia): lo demás espera, la cinemática habla, y al soltarla sale lo que esperaba", () => {
    const cine: DialogoDef = { quien: "cine:1", nombre: "", lineas: ["Era de noche."], prioridad: true, narrador: true };
    let e = retener(DIALOGO_VACIO, true);
    e = abrir(e, efrain);
    expect(e.actual).toBeNull();
    e = abrir(e, cine);
    expect(e.actual?.quien).toBe("cine:1");
    // Al cerrarse la línea de la cinemática no sale la conversación: sigue retenida.
    e = cerrar(e);
    expect(e.actual).toBeNull();
    expect(e.cola.map((d) => d.quien)).toEqual(["efrain"]);
    e = retener(e, false);
    expect(e.actual?.quien).toBe("efrain");
    expect(retener(e, false)).toBe(e);
  });

  it("vaciar cierra lo que no es de la cinemática y dice qué cerró", () => {
    const cine: DialogoDef = { quien: "cine:1", nombre: "", lineas: ["…"], prioridad: true };
    const e = abrir(abrir(DIALOGO_VACIO, efrain), marina);
    const { estado, cerradas } = vaciar(e);
    expect(cerradas).toEqual(["efrain", "marina"]);
    expect(estado.actual).toBeNull();
    expect(estado.cola).toEqual([]);
    const conCine = vaciar(abrir(abrir(DIALOGO_VACIO, cine), efrain));
    expect(conCine.cerradas).toEqual(["efrain"]);
    expect(conCine.estado.actual?.quien).toBe("cine:1");
  });

  it("la voz, el blip y el modo momento", () => {
    expect(msDeLinea({ ms: 900 }, "Hola", 40)).toBe(900);
    // Una línea larga no se va antes de terminar de escribirse.
    expect(msDeLinea({ ms: 900 }, "x".repeat(80), 40)).toBe(2500);
    expect(msDeLinea({}, "Hola", 40)).toBe(msMomento("Hola", 40));
    expect(tonoDeVoz(0)).toBeLessThan(tonoDeVoz(1));
    expect(tonoDeVoz(5)).toBe(tonoDeVoz(1));
    expect(blipEn(0, "a")).toBe(true);
    expect(blipEn(1, "a")).toBe(false);
    expect(blipEn(2, " ")).toBe(false);
    expect(blipEn(4, "ñ")).toBe(true);
    expect(msMomento("Hola", 40)).toBeGreaterThan(1600);
  });
});
