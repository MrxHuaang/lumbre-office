// Dormir en una cama hace amanecer (VIR-144; reglas en dormir.ts de @hyvento/shared). E en una cama, de
// noche del juego, acuesta a la persona (`Player.sleeping` = la cama, "nivel|tipo@x,y"); moverse, cambiar de
// nivel o que amanezca la despiertan. Cada cambio se cuenta ("Durmiendo 2/4") y, si duermen los que tienen
// que dormir y nadie está en una llamada ni en una reunión, el reloj pasa a las 06:00 por el camino de
// `/time set` (lo hace la sala con `amanecer`).
import type { MapSchema } from "@colyseus/schema";
import { cuentaDormidos, DORMIR_MSG, horaDeDormir, saltaLaNoche, type DormirAvisoCode, type DormirEstado } from "@hyvento/shared";
import type { Player } from "../state";

export interface DormirDeps {
  players(): MapSchema<Player>;
  /** El minuto del día del reloj del juego. */
  minuto(): number;
  /** Lleva el reloj a las 06:00 (con todo lo que depende de la hora). */
  amanecer(): void;
  broadcast(type: string, msg: unknown): void;
  aviso(sessionId: string, code: DormirAvisoCode): void;
}

/** La cama donde duerme alguien: el nivel, el tipo y su tile (dos casas tienen camas en el mismo tile). */
export const camaDe = (area: string, type: string, x: number, y: number) => `${area}|${type}@${x},${y}`;

/** Cuántos caben en cada cama. */
const cupo = (type: string) => (type === "cama-doble" ? 2 : 1);

export class Dormir {
  /** Lo último que se contó ("2/4"): solo se avisa cuando cambia. */
  private ultimo = "";

  constructor(private readonly d: DormirDeps) {}

  /** E en una cama (ya validado que está al alcance). */
  acostarse(sessionId: string, player: Player, cama: { type: string; x: number; y: number }) {
    if (!horaDeDormir(this.d.minuto())) return this.d.aviso(sessionId, "dia");
    const key = camaDe(player.area, cama.type, cama.x, cama.y);
    if (player.sleeping === key) return;
    let adentro = 0;
    for (const [id, p] of this.d.players()) if (id !== sessionId && p.sleeping === key) adentro++;
    if (adentro >= cupo(cama.type)) return this.d.aviso(sessionId, "ocupado");
    player.sleeping = key;
    player.moving = false;
    this.revisar();
  }

  /** Se movió: se despierta. */
  despertar(player: Player) {
    if (!player.sleeping) return;
    player.sleeping = "";
    this.revisar();
  }

  /**
   * Cuenta, avisa si cambió y, si toca, amanece. Se llama al acostarse o despertarse, al entrar o salir
   * alguien y cada tanto (una llamada que se cuelga, una reunión que termina).
   */
  revisar() {
    const players = [...this.d.players().values()];
    const gente = players.map((p) => ({ dormido: Boolean(p.sleeping), enLlamada: Boolean(p.callId), enReunion: p.status === "meeting" }));
    const { dormidos, total } = cuentaDormidos(gente);
    const k = `${dormidos}/${total}`;
    if (k !== this.ultimo) {
      this.ultimo = k;
      this.d.broadcast(DORMIR_MSG.estado, { dormidos, total } satisfies DormirEstado);
    }
    if (!saltaLaNoche(gente)) return;
    this.d.amanecer();
    for (const p of players) p.sleeping = "";
    this.d.broadcast(DORMIR_MSG.amanecio, {});
    this.ultimo = "";
    this.revisar();
  }

  /** Cada tanto: quien cambió de nivel (viaje, bus) o se quedó dormido cuando ya amaneció, se despierta. */
  tick() {
    const dia = !horaDeDormir(this.d.minuto());
    for (const p of this.d.players().values()) if (p.sleeping && (dia || !p.sleeping.startsWith(`${p.area}|`))) p.sleeping = "";
    this.revisar();
  }
}
