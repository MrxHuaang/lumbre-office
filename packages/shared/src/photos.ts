// Fotos: cualquiera saca una foto con el botón "Foto" (o la tecla P). El servidor de juego cuenta 3-2-1
// sobre la cabeza (lo ven los del mismo nivel), decide quiénes salen y firma un "ticket" con eso; el
// navegador de quien la sacó recorta el canvas del juego, le pone el marco de polaroid y la sube a la
// web con el ticket. La web la guarda y avisa al servidor para que el tablón de la cafetería se refresque.
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { dayStart } from "./points";

export const PHOTO = {
  /** Cuenta regresiva antes del disparo (3-2-1). */
  countdownMs: 3000,
  /** Tiempo mínimo entre dos fotos de la misma persona (el servidor ignora las que lleguen antes). */
  cooldownMs: 8000,
  /** Lo que se ve en la foto: px de pantalla del juego (zoom 1) alrededor de quien la saca. */
  shot: { w: 320, h: 200 },
  /** El centro del encuadre queda así de más arriba que los pies (px de pantalla): la persona al medio. */
  lift: 20,
  /** Marco de polaroid alrededor de la foto (px de la foto a escala 1) y la franja del pie. */
  frame: { side: 8, top: 8, bottom: 40 },
  /** Tope del archivo que se sube (PNG o WebP). */
  maxBytes: 150 * 1024,
  /** Tope de ancho y alto de la imagen (la polaroid a escala 2 es 672 x 496). */
  maxSide: 800,
  /** Fotos por persona por día (de Bogotá). */
  dailyLimit: 20,
  /** Solo se guardan las últimas; las más viejas se borran al subir una nueva. */
  keep: 60,
  /** Pie de foto escrito por quien la saca. */
  captionMax: 60,
  /** Personas que se nombran en el pie (y se guardan). */
  maxPeople: 12,
  /** Cuánto vale el ticket para subir la foto (da tiempo de escribir el pie). */
  ticketTtl: "5m",
} as const;

/** Tamaño de la polaroid a escala 1 (la foto más el marco). */
export const POLAROID = {
  w: PHOTO.shot.w + PHOTO.frame.side * 2,
  h: PHOTO.shot.h + PHOTO.frame.top + PHOTO.frame.bottom,
} as const;

/** Alguien que sale en la foto. */
export const PhotoPerson = z.object({ id: z.string().min(1), name: z.string().min(1).max(40) });
export type PhotoPerson = z.infer<typeof PhotoPerson>;

// ---------- Encuadre ----------

/** Pies en px de mundo (tiles de 32). */
export interface Feet {
  x: number;
  y: number;
}

/**
 * Pantalla (px del juego a zoom 1) → la misma cuenta que la vista isométrica del cliente (`toScreen` de
 * @hyvento/map/art sobre unidades de arte = mundo / 2): x = (ax - ay), y = (ax + ay) / 2.
 */
function screenOffset(from: Feet, to: Feet) {
  const ax = (to.x - from.x) / 2;
  const ay = (to.y - from.y) / 2;
  return { x: ax - ay, y: (ax + ay) / 2 };
}

/** ¿Los pies de `other` caen dentro del encuadre de una foto sacada por quien está en `photographer`? */
export function inPhotoFrame(photographer: Feet, other: Feet): boolean {
  const s = screenOffset(photographer, other);
  // Un margen para que no cuente a quien sale cortado en el borde (el cuerpo sube ~30 px desde los pies).
  const halfW = PHOTO.shot.w / 2 - 6;
  const top = -PHOTO.shot.h / 2 - PHOTO.lift + 30;
  const bottom = PHOTO.shot.h / 2 - PHOTO.lift;
  return Math.abs(s.x) <= halfW && s.y >= top && s.y <= bottom;
}

/**
 * Quiénes salen: quien la saca primero y luego los demás por cercanía, hasta `PHOTO.maxPeople`.
 * `others` ya deben estar en el mismo nivel.
 */
export function peopleInFrame<T extends Feet & PhotoPerson>(photographer: T, others: T[]): PhotoPerson[] {
  const d = (p: Feet) => Math.hypot(p.x - photographer.x, p.y - photographer.y);
  const inFrame = others.filter((o) => o.id !== photographer.id && inPhotoFrame(photographer, o)).sort((a, b) => d(a) - d(b));
  const seen = new Set<string>();
  return [photographer, ...inFrame]
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .slice(0, PHOTO.maxPeople)
    .map((p) => ({ id: p.id, name: p.name }));
}

// ---------- Mensajes ----------

/** Servidor → los del mismo nivel (`MSG.photoCountdown`): alguien va a sacar una foto. */
export interface PhotoCountdownEvent {
  sessionId: string;
  ms: number;
}

/** Servidor → quien la sacó (`MSG.photoShot`): ya, a recortar el canvas y subirla con el ticket. */
export interface PhotoShot {
  ticket: string;
  area: string;
  people: PhotoPerson[];
  takenAt: number;
}

/** Servidor → los del mismo nivel (`MSG.photoFlash`): el flash de la cámara de alguien. */
export interface PhotoFlashEvent {
  sessionId: string;
}

// ---------- Ticket (lo firma el servidor de juego, lo verifica la web) ----------

export const PhotoTicketClaims = z.object({
  /** Quien la sacó (User.id). */
  sub: z.string().min(1),
  /** Id de la foto: la misma foto no se puede subir dos veces. */
  jti: z.string().min(1).max(64),
  area: z.string().min(1).max(40),
  people: z.array(PhotoPerson).max(PHOTO.maxPeople),
  takenAt: z.number().int().positive(),
});
export type PhotoTicketClaims = z.infer<typeof PhotoTicketClaims>;

