import { createPainting, listMyPaintings } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { publishPointsChanged } from "@/lib/events";
import { paintingFail, paintingStore } from "@/lib/paintings";

/** Mis cuadros (la galería de la app Pintura). */
export async function GET() {
  const res = await listMyPaintings(paintingStore, await getCurrentUser());
  if (!res.ok) return paintingFail(res.error);
  return NextResponse.json({ paintings: res.value }, { headers: { "Cache-Control": "no-store" } });
}

/** Guardar un cuadro nuevo (`{ title, pixels }`): queda en la mochila, listo para colgar en la oficina. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const user = await getCurrentUser();
  const res = await createPainting(paintingStore, user, body);
  if (!res.ok) return paintingFail(res.error);
  // El aviso de puntos hace que el servidor de juego relea la mochila (ahí aparece el cuadro).
  await publishPointsChanged(user!.id);
  return NextResponse.json({ painting: res.value }, { status: 201 });
}
