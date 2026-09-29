// Los tonos del celular: melodías "polifónicas" cortas (una voz de melodía y otra de bajo), escritas
// como en los compositores de tonos de antes: nota+octava/duración ("E5/16", "C#4/8.", "R/4" = silencio).
// Son obras de dominio público o melodías hechas para la cabaña. Aquí solo están los datos y el
// traductor a notas (lógica pura); lo que suena está en `audio.ts`.

export interface Ringtone {
  id: string;
  name: string;
  bpm: number;
  melody: string;
  bass?: string;
  /** Timbre de la melodía. */
  wave: OscillatorType;
}

export interface Note {
  /** Hz (0 = silencio). */
  freq: number;
  /** Segundos desde el comienzo. */
  start: number;
  dur: number;
}

/** "clasico" = el bip de siempre del chat (no es un tono del celular). */
export const CLASSIC_TONE = "clasico";

export const RINGTONES: Ringtone[] = [
  {
    id: "elisa",
    name: "Para Elisa",
    bpm: 72,
    wave: "square",
    melody:
      "E5/16 D#5/16 E5/16 D#5/16 E5/16 B4/16 D5/16 C5/16 A4/8 R/16 C4/16 E4/16 A4/16 B4/8 R/16 E4/16 G#4/16 B4/16 C5/8 R/16 E4/16 E5/16 D#5/16 E5/16 D#5/16 E5/16 B4/16 D5/16 C5/16 A4/8",
    bass: "R/2 A2/16 E3/16 A3/16 R/16 R/16 R/16 E2/16 E3/16 G#3/16 R/16 R/16 R/16 A2/16 E3/16 A3/16",
  },
  {
    id: "alegria",
    name: "Himno de la alegría",
    bpm: 120,
    wave: "square",
    melody: "E5/4 E5/4 F5/4 G5/4 G5/4 F5/4 E5/4 D5/4 C5/4 C5/4 D5/4 E5/4 E5/4. D5/8 D5/2",
    bass: "C3/1 G2/1 C3/1 G2/2 G2/2",
  },
  {
    id: "cumbia",
    name: "Cumbia pixel",
    bpm: 100,
    wave: "square",
    melody: "A4/8 C5/8 E5/8 C5/8 D5/8 C5/8 B4/8 G4/8 A4/8 C5/8 E5/8 G5/8 E5/4 D5/8 C5/8",
    bass: "A2/8 R/8 E3/8 R/8 G2/8 R/8 D3/8 R/8 A2/8 R/8 E3/8 R/8 E2/8 R/8 E3/8 G#2/8",
  },
  {
    id: "pajarito",
    name: "Pajarito",
    bpm: 132,
    wave: "sine",
    melody: "E6/16 G6/16 E6/16 G6/16 R/8 C6/16 E6/16 G6/8 R/8 E6/16 G6/16 E6/16 C7/8",
  },
  {
    id: "timbre",
    name: "Timbre retro",
    bpm: 120,
    wave: "square",
    melody:
      "E6/32 C6/32 E6/32 C6/32 E6/32 C6/32 E6/32 C6/32 E6/32 C6/32 E6/32 C6/32 R/4 E6/32 C6/32 E6/32 C6/32 E6/32 C6/32 E6/32 C6/32 E6/32 C6/32 E6/32 C6/32",
  },
];

export const ringtoneById = (id: string) => RINGTONES.find((r) => r.id === id);

const SEMITONE: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

/** Frecuencia de una nota ("A4" = 440 Hz, "C#5", "Bb3"); null si no se entiende. */
export function noteFreq(name: string): number | null {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) return null;
  const n = SEMITONE[m[1]!]! + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (n / 12);
}

/**
 * Traduce una voz a notas con su tiempo. La duración es una fracción de redonda (4 = negra, 8 = corchea)
 * y el punto la alarga a la mitad. Lo que no se entiende se salta.
 */
export function parseVoice(voice: string, bpm: number): Note[] {
  const whole = (60 / bpm) * 4;
  const notes: Note[] = [];
  let t = 0;
  for (const token of voice.trim().split(/\s+/)) {
    const m = /^([A-G][#b]?\d|R)\/(\d+)(\.?)$/.exec(token);
    if (!m) continue;
    const dur = (whole / Number(m[2])) * (m[3] ? 1.5 : 1);
    const freq = m[1] === "R" ? 0 : (noteFreq(m[1]!) ?? 0);
    notes.push({ freq, start: t, dur });
    t += dur;
  }
  return notes;
}

/** Cuánto dura un tono (la voz más larga). */
export function toneLength(r: Ringtone): number {
  const end = (v?: string) => (v ? parseVoice(v, r.bpm).reduce((a, n) => Math.max(a, n.start + n.dur), 0) : 0);
  return Math.max(end(r.melody), end(r.bass));
}
