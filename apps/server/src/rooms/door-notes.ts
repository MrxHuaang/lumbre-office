// Notas en la puerta: frente a la oficina de alguien se le deja una nota para cuando vuelva. El servidor
// valida que estés frente a esa puerta (mismo nivel, cerca), que la oficina tenga dueño y no sea tuya, y
// el tope del día (lo cuenta el repositorio en la misma transacción que la guarda). El texto no pasa por
// el estado: en la puerta solo se ve cuántas hay sin leer (`OfficeInfo.notes`).
import { cleanDoorNote, DOOR_NOTES, DoorNoteMessage, type DoorNoteError, type DoorNoteResult } from "@hyvento/shared";
import type { DoorNotesRepository } from "../repo/types";

/** Quien deja la nota, como lo ve la sala. */
export interface DoorNoteAuthor {
  userId: string;
  area: string;
  x: number;
  y: number;
}

/** La oficina de la puerta: su dueño, en qué nivel está y el punto frente a la puerta (px de mundo). */
export interface DoorNoteOffice {
  ownerId: string;
  ownerName: string;
  area: string;
  door: { x: number; y: number };
}

export interface DoorNotesDeps {
  repo: () => DoorNotesRepository;
  author: (sessionId: string) => DoorNoteAuthor | null;
  office: (zoneId: string) => DoorNoteOffice | null;
  reply: (sessionId: string, result: DoorNoteResult) => void;
  /** Se guardó una nota: el dueño tiene `unread` sin leer (los post-its de su puerta). */
  setUnread: (ownerId: string, unread: number) => void;
}

export class DoorNotes {
  /** Quienes tienen una nota guardándose: la siguiente espera (así el tope no se salta con un doble clic). */
  private saving = new Set<string>();

  constructor(private readonly deps: DoorNotesDeps) {}

  async leave(sessionId: string, raw: unknown) {
    const parsed = DoorNoteMessage.safeParse(raw);
    const me = this.deps.author(sessionId);
    if (!parsed.success || !me) return;
    const { zoneId } = parsed.data;
    const fail = (error: DoorNoteError) => this.deps.reply(sessionId, { ok: false, zoneId, error });
    const office = this.deps.office(zoneId);
    if (!office) return;
    if (!office.ownerId) return fail("no-owner");
    if (office.ownerId === me.userId) return fail("own");
    const text = cleanDoorNote(parsed.data.text);
    if (!text) return fail("empty");
    if (me.area !== office.area || Math.hypot(me.x - office.door.x, me.y - office.door.y) > DOOR_NOTES.reachPx) return fail("far");
    if (this.saving.has(me.userId)) return fail("busy");
    this.saving.add(me.userId);
    try {
      const saved = await this.deps.repo().saveDoorNote({ fromId: me.userId, toId: office.ownerId, zoneId, text });
      if (!saved.ok) return fail("limit");
      this.deps.setUnread(office.ownerId, saved.unread);
      this.deps.reply(sessionId, { ok: true, zoneId, ownerName: office.ownerName, left: saved.left });
    } catch (err) {
      console.error("saveDoorNote", err);
      fail("failed");
    } finally {
      this.saving.delete(me.userId);
    }
  }
}