const ISSUER = "hyvento-game";
const AUDIENCE = "hyvento-photo";

const key = (secret: string) => {
  if (!secret || secret.length < 32) throw new Error("GAME_TOKEN_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(secret);
};

export async function signPhotoTicket(claims: PhotoTicketClaims, secret: string, ttl: string = PHOTO.ticketTtl): Promise<string> {
  const { sub, jti, ...rest } = PhotoTicketClaims.parse(claims);
  return new SignJWT(rest)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setJti(jti)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(key(secret));
}

export async function verifyPhotoTicket(token: string, secret: string): Promise<PhotoTicketClaims> {
  const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
  return PhotoTicketClaims.parse(payload);
}

// ---------- Subida ----------

export type PhotoMime = "image/png" | "image/webp";

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ascii = (b: Uint8Array, at: number, text: string) => [...text].every((ch, i) => b[at + i] === ch.charCodeAt(0));
const u16le = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8);
const u24le = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16);
const u32be = (b: Uint8Array, at: number) => ((b[at]! << 24) >>> 0) + (b[at + 1]! << 16) + (b[at + 2]! << 8) + b[at + 3]!;

/**
 * Qué es de verdad el archivo (por sus primeros bytes, no por lo que dice el navegador) y su tamaño en
 * píxeles. null si no es un PNG ni un WebP que se entienda.
 */
export function sniffPhoto(b: Uint8Array): { mime: PhotoMime; width: number; height: number } | null {
  if (b.length >= 24 && PNG_SIG.every((v, i) => b[i] === v) && ascii(b, 12, "IHDR")) {
    return { mime: "image/png", width: u32be(b, 16), height: u32be(b, 20) };
  }
  if (b.length >= 30 && ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) {
    if (ascii(b, 12, "VP8X")) return { mime: "image/webp", width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
    if (ascii(b, 12, "VP8L") && b[20] === 0x2f) {
      const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
      return { mime: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (ascii(b, 12, "VP8 ") && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      return { mime: "image/webp", width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
    }
  }
  return null;
}

export type PhotoError = "auth" | "ticket" | "not-yours" | "type" | "size" | "limit" | "duplicate" | "caption" | "not-found" | "forbidden";

export const PHOTO_ERROR_TEXT: Record<PhotoError, string> = {
  auth: "Tienes que iniciar sesión.",
  ticket: "La foto venció o no es válida. Saca otra.",
  "not-yours": "Esa foto la sacó otra persona.",
  type: "La foto tiene que ser PNG o WebP.",
  size: "La foto pesa demasiado.",
  limit: `Ya sacaste ${PHOTO.dailyLimit} fotos hoy. Mañana hay más rollo.`,
  duplicate: "Esa foto ya está en el tablón.",
  caption: `El pie de foto puede tener hasta ${PHOTO.captionMax} letras.`,
  "not-found": "Esa foto ya no está.",
  forbidden: "Solo quien la sacó (o un admin) puede hacer eso.",
};

/** HTTP de cada error de la API. */
export const PHOTO_ERROR_STATUS: Record<PhotoError, number> = {
  auth: 401,
  ticket: 400,
  "not-yours": 403,
  type: 415,
  size: 413,
  limit: 429,
  duplicate: 409,
  caption: 400,
  "not-found": 404,
  forbidden: 403,
};

/** Revisa el archivo: tipo real, peso y tamaño en píxeles. */
export function checkPhotoFile(bytes: Uint8Array): { ok: true; mime: PhotoMime } | { ok: false; error: PhotoError } {
  if (bytes.length > PHOTO.maxBytes) return { ok: false, error: "size" };
  const kind = sniffPhoto(bytes);
  if (!kind) return { ok: false, error: "type" };
  if (kind.width < 1 || kind.height < 1 || kind.width > PHOTO.maxSide || kind.height > PHOTO.maxSide) return { ok: false, error: "size" };
  return { ok: true, mime: kind.mime };
}

/** Pie de foto limpio (sin saltos de línea ni espacios de más); null si es demasiado largo. */
export function cleanCaption(raw: unknown): string | null {
  const text = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  return text.length > PHOTO.captionMax ? null : text;
}

/** Desde cuándo se cuentan las fotos de hoy (día de Bogotá, igual que los puntos). */
export const photoDayStart = (now: number) => new Date(dayStart(now));

/** Borrar una foto (o sacarla del tablón): quien la sacó o un admin. */
export function canManagePhoto(photo: { takenById: string }, user: { id: string; role: string }): boolean {
  return photo.takenById === user.id || user.role === "ADMIN";
}

// ---------- Lo que ve el cliente ----------

export interface PhotoDTO {
  id: string;
  takenBy: { id: string; name: string };
  area: string;
  caption: string;
  people: PhotoPerson[];
  pinned: boolean;
  createdAt: string;
  mime: string;
  /** La sacaste tú. */
  mine: boolean;
  /** Puedes borrarla (tuya o eres admin). */
  canManage: boolean;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "27 sep 2026 · 3:05 p. m." en hora de Bogotá. */
export function photoDateText(ts: number): string {
  const d = new Date(ts - 5 * 3_600_000);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${h12}:${m} ${h < 12 ? "a. m." : "p. m."}`;
}

/** "Ana, Bruno y Carla" (con "y N más" si son muchos). */
export function peopleText(people: { name: string }[], max = 4): string {
  const names = people.map((p) => p.name);
  if (names.length <= 1) return names[0] ?? "";
  if (names.length > max) return `${names.slice(0, max - 1).join(", ")} y ${names.length - max + 1} más`;
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}
