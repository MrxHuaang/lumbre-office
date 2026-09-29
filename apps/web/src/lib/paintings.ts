import "server-only";
// Pintura: el almacén de Prisma para el servicio de @hyvento/shared (painting-service.ts) y la respuesta
// de error común de las rutas de /api/paintings.
import { createPainting, findPainting, listPaintings, prisma, removePaintingFromBackpack } from "@hyvento/db";
import { PAINTING_ERROR_STATUS, PAINTING_ERROR_TEXT, type PaintingError, type PaintingStore } from "@hyvento/shared";
import { NextResponse } from "next/server";

export const paintingStore: PaintingStore = {
  create: (input, rules) => createPainting(prisma, input, rules),
  listByUser: (userId) => listPaintings(prisma, userId),
  find: (id) => findPainting(prisma, id),
  removeFromBackpack: (userId, id) => removePaintingFromBackpack(prisma, userId, id),
};

export function paintingFail(error: PaintingError) {
  return NextResponse.json({ error: PAINTING_ERROR_TEXT[error], code: error }, { status: PAINTING_ERROR_STATUS[error] });
}
