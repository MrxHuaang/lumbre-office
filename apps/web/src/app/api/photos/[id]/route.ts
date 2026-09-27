import { deletePhotoAs, pinPhotoAs } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/current-user";
import { publishPhotosChanged } from "@/lib/events";
import { photoFail, photoStore } from "@/lib/photos";

type Params = { params: Promise<{ id: string }> };

/** Borrar una foto: quien la sacó o un admin. */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const res = await deletePhotoAs(photoStore, await getCurrentUser(), id);
  if (!res.ok) return photoFail(res.error);
  await publishPhotosChanged();
  return NextResponse.json({ ok: true });
}

const PinBody = z.object({ pinned: z.boolean() });

/** Pinchar en el corcho o sacarla (sigue en la galería): quien la sacó o un admin. */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = PinBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Falta `pinned`" }, { status: 400 });
  const res = await pinPhotoAs(photoStore, await getCurrentUser(), id, body.data.pinned);
  if (!res.ok) return photoFail(res.error);
  await publishPhotosChanged();
  return NextResponse.json({ photo: res.value });
}
