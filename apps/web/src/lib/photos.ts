import "server-only";
// Fotos: el almacén de Prisma para el servicio de @hyvento/shared (photo-service.ts) y la respuesta de
// error común de las rutas de /api/photos.
import { deletePhoto, findPhoto, listPhotos, photoImage, prisma, savePhoto, setPhotoPinned } from "@hyvento/db";
import { PHOTO_ERROR_STATUS, PHOTO_ERROR_TEXT, type PhotoError, type PhotoStore } from "@hyvento/shared";
import { NextResponse } from "next/server";

export const photoStore: PhotoStore = {
  save: (photo, rules) => savePhoto(prisma, photo, rules),
  list: (limit) => listPhotos(prisma, limit),
  find: (id) => findPhoto(prisma, id),
  image: (id) => photoImage(prisma, id),
  remove: (id) => deletePhoto(prisma, id),
  setPinned: (id, pinned) => setPhotoPinned(prisma, id, pinned),
};

export function photoFail(error: PhotoError) {
  return NextResponse.json({ error: PHOTO_ERROR_TEXT[error], code: error }, { status: PHOTO_ERROR_STATUS[error] });
}
