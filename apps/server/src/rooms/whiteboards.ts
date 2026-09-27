// Pizarras compartidas (ver whiteboard.ts en @hyvento/shared): se dibuja estando dentro de la sala de la
// pizarra (una oficina o la sala de reuniones). Cada trazo se reparte a quienes la tienen abierta y la
// pizarra se guarda en la base un rato después del último cambio.
import {
  addStroke,
  BOARD,
  BOARD_ZONE_TYPES,
  BoardActionMessage,
  BoardOpenMessage,
  BoardStrokeMessage,
  parseStoredStrokes,
  type BoardRemoveEvent,
  type BoardStateEvent,
  type BoardStroke,
  type BoardStrokeEvent,
} from "@hyvento/shared";

/** Quien usa la pizarra: su sesión, en qué zona está parado y si es dueño de esa oficina. */
export interface BoardWho {
  sessionId: string;
  userId: string;
  /** Zona donde tiene los pies ("" = ninguna) y su tipo. */
  zoneId: string;
  zoneType: string;
  /** Dueño de la oficina donde está (puede borrar la pizarra entera). */
  owner: boolean;
}

export interface BoardHooks {
  send: (sessionId: string, type: string, msg: unknown) => void;
  load: (board: string) => Promise<unknown>;
  save: (board: string, strokes: BoardStroke[]) => Promise<void>;
  later: (ms: number, fn: () => void) => { clear(): void };
  /** Tiempo sin cambios antes de guardar (los tests lo acortan). */
  saveDelayMs: () => number;
}

export class Whiteboards {
  private boards = new Map<string, BoardStroke[]>();
  private loading = new Map<string, Promise<BoardStroke[]>>();
  /** Quién tiene abierta cada pizarra. */
  private viewers = new Map<string, Set<string>>();
  private nextStrokeAt = new Map<string, number>();
  private saves = new Map<string, { clear(): void }>();
  private seq = 0;

  constructor(
    private readonly hooks: BoardHooks,
    /** Tipos de mensaje (los de MSG), para no importar el protocolo entero aquí. */
    private readonly types: { state: string; stroke: string; remove: string },
  ) {}

  /** Solo se usa la pizarra de la sala donde uno está (oficina o sala de reuniones). */
  private allowed(who: BoardWho, board: string) {
    return who.zoneId === board && BOARD_ZONE_TYPES.includes(who.zoneType);
  }

  private async get(board: string): Promise<BoardStroke[]> {
    const have = this.boards.get(board);
    if (have) return have;
    let p = this.loading.get(board);
    if (!p) {
      p = this.hooks
        .load(board)
        .catch((err) => {
          console.error("loadBoard", err);
          return null;
        })
        .then((raw) => {
          const list = this.boards.get(board) ?? parseStoredStrokes(raw);
          this.boards.set(board, list);
          this.loading.delete(board);
          return list;
        });
      this.loading.set(board, p);
    }
    return p;
  }

  async open(who: BoardWho, raw: unknown) {
    const parsed = BoardOpenMessage.safeParse(raw);
    if (!parsed.success || !this.allowed(who, parsed.data.board)) return;
    const board = parsed.data.board;
    const strokes = await this.get(board);
    let set = this.viewers.get(board);
    if (!set) this.viewers.set(board, (set = new Set()));
    set.add(who.sessionId);
    const state: BoardStateEvent = { board, strokes, canClear: who.zoneType === "meeting" || who.owner };
    this.hooks.send(who.sessionId, this.types.state, state);
  }

  close(sessionId: string, raw: unknown) {
    const parsed = BoardOpenMessage.safeParse(raw);
    if (parsed.success) this.viewers.get(parsed.data.board)?.delete(sessionId);
  }

  async stroke(who: BoardWho, raw: unknown, now: number) {
    const parsed = BoardStrokeMessage.safeParse(raw);
    if (!parsed.success || !this.allowed(who, parsed.data.board)) return;
    if (now < (this.nextStrokeAt.get(who.userId) ?? 0)) return;
    this.nextStrokeAt.set(who.userId, now + BOARD.strokeCooldownMs);
    const board = parsed.data.board;
    const list = await this.get(board);
    const stroke: BoardStroke = { ...parsed.data.stroke, id: `t${now.toString(36)}${(this.seq++).toString(36)}`, by: who.userId };
    const dropped = addStroke(list, stroke);
    this.broadcast(board, this.types.stroke, { board, stroke } satisfies BoardStrokeEvent);
    if (dropped.length) this.broadcast(board, this.types.remove, { board, ids: dropped } satisfies BoardRemoveEvent);
    this.scheduleSave(board);
  }

  /** Deshacer mi último trazo de esa pizarra. */
  async undo(who: BoardWho, raw: unknown) {
    const parsed = BoardActionMessage.safeParse(raw);
    if (!parsed.success || !this.allowed(who, parsed.data.board)) return;
    const board = parsed.data.board;
    const list = await this.get(board);
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i]!.by !== who.userId) continue;
      const [gone] = list.splice(i, 1);
      this.broadcast(board, this.types.remove, { board, ids: [gone!.id] } satisfies BoardRemoveEvent);
      this.scheduleSave(board);
      return;
    }
  }

  /** Borrar la pizarra entera: el dueño de la oficina, o cualquiera en la sala de reuniones. */
  async clear(who: BoardWho, raw: unknown) {
    const parsed = BoardActionMessage.safeParse(raw);
    if (!parsed.success || !this.allowed(who, parsed.data.board)) return;
    if (who.zoneType !== "meeting" && !who.owner) return;
    const board = parsed.data.board;
    const list = await this.get(board);
    list.length = 0;
    this.broadcast(board, this.types.remove, { board, ids: "all" } satisfies BoardRemoveEvent);
    this.scheduleSave(board);
  }

  /** Se fue de la sala (o de la cabaña): deja de recibir los trazos. */
  forget(sessionId: string) {
    for (const set of this.viewers.values()) set.delete(sessionId);
  }

  /** Si cambió de zona, cierra la pizarra que tenía abierta de otra sala. */
  moved(sessionId: string, zoneId: string) {
    for (const [board, set] of this.viewers) if (board !== zoneId) set.delete(sessionId);
  }

  /** Guarda ya lo que falte (al cerrar la sala). */
  async flush() {
    const pending = [...this.saves.keys()];
    for (const t of this.saves.values()) t.clear();
    this.saves.clear();
    await Promise.all(pending.map((b) => this.save(b)));
  }

  private broadcast(board: string, type: string, msg: unknown) {
    for (const id of this.viewers.get(board) ?? []) this.hooks.send(id, type, msg);
  }

  private scheduleSave(board: string) {
    this.saves.get(board)?.clear();
    this.saves.set(
      board,
      this.hooks.later(this.hooks.saveDelayMs(), () => {
        this.saves.delete(board);
        void this.save(board);
      }),
    );
  }

  private async save(board: string) {
    const list = this.boards.get(board);
    if (!list) return;
    await this.hooks.save(board, list).catch((err) => console.error("saveBoard", err));
  }
}
