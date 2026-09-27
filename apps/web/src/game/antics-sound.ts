// Sonidos del brindis y de las sillas giratorias: el único lugar por donde pasa cada momento (los efectos
// están en sfx.ts, con el volumen del HUD y el limitador de ráfagas).
import { sfx } from "./sfx";
import { volumeAt } from "./sound";

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

/** Hasta dónde se oye (px de mundo: unos 7 tiles, como los demás efectos). */
const REACH = 32 * 7;

export function playAnticSound(sound: AnticSound, info: AnticSoundInfo): void {
  const vol = volumeAt(info.dist, REACH);
  switch (sound) {
    case "toast-invite":
    case "toast-join":
      return sfx.raiseGlass(vol);
    case "toast-clink":
      return sfx.clink(vol, info.people ?? 2);
    case "toast-solo":
      // Un solo vaso: el tintineo, más bajito y sin compañía.
      return sfx.clink(vol * 0.6, 1);
    case "swivel-whoosh":
      return sfx.whoosh(vol, info.durationMs);
    case "swivel-dizzy":
      return sfx.dizzy(vol);
  }
}
