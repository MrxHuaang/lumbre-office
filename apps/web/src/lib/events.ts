import "server-only";
import { INTERNAL_ROUTES, type GiftSentNotice, type SystemNotice } from "@hyvento/shared";

/** URL HTTP del servidor de juego (por defecto, la misma de WebSocket con http/https). */
function gameServerHttpUrl(): string | null {
  const explicit = process.env.GAME_SERVER_HTTP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const ws = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  return ws ? ws.replace(/^ws/, "http").replace(/\/$/, "") : null;
}

/** POST autenticado al servidor de juego; si está dormido o caído, solo se registra el error. */
async function notifyGameServer(route: string, what: string, body?: unknown) {
  const base = gameServerHttpUrl();
  const secret = process.env.GAME_TOKEN_SECRET;
  if (!base || !secret) return;
  try {
    const res = await fetch(`${base}${route}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(`El servidor de juego respondió ${res.status} al aviso de ${what}`);
  } catch (err) {
    console.error(`No se pudo avisar del cambio de ${what}:`, err instanceof Error ? err.message : err);
  }
}

/** Avisa al servidor de juego que cambiaron dueños o nombres de oficinas (para actualizar placas en vivo). */
export async function publishOfficesChanged() {
  // Si el servidor no responde, las placas se actualizan cuando vuelva a cargar las oficinas.
  await notifyGameServer(INTERNAL_ROUTES.officesChanged, "oficinas");
}

/** Avisa al servidor de juego que cambiaron los ajustes del casino (límite diario, abierto o cerrado). */
export async function publishCasinoSettingsChanged() {
  // Si el servidor no responde, los ajustes nuevos se leen cuando la sala vuelva a arrancar.
  await notifyGameServer(INTERNAL_ROUTES.casinoSettingsChanged, "casino");
}

/** Avisa al servidor de juego que un admin cambió permisos (se aplican sin que nadie reconecte). */
export async function publishPermissionsChanged() {
  // Si el servidor no responde, los permisos nuevos se leen cuando cada persona vuelva a entrar.
  await notifyGameServer(INTERNAL_ROUTES.permissionsChanged, "permisos");
}

/** Avisa al servidor de juego que se subió o se borró una foto (el tablón de la cafetería se refresca). */
export async function publishPhotosChanged() {
  // Si el servidor no responde, el tablón se actualiza la próxima vez que alguien lo mire.
  await notifyGameServer(INTERNAL_ROUTES.photosChanged, "fotos");
}

/** Avisa al servidor de juego que cambió el saldo de alguien (para el contador del HUD en vivo). */
export async function publishPointsChanged(userId: string) {
  // Si el servidor no responde, el saldo se lee de la base la próxima vez que esa persona entre.
  await notifyGameServer(INTERNAL_ROUTES.pointsChanged, "puntos", { userId });
}

/** Avisa al servidor de juego que alguien leyó o borró las notas de su puerta (se recuentan los post-its). */
export async function publishDoorNotesChanged(userId: string) {
  // Si el servidor no responde, los post-its se recuentan cuando vuelva a cargar las oficinas.
  await notifyGameServer(INTERNAL_ROUTES.doorNotesChanged, "notas de la puerta", { userId });
}

/** Avisa al servidor de juego que alguien recibió un regalo (si está conectado, le llega el aviso). */
export async function publishGiftSent(notice: GiftSentNotice) {
  // Si el servidor no responde, el regalo igual espera en el buzón.
  await notifyGameServer(INTERNAL_ROUTES.giftSent, "regalo", notice);
}

/** Pide al servidor de juego un aviso del sistema en el chat global (p. ej. un PR mezclado en GitHub). */
export async function publishSystemNotice(notice: SystemNotice) {
  // Si el servidor no responde (dormido en Render), el aviso se pierde: no es importante.
  await notifyGameServer(INTERNAL_ROUTES.systemNotice, "aviso del sistema", notice);
}
