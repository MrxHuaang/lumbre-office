// Datos de un video de YouTube al agregarlo a la cola del club: el título, y de paso si existe y si deja
// ponerse fuera de YouTube. Usa oEmbed, que no pide clave (nada de la API de datos, que es de pago/cuota).
import type { YoutubeInfo } from "@hyvento/shared";

export type YoutubeLookup = (videoId: string) => Promise<YoutubeInfo>;

/** Si YouTube no contesta (sin red, caído), el video entra igual con este título. */
export const FALLBACK_TITLE = "Video de YouTube";

export const lookupYoutube: YoutubeLookup = async (videoId) => {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  } catch {
    return { ok: true, title: FALLBACK_TITLE };
  }
  // 401/403: existe pero su dueño no deja insertarlo; 400/404: no existe o es privado.
  if (res.status === 401 || res.status === 403) return { ok: false, error: "not-embeddable" };
  if (res.status === 400 || res.status === 404) return { ok: false, error: "not-found" };
  if (!res.ok) return { ok: true, title: FALLBACK_TITLE };
  const data = (await res.json().catch(() => null)) as { title?: unknown } | null;
  const title = typeof data?.title === "string" && data.title.trim() ? data.title.trim() : FALLBACK_TITLE;
  return { ok: true, title };
};
