import { bumpStat, prisma } from "@hyvento/db";
import { listPhotosFor, PHOTO, STAT_KEYS, uploadPhoto } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { publishPhotosChanged, publishPointsChanged } from "@/lib/events";
import { photoFail, photoStore } from "@/lib/photos";

/** Las fotos del tablón de la cafetería (sin las imágenes: esas van por /api/photos/[id]/image). */
export async function GET() {
  const user = await getCurrentUser();
  const res = await listPhotosFor(photoStore, user);
  if (!res.ok) return photoFail(res.error);
  return NextResponse.json({ photos: res.value }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Subir una foto (multipart): `image` (PNG o WebP), `ticket` (lo firmó el servidor de juego al disparar)
 * y `caption` opcional. Las reglas están en @hyvento/shared (photo-service.ts).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return photoFail("auth");
  // Antes de leer el cuerpo: lo que declara pesar de más ni se lee (el tope real se mide abajo).
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > PHOTO.maxBytes + 16 * 1024) return photoFail("size");
  const secret = process.env.GAME_TOKEN_SECRET;
  if (!secret) return NextResponse.json({ error: "Falta GAME_TOKEN_SECRET en el servidor" }, { status: 500 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (file instanceof Blob && file.size > PHOTO.maxBytes) return photoFail("size");
  const image = file instanceof Blob ? new Uint8Array(await file.arrayBuffer()) : null;
  const res = await uploadPhoto({ store: photoStore, secret }, user, { ticket: form?.get("ticket"), caption: form?.get("caption") ?? "", image });
  if (!res.ok) return photoFail(res.error);

  // Cuenta para los logros (Paparazzi) solo lo que quedó guardado de verdad; el aviso de puntos hace que el
  // servidor de juego relea las estadísticas y revise si se desbloqueó algo.
  await bumpStat(prisma, user.id, STAT_KEYS.photosTaken).catch((err) => console.error("bumpStat photos", err));
  await Promise.all([publishPhotosChanged(), publishPointsChanged(user.id)]);
  return NextResponse.json({ photo: res.value }, { status: 201 });
}
