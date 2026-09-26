// Lógica del navegador de favoritos (sin React). Casi todos los sitios (Google, GitHub…) prohíben que se
// los meta en un iframe, así que no es un navegador general: solo se abren dentro del PC los de la lista
// blanca, convertidos a su versión para incrustar; el resto se ofrece abrir en otra pestaña.

export type BrowseTarget =
  /** Se abre dentro de la ventana: `src` es la versión para incrustar de `url`. */
  | { kind: "embed"; url: string; src: string; site: string }
  /** Existe, pero no se deja incrustar: se abre en otra pestaña. */
  | { kind: "external"; url: string; site: string | null; hint?: string }
  | { kind: "invalid"; reason: string };

export interface Favorite {
  id: string;
  title: string;
  url: string;
}

export const FAVORITE_TITLE_MAX = 60;
export const FAVORITES_MAX = 40;

/** Favoritos que vienen con el PC (no se pueden borrar). */
export const DEFAULT_FAVORITES: Favorite[] = [
  { id: "d-lofi", title: "Radio lo-fi", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk" },
  { id: "d-excalidraw", title: "Excalidraw", url: "https://excalidraw.com/" },
  { id: "d-wikipedia", title: "Wikipedia", url: "https://es.wikipedia.org/wiki/Wikipedia:Portada" },
];

const hostOf = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, "");

