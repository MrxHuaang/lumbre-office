// La casa del árbol (CASA_ARBOL en @hyvento/shared): cupo de tres, la escalera que se recoge desde adentro
// (nadie más sube hasta que la bajen o se vacíe la casa, y entonces se baja sola) y el modo foco. El
// portal lo valida OfficeRoom.handleTravel con `canEnter`; `sweep` corre al cambiar de nivel, al irse
// alguien y cada medio segundo (para lo que mueve a la gente por otro lado, como el desmayo).
import type { MapSchema } from "@colyseus/schema";
import { CASA_ARBOL, CasaArbolFocusMessage, CasaArbolLadderMessage, casaArbolBlock, nextFocusPhase, type CasaArbolBlock, type CasaArbolFocus } from "@hyvento/shared";
import type { Player, TreeHouseState } from "../state";

export class CasaArbol {
  constructor(
    private readonly state: TreeHouseState,
    private readonly players: MapSchema<Player>,
  ) {}

  /** Cuántas personas hay arriba (sin contar a `exceptUserId`, que es quien quiere subir). */
  inside(exceptUserId?: string): number {
    let n = 0;
    for (const p of this.players.values()) if (p.area === CASA_ARBOL.area && p.userId !== exceptUserId) n++;
    return n;
  }

  /** Por qué no puede subir esta persona (null = puede). */
  canEnter(userId: string): CasaArbolBlock | null {
    return casaArbolBlock(this.inside(userId), this.state.locked);
  }

  /** Recoger o bajar la escalera: solo desde adentro. */
  ladder(player: Player, raw: unknown): boolean {
    const parsed = CasaArbolLadderMessage.safeParse(raw);
    if (!parsed.success || player.area !== CASA_ARBOL.area || this.state.locked === parsed.data.up) return false;
    this.state.locked = parsed.data.up;
    this.state.lockedBy = parsed.data.up ? player.name : "";
    return true;
  }

  /** El modo foco: empezar un bloque, pasar al descanso o apagarlo (cualquiera de adentro). */
  focus(player: Player, raw: unknown, now: number): boolean {
    const parsed = CasaArbolFocusMessage.safeParse(raw);
    if (!parsed.success || player.area !== CASA_ARBOL.area) return false;
    const { action } = parsed.data;
    if (action === "stop") this.setFocus("", 0);
    else if (action === "start") this.setFocus("focus", now + CASA_ARBOL.focusMs);
    else this.setFocus("break", now + CASA_ARBOL.breakMs);
    return true;
  }

  /** Vacía: la escalera se baja sola y el modo foco se apaga. Si no, el foco pasa de fase al terminar. */
  sweep(now: number) {
    if (this.inside() === 0) {
      if (this.state.locked) {
        this.state.locked = false;
        this.state.lockedBy = "";
      }
      if (this.state.focus) this.setFocus("", 0);
      return;
    }
    const phase = this.state.focus as CasaArbolFocus;
    if (phase && now >= this.state.focusEndsAt) {
      const next = nextFocusPhase(phase);
      this.setFocus(next.phase, next.phase ? now + next.ms : 0);
    }
  }

  private setFocus(phase: CasaArbolFocus, endsAt: number) {
    this.state.focus = phase;
    this.state.focusEndsAt = endsAt;
  }
}
