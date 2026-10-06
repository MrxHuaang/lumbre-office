import { describe, expect, it } from "vitest";
import { abrir, avanzar, blipEn, cerrar, conOpciones, decir, DIALOGO_VACIO, hayMas, mover, msMomento, tonoDeVoz, type DialogoDef } from "./dialogo";

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

  it("la voz, el blip y el modo momento", () => {
    expect(tonoDeVoz(0)).toBeLessThan(tonoDeVoz(1));
    expect(tonoDeVoz(5)).toBe(tonoDeVoz(1));
    expect(blipEn(0, "a")).toBe(true);
    expect(blipEn(1, "a")).toBe(false);
    expect(blipEn(2, " ")).toBe(false);
    expect(blipEn(4, "ñ")).toBe(true);
    expect(msMomento("Hola", 40)).toBeGreaterThan(1600);
  });
});
