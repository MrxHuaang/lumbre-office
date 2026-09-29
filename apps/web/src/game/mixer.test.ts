import { describe, expect, it } from "vitest";
import { audible, categoryGain, categoryVolume, getMixer, MIXER_DEFAULTS, mediaScale, setMixer, subscribeMixer } from "./mixer";

describe("mezclador", () => {
  it("cada salida es el general por la suya; la ganancia, al cuadrado", () => {
    setMixer({ ...MIXER_DEFAULTS });
    expect(categoryVolume("effects")).toBeCloseTo(0.7);
    expect(categoryGain("effects")).toBeCloseTo(0.49);
    setMixer({ master: 0.5 });
    expect(categoryVolume("music")).toBeCloseTo(0.35);
    setMixer({ ambient: 0 });
    expect(audible("ambient")).toBe(false);
    expect(audible("notify")).toBe(true);
  });

  it("el silencio calla todo y los videos siguen al control de la música", () => {
    setMixer({ ...MIXER_DEFAULTS });
    expect(mediaScale("music")).toBeCloseTo(1);
    setMixer({ music: 0.35 });
    expect(mediaScale("music")).toBeCloseTo(0.5);
    setMixer({ music: 1 });
    // YouTube no pasa de 100.
    expect(mediaScale("music")).toBe(1);
    setMixer({ muted: true });
    expect(categoryGain("notify")).toBe(0);
    expect(mediaScale("music")).toBe(0);
    setMixer({ ...MIXER_DEFAULTS });
  });

  it("avisa los cambios y guarda el mismo objeto mientras no cambie", () => {
    let seen = 0;
    const off = subscribeMixer(() => seen++);
    const before = getMixer();
    expect(getMixer()).toBe(before);
    setMixer({ effects: 0.2 });
    expect(getMixer()).not.toBe(before);
    off();
    expect(seen).toBe(1);
    setMixer({ ...MIXER_DEFAULTS });
  });
});
