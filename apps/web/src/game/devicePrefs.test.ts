import { describe, expect, it } from "vitest";
import { audioCapture, chimeWav, DEFAULT_PREFS, levelFromSamples, mediaErrorMessage, parsePrefs } from "./devicePrefs";

describe("preferencias de dispositivos", () => {
  it("sin nada guardado, las ayudas de audio vienen prendidas", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS.noiseSuppression && DEFAULT_PREFS.echoCancellation && DEFAULT_PREFS.autoGainControl).toBe(true);
  });

  it("lee lo guardado y descarta lo que no sirve", () => {
    const raw = JSON.stringify({ audioinput: "mic-1", videoinput: 42, noiseSuppression: false, autoGainControl: "sí" });
    expect(parsePrefs(raw)).toEqual({ ...DEFAULT_PREFS, audioinput: "mic-1", noiseSuppression: false });
  });

  it("aguanta JSON roto o de otra forma", () => {
    expect(parsePrefs("{nope")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("[1,2]")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('"hola"')).toEqual(DEFAULT_PREFS);
  });

  it("las opciones de captura llevan el micrófono solo si se eligió uno", () => {
    expect(audioCapture(DEFAULT_PREFS)).toEqual({
      noiseSuppression: true,
      voiceIsolation: true,
      echoCancellation: true,
      autoGainControl: true,
    });
    expect(audioCapture({ ...DEFAULT_PREFS, audioinput: "mic-2", echoCancellation: false })).toMatchObject({
      deviceId: "mic-2",
      echoCancellation: false,
    });
  });
});

describe("medidor del micrófono", () => {
  it("silencio es cero y una señal fuerte llena el medidor", () => {
    expect(levelFromSamples(new Uint8Array(256).fill(128))).toBe(0);
    const loud = Uint8Array.from({ length: 256 }, (_, i) => (i % 2 ? 250 : 6));
    expect(levelFromSamples(loud)).toBe(1);
    expect(levelFromSamples([])).toBe(0);
  });

  it("la voz normal queda a media barra", () => {
    // Seno con RMS ~0.07 (voz a volumen normal).
    const voice = Uint8Array.from({ length: 1024 }, (_, i) => 128 + Math.round(Math.sin(i / 5) * 128 * 0.1));
    const level = levelFromSamples(voice);
    expect(level).toBeGreaterThan(0.3);
    expect(level).toBeLessThan(0.7);
  });
});

describe("sonido de prueba", () => {
  it("es un WAV PCM mono válido y corto", () => {
    const wav = chimeWav(8000);
    const view = new DataView(wav.buffer);
    const text = (at: number) => String.fromCharCode(...wav.slice(at, at + 4));
    expect(text(0)).toBe("RIFF");
    expect(text(8)).toBe("WAVE");
    expect(text(36)).toBe("data");
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint32(40, true)).toBe(wav.length - 44);
    expect((wav.length - 44) / 2 / 8000).toBeLessThan(1);
    // No está en silencio.
    let peak = 0;
    for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(view.getInt16(i, true)));
    expect(peak).toBeGreaterThan(5000);
  });
});

describe("mensajes de error", () => {
  it("explica permisos negados, dispositivo ausente u ocupado", () => {
    expect(mediaErrorMessage({ name: "NotAllowedError" }, "micrófono")).toMatch(/bloqueó el micrófono/);
    expect(mediaErrorMessage({ name: "NotFoundError" }, "cámara")).toMatch(/ninguna cámara/);
    expect(mediaErrorMessage({ name: "NotReadableError" }, "micrófono")).toMatch(/ocupado/);
    expect(mediaErrorMessage(new Error("x"), "cámara")).toBe("No se pudo abrir la cámara.");
  });
});
