// Lo que hace la API de la Pintura (apps/web/src/app/api/paintings), sin Next ni Prisma: así se prueba
// con un almacén en memoria. Las rutas solo leen la petición, llaman acá y responden.
import { cleanPaintingTitle, isBlankPainting, PAINTING, PaintingBody, type PaintingDTO } from "./painting";

export interface PaintingRecord {
  id: string;
  userId: string;
  authorName: string;
  title: string;
  pixels: string;
  createdAt: Date;
}

/** Dónde se guardan (Prisma en la web; en memoria en los tests). */
export interface PaintingStore {
  /**
   * Guarda el cuadro y lo deja en la mochila (`cuadro:<id>`), todo junto, si la persona no pasó el tope
   * de cuadros guardados.
   */
  create(input: { userId: string; title: string; pixels: string }, rules: { max: number }): Promise<PaintingRecord | "limit">;
  /** Los cuadros de alguien (más nuevos primero) y si cada uno está en la mochila. */
  listByUser(userId: string): Promise<(PaintingRecord & { inBackpack: boolean })[]>;
  find(id: string): Promise<PaintingRecord | null>;
  /**
   * Borra un cuadro propio que está en la mochila (lo saca de ahí y borra la fila). "hung" = está
   * colgado en la oficina (primero hay que guardarlo).
   */
  removeFromBackpack(userId: string, id: string): Promise<"ok" | "not-found" | "hung">;
}

export type PaintingError = "auth" | "invalid" | "blank" | "limit" | "not-found" | "hung";

export type PaintingResult<T> = { ok: true; value: T } | { ok: false; error: PaintingError };

const fail = <T>(error: PaintingError): PaintingResult<T> => ({ ok: false, error });

export const PAINTING_ERROR_TEXT: Record<PaintingError, string> = {
  auth: "Tienes que entrar para pintar.",
  invalid: "El cuadro no es válido.",
  blank: "El lienzo está en blanco: pinta algo antes de guardarlo.",
  limit: `Ya tienes ${PAINTING.maxPerUser} cuadros: borra uno de la mochila para guardar otro.`,
  "not-found": "Ese cuadro no existe.",
  hung: "Ese cuadro está colgado: guárdalo en la mochila desde el editor de tu oficina antes de borrarlo.",
};

export const PAINTING_ERROR_STATUS: Record<PaintingError, number> = {
  auth: 401,
  invalid: 400,
  blank: 400,
  limit: 409,
  "not-found": 404,
  hung: 409,
};

const toDTO = (r: PaintingRecord, inBackpack?: boolean): PaintingDTO => ({
  id: r.id,
  title: r.title,
  pixels: r.pixels,
  authorName: r.authorName,
  createdAt: r.createdAt.toISOString(),
  ...(inBackpack === undefined ? {} : { inBackpack }),
});

/** Guarda un cuadro nuevo en la mochila de quien lo pintó. */
export async function createPainting(store: PaintingStore, user: { id: string } | null, raw: unknown): Promise<PaintingResult<PaintingDTO>> {
  if (!user) return fail("auth");
  const body = PaintingBody.safeParse(raw);
  if (!body.success) return fail("invalid");
  if (isBlankPainting(body.data.pixels)) return fail("blank");
  const saved = await store.create({ userId: user.id, title: cleanPaintingTitle(body.data.title), pixels: body.data.pixels }, { max: PAINTING.maxPerUser });
  if (saved === "limit") return fail("limit");
  return { ok: true, value: toDTO(saved, true) };
}

/** Los cuadros propios, para la galería de la app. */
export async function listMyPaintings(store: PaintingStore, user: { id: string } | null): Promise<PaintingResult<PaintingDTO[]>> {
  if (!user) return fail("auth");
  const rows = await store.listByUser(user.id);
  return { ok: true, value: rows.map((r) => toDTO(r, r.inBackpack)) };
}

/** Un cuadro para dibujarlo colgado: lo puede ver cualquiera que haya entrado (está en una oficina). */
export async function getPainting(store: PaintingStore, user: { id: string } | null, id: string): Promise<PaintingResult<PaintingDTO>> {
  if (!user) return fail("auth");
  const row = await store.find(id);
  return row ? { ok: true, value: toDTO(row) } : fail("not-found");
}

/** Borra un cuadro propio de la mochila (los colgados no, y los ajenos tampoco). */
export async function deletePainting(store: PaintingStore, user: { id: string } | null, id: string): Promise<PaintingResult<null>> {
  if (!user) return fail("auth");
  const res = await store.removeFromBackpack(user.id, id);
  return res === "ok" ? { ok: true, value: null } : fail(res);
}
