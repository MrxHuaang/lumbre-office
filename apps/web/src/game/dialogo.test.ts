import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirDialogo, cerrarDialogo, elegirOpcion, escaparDialogo, retenerDialogos, useDialogo, vaciarDialogos } from "./dialogo";

afterEach(() => useDialogo.setState({ actual: null, cola: [], retenida: false, extras: {} }));

describe("la tira en el juego", () => {
  it("una cinemática que empieza cierra la conversación abierta (avisándole) y retiene lo que llega", () => {
    const alCerrar = vi.fn();
    abrirDialogo({ quien: "efrain", nombre: "Don Efraín", lineas: ["Hola"], alCerrar });
    vaciarDialogos();
    retenerDialogos(true);
    expect(alCerrar).toHaveBeenCalledOnce();
    expect(useDialogo.getState().actual).toBeNull();
    abrirDialogo({ quien: "marina", nombre: "Profe Marina", lineas: ["Eso no es así."] });
    expect(useDialogo.getState().actual).toBeNull();
    const elegida = vi.fn(() => false);
    abrirDialogo({ quien: "cine:1", nombre: "Doña Aurora", lineas: ["¿Vamos?"], prioridad: true, opciones: [{ id: "si", label: "Sí" }], alElegir: elegida });
    expect(useDialogo.getState().actual?.quien).toBe("cine:1");
    elegirOpcion();
    expect(elegida).toHaveBeenCalledWith("si");
    expect(useDialogo.getState().actual).toBeNull();
    retenerDialogos(false);
    expect(useDialogo.getState().actual?.quien).toBe("marina");
  });

  it("una línea de momento interrumpe y la conversación vuelve con sus funciones", () => {
    const alcance = () => true;
    abrirDialogo({ quien: "efrain", nombre: "Don Efraín", lineas: ["Hola"], alcance });
    abrirDialogo({ quien: "cine:2", nombre: "", lineas: ["¡Jackpot!"], prioridad: true, modo: "momento", narrador: true });
    expect(useDialogo.getState().actual?.quien).toBe("cine:2");
    cerrarDialogo("cine:2");
    expect(useDialogo.getState().actual?.quien).toBe("efrain");
    expect(useDialogo.getState().extras.efrain?.alcance).toBe(alcance);
  });

  it("Esc hace lo que pidió quien habla (saltar la cinemática) o cierra", () => {
    const saltar = vi.fn();
    abrirDialogo({ quien: "cine:3", nombre: "", lineas: ["…"], prioridad: true, alEscapar: saltar });
    escaparDialogo();
    expect(saltar).toHaveBeenCalledOnce();
    expect(useDialogo.getState().actual?.quien).toBe("cine:3");
    cerrarDialogo();
    abrirDialogo({ quien: "efrain", nombre: "Don Efraín", lineas: ["Hola"] });
    escaparDialogo();
    expect(useDialogo.getState().actual).toBeNull();
  });

  it("cerrar la de alguien que espera en la cola la saca sin tocar la de ahora", () => {
    abrirDialogo({ quien: "efrain", nombre: "Don Efraín", lineas: ["Hola"] });
    abrirDialogo({ quien: "marina", nombre: "Profe Marina", lineas: ["Eso no es así."] });
    cerrarDialogo("marina");
    expect(useDialogo.getState().actual?.quien).toBe("efrain");
    expect(useDialogo.getState().cola).toEqual([]);
  });
});
