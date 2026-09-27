// Ganchos de sonido del brindis y de las sillas giratorias. Todavía no suenan: este es el único lugar
// por donde pasa cada momento, así que acá se conectan los efectos generados (llegan en otra rama).

export type AnticSound =
  /** Alguien levanta el vaso e invita a brindar. */
  | "toast-invite"
  /** Otro se suma al brindis. */
  | "toast-join"
  /** Chocan los vasos (con `people` = cuántos brindan). */
  | "toast-clink"
  /** Nadie respondió: brinda solo. */
  | "toast-solo"
  /** Arranca el giro en la silla (`turns` vueltas en `durationMs`). */
  | "swivel-whoosh"
  /** Giró tanto que quedó mareado. */
  | "swivel-dizzy";

export interface AnticSoundInfo {
  /** Distancia (px de mundo) desde el jugador local, para bajar el volumen de lo que pasa lejos. */
  dist: number;
  people?: number;
  turns?: number;
  durationMs?: number;
}

export function playAnticSound(sound: AnticSound, info: AnticSoundInfo): void {
  // Sin audio por ahora (ver sound.ts para cómo se generan los demás sonidos).
  void sound;
  void info;
}