/** Convierte lo que escribió la persona en una URL http(s), o explica por qué no se puede. */
export function parseAddress(raw: string): URL | { reason: string } {
  const text = raw.trim();
  if (!text) return { reason: "Escribe una dirección." };
  if (/\s/.test(text)) return { reason: "Una dirección no lleva espacios." };
  // Sin esquema ("youtube.com/…") se asume https. Con otro esquema (javascript:, data:, file:…) no se abre.
  const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(text) || /^(javascript|data|vbscript|file|blob|about|mailto):/i.test(text);
  let url: URL;
  try {
    url = new URL(hasScheme ? text : `https://${text}`);
  } catch {
    return { reason: "Esa dirección no es válida." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { reason: "Solo se abren direcciones http:// o https://." };
  if (!url.hostname.includes(".") && url.hostname !== "localhost") return { reason: "Esa dirección no es válida." };
  if (url.username || url.password) return { reason: "Por seguridad, no se abren direcciones con usuario o contraseña." };
  return url;
}

// ---------- Sitios que se dejan incrustar ----------

/** "90", "90s", "1m30s", "1h2m3s" → segundos. */
function parseYoutubeTime(t: string | null): number {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

function youtubeEmbed(u: URL): string | null {
  const [, first, second] = u.pathname.split("/");
  let id: string | null = null;
  if (hostOf(u) === "youtu.be") id = first ?? null;
  else if (first === "watch") id = u.searchParams.get("v");
  else if (first === "embed" || first === "shorts" || first === "live" || first === "v") id = second ?? null;
  if (id && !/^[\w-]{11}$/.test(id)) id = null;

  const params = new URLSearchParams();
  const list = u.searchParams.get("list");
  if (list && /^[\w-]+$/.test(list)) params.set("list", list);
  const start = parseYoutubeTime(u.searchParams.get("t") ?? u.searchParams.get("start"));
  if (start > 0) params.set("start", String(start));
  // Una lista sin video (youtube.com/playlist?list=…) se incrusta como "videoseries".
  if (!id && !params.has("list")) return null;
  const qs = params.toString();
  return `https://www.youtube.com/embed/${id ?? "videoseries"}${qs ? `?${qs}` : ""}`;
}

const SPOTIFY_TYPES = new Set(["track", "album", "playlist", "artist", "episode", "show"]);

function spotifyEmbed(u: URL): string | null {
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts[0]?.startsWith("intl-")) parts.shift(); // open.spotify.com/intl-es/track/…
  if (parts[0] === "embed") parts.shift();
  const [type, id] = parts;
  if (!type || !id || !SPOTIFY_TYPES.has(type) || !/^[A-Za-z0-9]+$/.test(id)) return null;
  return `https://open.spotify.com/embed/${type}/${id}`;
}

const FIGMA_KINDS = new Set(["file", "design", "proto", "board", "slides", "deck"]);

function figmaEmbed(u: URL): string | null {
  const first = u.pathname.split("/")[1] ?? "";
  if (first === "embed") return u.toString();
  if (!FIGMA_KINDS.has(first)) return null;
  return `https://www.figma.com/embed?embed_host=hyvento&url=${encodeURIComponent(u.toString())}`;
}

/** Google Docs solo se deja ver en un iframe si está publicado en la web (/pub) o en vista previa (/preview). */
function googleDocsEmbed(u: URL): string | null {
  const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
  return ["pub", "pubhtml", "preview", "embed"].includes(last) ? u.toString() : null;
}

interface SiteRule {
  site: string;
  matches: (host: string) => boolean;
  embed: (u: URL) => string | null;
  /** Qué hacer si es de este sitio pero la dirección no sirve para incrustar. */
  hint?: string;
}

const SITES: SiteRule[] = [
  {
    site: "YouTube",
    matches: (h) => ["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "youtube-nocookie.com"].includes(h),
    embed: youtubeEmbed,
    hint: "Abre un video o una lista (youtube.com/watch?v=…) para verlo aquí.",
  },
  {
    site: "Spotify",
    matches: (h) => h === "open.spotify.com",
    embed: spotifyEmbed,
    hint: "Copia el enlace de una canción, álbum, lista o pódcast para escucharlo aquí.",
  },
  {
    site: "Figma",
    matches: (h) => h === "figma.com",
    embed: figmaEmbed,
    hint: "Copia el enlace de un archivo de Figma (figma.com/design/…) para verlo aquí.",
  },
  {
    site: "Google Docs",
    matches: (h) => h === "docs.google.com",
    embed: googleDocsEmbed,
    hint: "Para verlo aquí, publícalo en la web (Archivo → Compartir → Publicar en la Web) o usa el enlace que termina en /preview.",
  },
  { site: "Excalidraw", matches: (h) => h === "excalidraw.com", embed: (u) => u.toString() },
  { site: "Wikipedia", matches: (h) => h === "wikipedia.org" || h.endsWith(".wikipedia.org"), embed: (u) => u.toString() },
];

/** Qué hacer con una dirección: abrirla dentro, ofrecer otra pestaña o avisar que no es válida. */
export function resolveAddress(raw: string): BrowseTarget {
  const parsed = parseAddress(raw);
  if (!(parsed instanceof URL)) return { kind: "invalid", reason: parsed.reason };
  const url = parsed.toString();
  const rule = SITES.find((s) => s.matches(hostOf(parsed)));
  if (!rule) return { kind: "external", url, site: null };
  const src = rule.embed(parsed);
  return src ? { kind: "embed", url, src, site: rule.site } : { kind: "external", url, site: rule.site, hint: rule.hint };
}

/** Nombre corto para un favorito nuevo: el título del sitio o el dominio. */
export function suggestTitle(target: BrowseTarget): string {
  if (target.kind === "invalid") return "";
  if (target.site) return target.site;
  try {
    return hostOf(new URL(target.url));
  } catch {
    return target.url.slice(0, FAVORITE_TITLE_MAX);
  }
}

// ---------- Favoritos propios (localStorage) ----------

const STORAGE_KEY = "hyvento.pc.favoritos";

/** Lee los favoritos guardados; si el almacenamiento falla o trae basura, se ignora. */
export function loadFavorites(): Favorite[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (f): f is Favorite =>
          typeof f === "object" && f !== null && typeof f.id === "string" && typeof f.title === "string" && typeof f.url === "string",
      )
      .filter((f) => parseAddress(f.url) instanceof URL)
      .map((f) => ({ id: f.id, title: f.title.slice(0, FAVORITE_TITLE_MAX), url: f.url }))
      .slice(0, FAVORITES_MAX);
  } catch {
    return [];
  }
}

export function saveFavorites(list: Favorite[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Modo privado o almacenamiento lleno: los favoritos quedan solo mientras dure la visita.
  }
}
