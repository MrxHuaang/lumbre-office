import { deletePainting, getPainting } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { publishPointsChanged } from "@/lib/events";
import { paintingFail, paintingStore } from "@/lib/paintings";

type Params = { params: Promise<{ id: string }> };

/** Un cuadro (para dibujarlo colgado en una oficina): no cambia nunca, así que se puede guardar en caché. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const res = await getPainting(paintingStore, await getCurrentUser(), id);
  if (!res.ok) return paintingFail(res.error);
  return NextResponse.json({ painting: res.value }, { headers: { "Cache-Control": "private, max-age=86400, immutable" } });
}

/** Borrar un cuadro propio que está en la mochila. */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  const res = await deletePainting(paintingStore, user, id);
  if (!res.ok) return paintingFail(res.error);
  await publishPointsChanged(user!.id);
  return NextResponse.json({ ok: true });
}
