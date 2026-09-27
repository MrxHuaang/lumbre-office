// Fotos de la cabaña: se guardan con la imagen adentro (bytea, ~150 KB como mucho) y solo las últimas
// PHOTO.keep. Las reglas (tipo, peso, tope diario, quién borra) están en @hyvento/shared (photos.ts) y
// las aplica la API de la web (apps/web/src/lib/photo-service.ts).
import type { PhotoPerson } from "@hyvento/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

export interface NewPhoto {
  id: string;
  takenById: string;
  area: string;
  caption: string;
  people: PhotoPerson[];
  image: Uint8Array;
  mime: string;
}

/** Una foto sin la imagen (para la lista del tablón). */
export interface PhotoRow {
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

export type SavePhotoOutcome = "ok" | "limit" | "duplicate";

const ROW_SELECT = {
  id: true,
  takenById: true,
  area: true,
  caption: true,
  people: true,
  pinned: true,
  createdAt: true,
  mime: true,
  takenBy: { select: { name: true } },
} satisfies Prisma.PhotoSelect;

type Selected = Prisma.PhotoGetPayload<{ select: typeof ROW_SELECT }>;

const toRow = (p: Selected): PhotoRow => ({
  id: p.id,
  takenById: p.takenById,
  takenByName: p.takenBy.name,
  area: p.area,
  caption: p.caption,
  people: Array.isArray(p.people) ? (p.people as unknown as PhotoPerson[]) : [],
  pinned: p.pinned,
  createdAt: p.createdAt,
  mime: p.mime,
});

/**
 * Guarda una foto si no pasó el tope del día y borra las que sobran (las más viejas). Bloquea la fila de
 * quien la sube: dos subidas al mismo tiempo no pasan el tope.
 */
export function savePhoto(
  client: PrismaClient,
  photo: NewPhoto,
  rules: { dailyLimit: number; since: Date; keep: number },
): Promise<SavePhotoOutcome> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "User" WHERE id = ${photo.takenById} FOR UPDATE`;
    if (await tx.photo.findUnique({ where: { id: photo.id }, select: { id: true } })) return "duplicate";
    const today = await tx.photo.count({ where: { takenById: photo.takenById, createdAt: { gte: rules.since } } });
    if (today >= rules.dailyLimit) return "limit";
    await tx.photo.create({
      data: {
        id: photo.id,
        takenById: photo.takenById,
        area: photo.area,
        caption: photo.caption,
        people: photo.people as unknown as Prisma.InputJsonValue,
        image: Buffer.from(photo.image),
        mime: photo.mime,
      },
    });
    await tx.$executeRaw`DELETE FROM "Photo" WHERE id IN (SELECT id FROM "Photo" ORDER BY "createdAt" DESC, id DESC OFFSET ${rules.keep})`;
    return "ok";
  });
}

/** Las fotos más recientes, sin la imagen. */
export async function listPhotos(client: PrismaClient, limit: number): Promise<PhotoRow[]> {
  const rows = await client.photo.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit, select: ROW_SELECT });
  return rows.map(toRow);
}

export async function findPhoto(client: PrismaClient, id: string): Promise<PhotoRow | null> {
  const p = await client.photo.findUnique({ where: { id }, select: ROW_SELECT });
  return p ? toRow(p) : null;
}

export async function photoImage(client: PrismaClient, id: string): Promise<{ image: Uint8Array; mime: string } | null> {
  const p = await client.photo.findUnique({ where: { id }, select: { image: true, mime: true } });
  return p ? { image: new Uint8Array(p.image), mime: p.mime } : null;
}

export async function deletePhoto(client: PrismaClient, id: string): Promise<boolean> {
  const { count } = await client.photo.deleteMany({ where: { id } });
  return count > 0;
}

export async function setPhotoPinned(client: PrismaClient, id: string, pinned: boolean): Promise<boolean> {
  const { count } = await client.photo.updateMany({ where: { id }, data: { pinned } });
  return count > 0;
}
