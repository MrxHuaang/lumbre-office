// Lo que hace la API de fotos (apps/web/src/app/api/photos), sin Next ni Prisma: así se prueba con un
// almacén en memoria. Las rutas solo leen la petición, llaman acá y responden.
import {
  PHOTO,
  canManagePhoto,
  checkPhotoFile,
  cleanCaption,
  photoDayStart,
  verifyPhotoTicket,
  type PhotoDTO,
  type PhotoError,
  type PhotoMime,
  type PhotoPerson,
} from "./photos";

/** Una foto guardada, sin la imagen. */
export interface PhotoRecord {
  id: string;
  takenById: string;
  takenByName: string;
  area: string;
  caption: string;
  people: PhotoPerson[];
  pinned: boolean;
  createdAt: Date;
  mime: string;
}

export interface NewPhotoRecord {
  id: string;
  takenById: string;
  area: string;
  caption: string;
  people: PhotoPerson[];
  image: Uint8Array;
  mime: PhotoMime;
}

/** Dónde se guardan (Prisma en la web; en memoria en los tests). */
export interface PhotoStore {
  /**
   * Guarda si no pasó el tope del día (contando desde `since`) y deja solo las últimas `keep` sin fijar
   * y las últimas `keepPinned` fijadas.
   */
  save(photo: NewPhotoRecord, rules: { dailyLimit: number; since: Date; keep: number; keepPinned: number }): Promise<"ok" | "limit" | "duplicate">;
  list(limit: number): Promise<PhotoRecord[]>;
  find(id: string): Promise<PhotoRecord | null>;
  image(id: string): Promise<{ image: Uint8Array; mime: string } | null>;
  remove(id: string): Promise<boolean>;
  setPinned(id: string, pinned: boolean): Promise<boolean>;
}

export interface PhotoUser {
  id: string;
  role: string;
}

export type PhotoResult<T> = { ok: true; value: T } | { ok: false; error: PhotoError };

const fail = <T>(error: PhotoError): PhotoResult<T> => ({ ok: false, error });

export function toPhotoDTO(p: PhotoRecord, user: PhotoUser): PhotoDTO {
  return {
    id: p.id,
    takenBy: { id: p.takenById, name: p.takenByName },
    area: p.area,
    caption: p.caption,
    people: p.people,
    pinned: p.pinned,
    createdAt: p.createdAt.toISOString(),
    mime: p.mime,
    mine: p.takenById === user.id,
    canManage: canManagePhoto(p, user),
  };
}

export interface UploadInput {
  ticket: unknown;
  caption: unknown;
  image: Uint8Array | null;
}

/**
 * Subir una foto: el archivo (tipo real y peso), el ticket del servidor de juego (vigente y de quien la
 * sube) y el tope del día. Quiénes salen y en qué nivel se sacan del ticket, nunca del cliente.
 */
export async function uploadPhoto(
  deps: { store: PhotoStore; secret: string; now?: number },
  user: PhotoUser | null,
  input: UploadInput,
): Promise<PhotoResult<PhotoDTO>> {
  if (!user) return fail("auth");
  const caption = cleanCaption(input.caption);
  if (caption === null) return fail("caption");
  if (!input.image) return fail("type");
  const file = checkPhotoFile(input.image);
  if (!file.ok) return fail(file.error);
  if (typeof input.ticket !== "string" || !input.ticket) return fail("ticket");
  let claims;
  try {
    claims = await verifyPhotoTicket(input.ticket, deps.secret);
  } catch {
    return fail("ticket");
  }
  if (claims.sub !== user.id) return fail("not-yours");

  const now = deps.now ?? Date.now();
  const saved = await deps.store.save(
    { id: claims.jti, takenById: user.id, area: claims.area, caption, people: claims.people, image: input.image, mime: file.mime },
    { dailyLimit: PHOTO.dailyLimit, since: photoDayStart(now), keep: PHOTO.keep, keepPinned: PHOTO.keepPinned },
  );
  if (saved !== "ok") return fail(saved);
  const record = await deps.store.find(claims.jti);
  if (!record) return fail("not-found"); // se borró justo (no debería pasar)
  return { ok: true, value: toPhotoDTO(record, user) };
}

/** Las fotos del tablón (las más recientes primero). */
export async function listPhotosFor(store: PhotoStore, user: PhotoUser | null): Promise<PhotoResult<PhotoDTO[]>> {
  if (!user) return fail("auth");
  const rows = await store.list(PHOTO.keep);
  return { ok: true, value: rows.map((p) => toPhotoDTO(p, user)) };
}

/** La imagen de una foto (cualquiera con sesión puede verla: está colgada en la cafetería). */
export async function photoImageFor(store: PhotoStore, user: PhotoUser | null, id: string): Promise<PhotoResult<{ image: Uint8Array; mime: string }>> {
  if (!user) return fail("auth");
  const img = await store.image(id);
  return img ? { ok: true, value: img } : fail("not-found");
}

/** Borrar: quien la sacó o un admin. */
export async function deletePhotoAs(store: PhotoStore, user: PhotoUser | null, id: string): Promise<PhotoResult<null>> {
  if (!user) return fail("auth");
  const photo = await store.find(id);
  if (!photo) return fail("not-found");
  if (!canManagePhoto(photo, user)) return fail("forbidden");
  return (await store.remove(id)) ? { ok: true, value: null } : fail("not-found");
}

/** Pinchar o sacar del corcho (sigue en la galería): quien la sacó o un admin. */
export async function pinPhotoAs(store: PhotoStore, user: PhotoUser | null, id: string, pinned: boolean): Promise<PhotoResult<PhotoDTO>> {
  if (!user) return fail("auth");
  const photo = await store.find(id);
  if (!photo) return fail("not-found");
  if (!canManagePhoto(photo, user)) return fail("forbidden");
  if (!(await store.setPinned(id, pinned))) return fail("not-found");
  return { ok: true, value: toPhotoDTO({ ...photo, pinned }, user) };
}
