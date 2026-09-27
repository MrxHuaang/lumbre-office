import { photoImageFor } from "@hyvento/shared";
import { getCurrentUser } from "@/lib/current-user";
import { photoFail, photoStore } from "@/lib/photos";

/** La imagen de una foto. No cambia nunca (una foto nueva es otro id): el navegador la guarda. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await photoImageFor(photoStore, await getCurrentUser(), id);
  if (!res.ok) return photoFail(res.error);
  return new Response(new Blob([res.value.image as BlobPart], { type: res.value.mime }), {
    headers: {
      "Content-Type": res.value.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
