// Limitador de los efectos de sonido del navegador (apps/web/src/game/sfx.ts): que un mismo sonido no se
// repita en ráfaga (diez pasos de diez personas en el mismo instante) y que no suenen demasiados a la vez.
// Es lógica pura (sin WebAudio) para poder probarla.

export class SoundGate {
  private last = new Map<string, number>();
  /** Cuándo termina cada voz que está sonando (ms). */
  private voices: number[] = [];

  constructor(private readonly maxVoices = 10) {}

  /**
   * ¿Puede sonar `key` ahora? Sí si pasaron `gapMs` desde la última vez que sonó y hay lugar para una voz
   * más. Si puede, la cuenta como sonando durante `durMs`.
   */
  allow(key: string, now: number, gapMs: number, durMs: number): boolean {
    const prev = this.last.get(key);
    if (prev !== undefined && now - prev < gapMs) return false;
    this.voices = this.voices.filter((end) => end > now);
    if (this.voices.length >= this.maxVoices) return false;
    this.last.set(key, now);
    this.voices.push(now + durMs);
    return true;
  }

  /** Voces sonando en `now`. */
  active(now: number): number {
    return this.voices.filter((end) => end > now).length;
  }
}
