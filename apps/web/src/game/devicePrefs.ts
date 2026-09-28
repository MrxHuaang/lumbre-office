/**
 * Lo puro de la prueba de dispositivos (sin navegador ni LiveKit, para poder probarlo): las
 * preferencias guardadas, el nivel del micrófono y el sonido de "Probar parlantes".
 */

export type DeviceKind = "audioinput" | "videoinput" | "audiooutput";

export interface DevicePrefs {
  /** deviceId elegido; "" = el predeterminado del sistema. */
  audioinput: string;
  videoinput: string;
  audiooutput: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

/** Las tres ayudas de audio vienen prendidas: son las que evitan el eco y el ruido de fondo. */
export const DEFAULT_PREFS: DevicePrefs = {
  audioinput: "",
  videoinput: "",
  audiooutput: "",
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
};

export const PREFS_KEY = "hyvento:dispositivos";

/** Lee lo guardado sin confiar en su forma (otra versión, a mano o corrupto): lo que no sirve vuelve al valor por defecto. */
export function parsePrefs(raw: string | null | undefined): DevicePrefs {
  if (!raw) return { ...DEFAULT_PREFS };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PREFS };
  }
  if (!data || typeof data !== "object") return { ...DEFAULT_PREFS };
  const d = data as Record<string, unknown>;
  const str = (k: DeviceKind) => (typeof d[k] === "string" && (d[k] as string).length <= 512 ? (d[k] as string) : "");
  const bool = (k: "noiseSuppression" | "echoCancellation" | "autoGainControl") =>
    typeof d[k] === "boolean" ? (d[k] as boolean) : DEFAULT_PREFS[k];
  return {
    audioinput: str("audioinput"),
    videoinput: str("videoinput"),
    audiooutput: str("audiooutput"),
    noiseSuppression: bool("noiseSuppression"),
    echoCancellation: bool("echoCancellation"),
    autoGainControl: bool("autoGainControl"),
  };
}

/** Opciones de captura del micrófono (sirven para getUserMedia y para LiveKit). */
export function audioCapture(prefs: DevicePrefs) {
  return {
    ...(prefs.audioinput ? { deviceId: prefs.audioinput } : {}),
    noiseSuppression: prefs.noiseSuppression,
    // Aislamiento de voz (Chrome nuevo; LiveKit lo prende por defecto): va junto a la supresión de ruido.
    voiceIsolation: prefs.noiseSuppression,
    echoCancellation: prefs.echoCancellation,
    autoGainControl: prefs.autoGainControl,
  };
}

/**
 * Nivel 0–1 a partir de las muestras del AnalyserNode (getByteTimeDomainData: 128 = silencio).
 * RMS con una curva que levanta la voz normal (~0.05–0.1 de RMS) a la mitad del medidor.
 */
export function levelFromSamples(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = (samples[i]! - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / samples.length);
  return Math.min(1, Math.sqrt(rms) * 1.6);
}

/**
 * "Tilín" corto (dos notas, ~0.5 s) como WAV PCM de 16 bits. Se arma a mano para poder mandarlo a un
 * <audio> con setSinkId: así suena por la salida elegida y no por la del sistema.
 */
export function chimeWav(sampleRate = 22050): Uint8Array<ArrayBuffer> {
  const notes = [
    { freq: 659.25, start: 0, dur: 0.22 }, // mi
    { freq: 987.77, start: 0.16, dur: 0.34 }, // si
  ];
  const total = Math.ceil(sampleRate * 0.52);
  const pcm = new Int16Array(total);
  for (const n of notes) {
    const from = Math.floor(n.start * sampleRate);
    const len = Math.floor(n.dur * sampleRate);
    for (let i = 0; i < len && from + i < total; i++) {
      const t = i / sampleRate;
      const env = Math.min(1, i / (0.01 * sampleRate)) * Math.exp((-4 * t) / n.dur); // ataque corto y caída
      const v = Math.sin(2 * Math.PI * n.freq * t) * env * 0.35;
      pcm[from + i] = Math.max(-32768, Math.min(32767, pcm[from + i]! + v * 32767));
    }
  }
  const bytes = new Uint8Array(44 + pcm.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // tamaño del bloque fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes por segundo
  view.setUint16(32, 2, true); // bytes por muestra
  view.setUint16(34, 16, true); // bits
  text(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i]!, true);
  return bytes;
}

/** Mensaje claro según por qué falló getUserMedia. */
export function mediaErrorMessage(err: unknown, what: "micrófono" | "cámara"): string {
  const name = err instanceof Error || (err && typeof err === "object" && "name" in err) ? String((err as { name: string }).name) : "";
  const el = what === "micrófono" ? "el micrófono" : "la cámara";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return `El navegador bloqueó ${el}. Toca el candado junto a la dirección, permite ${el} y vuelve a probar.`;
    case "NotFoundError":
    case "OverconstrainedError":
      return `No se encontró ${what === "micrófono" ? "ningún micrófono" : "ninguna cámara"}. Revisa que esté conectad${what === "micrófono" ? "o" : "a"}.`;
    case "NotReadableError":
    case "AbortError":
      return `${what === "micrófono" ? "El micrófono está ocupado" : "La cámara está ocupada"} por otra aplicación (Zoom, Meet…). Ciérrala y vuelve a probar.`;
    default:
      return `No se pudo abrir ${el}.`;
  }
}
