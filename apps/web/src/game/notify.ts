// Avisos del navegador (Notification API) para cuando Lumbre está en segundo plano: que suene el teléfono,
// que toquen la puerta, que te mencionen en el chat, que te inviten a intercambiar o que alguien se acerque
// a hablarte no se pierda por estar en otra pestaña. Con la pestaña a la vista no avisa: ya está el HUD.
// Arriba van las reglas puras (con tests); abajo, lo que toca el navegador y la sala.
import { allZones, getWorld } from "@hyvento/map";
import {
  canHear,
  MSG,
  PROXIMITY_RADIUS,
  type ChatEvent,
  type KnockRequest,
  type PhoneEvent,
  type Positioned,
  type PresenceStatus,
  type TradeInvite,
} from "@hyvento/shared";
import type { Room } from "colyseus.js";
import { create } from "zustand";
import { answerPhone } from "./phone";
import { usePhoneStore } from "./phone/state";
import { getSfxSettings } from "./sfx";
import { sharedAudio } from "./sound";
import { useOfficeStore } from "./store";

// ---------- Reglas puras ----------

export type NotifyKind = "phone" | "knock" | "mention" | "invite" | "nearby" | "wave" | "announce";

export interface NotifyContext {
  /** La persona activó los avisos en Lumbre. */
  enabled: boolean;
  /** `Notification.permission` ("unsupported" si el navegador no tiene la API). */
  permission: NotificationPermission | "unsupported";
  /** `document.visibilityState === "visible"`. */
  visible: boolean;
  /** `document.hasFocus()`. */
  focused: boolean;
  /**
   * Estado de presencia de quien recibe. Punto de extensión: con "No molestar" no se avisa (el sistema de
   * estados vive aparte; esto solo lo lee).
   */
  status?: PresenceStatus | string;
}

/** ¿Hay que mostrar un aviso del navegador? Solo si está activado y permitido, y Lumbre no está a la vista. */
export function shouldNotify(ctx: NotifyContext): boolean {
  if (!ctx.enabled || ctx.permission !== "granted") return false;
  if (ctx.status === "dnd") return false;
  return !(ctx.visible && ctx.focused);
}

/** Cada cuánto se puede volver a avisar que la misma persona se acercó. */
export const NEARBY_COOLDOWN_MS = 2 * 60_000;
/** Cuánto hay que llevar sin moverse para contar como "quieto" (si voy caminando, soy yo el que se acerca). */
export const STILL_MS = 4000;

/** ¿Pasó el enfriamiento desde el último aviso con esta clave? */
export function cooldownOk(last: ReadonlyMap<string, number>, key: string, now: number, ms: number): boolean {
  const t = last.get(key);
  return t === undefined || now - t >= ms;
}

/**
 * Quiénes acaban de entrar a mi rango (están en `next` y no estaban en `prev`) y merecen aviso: yo quieto
 * y sin haber avisado de esa persona en el enfriamiento. Con `prev` null (primera vista) no hay nadie
 * "nuevo": los que ya estaban al entrar no se acercaron.
 */
export function detectApproaches(opts: {
  prev: ReadonlySet<string> | null;
  next: ReadonlySet<string>;
  still: boolean;
  now: number;
  lastNotified: ReadonlyMap<string, number>;
  cooldownMs?: number;
}): string[] {
  const { prev, next, still, now, lastNotified, cooldownMs = NEARBY_COOLDOWN_MS } = opts;
  if (!prev || !still) return [];
  return [...next].filter((id) => !prev.has(id) && cooldownOk(lastNotified, id, now, cooldownMs));
}

/** Minúsculas y sin tildes, para comparar nombres ("José" = "jose"). */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * ¿El mensaje menciona a `name`? Vale el nombre completo o el primer nombre (de 3 letras o más), como
 * palabra suelta y con o sin @, sin importar tildes ni mayúsculas: "hola @juan", "Juan José, ¿vienes?".
 */
export function mentionsName(text: string, name: string): boolean {
  const full = fold(name.trim());
  if (!full) return false;
  const msg = fold(text);
  const first = full.split(/\s+/)[0] ?? "";
  const candidates = [full, ...(first.length >= 3 && first !== full ? [first] : [])];
  return candidates.some((c) => new RegExp(`(^|[^\\p{L}\\p{N}])@?${escapeRegExp(c)}($|[^\\p{L}\\p{N}])`, "u").test(msg));
}

// ---------- Preferencia ----------

const STORAGE_KEY = "hyvento:avisos";
/** "on" / "off" = lo que eligió; null = nunca se le preguntó (se muestra el aviso de "Activar avisos"). */
type Pref = "on" | "off" | null;

function loadPref(): Pref {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return v === "on" || v === "off" ? v : null;
  } catch {
    return null;
  }
}

function savePref(pref: "on" | "off") {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Sin almacenamiento (incógnito, bloqueado): vale solo por esta visita.
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function currentPermission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

interface NotifyStore {
  pref: Pref;
  permission: NotificationPermission | "unsupported";
}

export const useNotifyStore = create<NotifyStore>(() => ({ pref: loadPref(), permission: currentPermission() }));

/** Relee la preferencia y el permiso (el módulo pudo cargarse antes de tener `window`). */
export function syncNotifyState() {
  useNotifyStore.setState({ pref: loadPref(), permission: currentPermission() });
}

/** Los avisos están activos (elegidos y con permiso del navegador). */
export const selectNotifyOn = (s: NotifyStore) => s.pref === "on" && s.permission === "granted";

/**
 * Prender o apagar los avisos. Prender pide permiso al navegador, así que hay que llamarlo desde un clic
 * (el navegador no deja pedirlo sin un gesto). Devuelve si quedaron activos.
 */
export async function setNotificationsEnabled(on: boolean): Promise<boolean> {
  if (!on || !notificationsSupported()) {
    savePref("off");
    useNotifyStore.setState({ pref: "off", permission: currentPermission() });
    return false;
  }
  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = Notification.permission;
    }
  }
  const granted = permission === "granted";
  savePref(granted ? "on" : "off");
  useNotifyStore.setState({ pref: granted ? "on" : "off", permission });
  return granted;
}

/** El permiso pudo cambiar desde la barra del navegador: se relee al volver a la pestaña. */
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    const permission = currentPermission();
    if (permission !== useNotifyStore.getState().permission) useNotifyStore.setState({ permission });
  });
}

// ---------- Mostrar el aviso ----------

const TITLE: Record<NotifyKind, string> = {
  phone: "Te están llamando",
  knock: "Tocan tu puerta",
  mention: "Te mencionaron",
  invite: "Te invitan",
  nearby: "Alguien se acercó",
  wave: "Te saludan",
  announce: "Aviso para toda la cabaña",
};

/** Los avisos abiertos por tipo (la misma `tag` reemplaza al anterior; se cierran cuando ya no valen). */
const open = new Map<NotifyKind, Notification>();

function myPlayer() {
  const s = useOfficeStore.getState();
  return s.sessionId ? s.players[s.sessionId] : undefined;
}

function context(): NotifyContext {
  const s = useNotifyStore.getState();
  return {
    enabled: s.pref === "on",
    permission: s.permission,
    visible: document.visibilityState === "visible",
    focused: document.hasFocus(),
    status: myPlayer()?.status,
  };
}

/** Muestra el aviso si corresponde; al hacerle clic, vuelve a Lumbre y corre `onClick`. */
export function browserNotify(kind: NotifyKind, body: string, opts: { title?: string; onClick?: () => void; sound?: boolean } = {}): boolean {
  if (!notificationsSupported() || !shouldNotify(context())) return false;
  let n: Notification;
  try {
    n = new Notification(opts.title ?? TITLE[kind], { body, tag: `lumbre-${kind}`, icon: "/icon", lang: "es" });
  } catch {
    // Algunos navegadores (Chrome en Android) solo dejan avisar desde un service worker.
    return false;
  }
  open.get(kind)?.close();
  open.set(kind, n);
  n.onclick = () => {
    window.focus();
    opts.onClick?.();
    n.close();
  };
  n.onclose = () => {
    if (open.get(kind) === n) open.delete(kind);
  };
  if (opts.sound !== false) chime();
  return true;
}

function closeNotification(kind: NotifyKind) {
  open.get(kind)?.close();
  open.delete(kind);
}

/**
 * Dos notas cortas y suaves. No usa `sfxOut` (que calla con la pestaña oculta, justo cuando este aviso
 * hace falta), pero respeta el volumen y el silencio de los efectos.
 */
function chime() {
  const s = getSfxSettings();
  if (s.muted || s.volume <= 0) return;
  const a = sharedAudio();
  if (!a || a.ctx.state !== "running") return;
  const { ctx } = a;
  const vol = 0.18 * s.volume ** 2;
  [880, 1318.5].forEach((f, i) => {
    const at = ctx.currentTime + 0.02 + i * 0.12;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
    g.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    osc.connect(g);
    osc.start(at);
    osc.stop(at + 0.4);
  });
}

// ---------- Eventos de la sala ----------

/** Cada cuánto se recalcula quién está cerca (los parches del estado llegan mucho más seguido). */
const NEARBY_CHECK_MS = 1000;

let zones: Map<string, { isolated: boolean }> | null = null;
function zoneIsolated(zoneId: string): boolean {
  zones ??= new Map(allZones(getWorld()).map((z) => [z.id, { isolated: Boolean(z.isolated) }]));
  return zones.get(zoneId)?.isolated ?? false;
}

interface StatePlayer {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
  zoneId: string;
}

function positioned(p: StatePlayer): Positioned {
  return { area: p.area, x: p.x, y: p.y, zoneId: p.zoneId || null, zoneIsolated: p.zoneId ? zoneIsolated(p.zoneId) : false };
}

/** Engancha los avisos a la sala (se llama al entrar, junto con los demás `bind*`). */
export function bindNotify(r: Room) {
  for (const n of open.values()) n.close();
  open.clear();

  r.onMessage(MSG.phoneEvent, (e: PhoneEvent) => {
    if (e.kind === "ringing") {
      browserNotify("phone", `${e.withName} te llama${e.from ? ` desde ${e.from}` : ""}. Haz clic para contestar.`, {
        onClick: () => answerPhone(true),
        // El teléfono ya tiene su timbre.
        sound: false,
      });
    } else if (e.kind === "connected" || e.kind === "ended") {
      closeNotification("phone");
    }
  });

  r.onMessage(MSG.knockRequest, (req: KnockRequest) => {
    browserNotify("knock", `${req.fromName} toca la puerta de tu oficina.`);
  });

  r.onMessage(MSG.chatEvent, (e: ChatEvent) => {
    const me = myPlayer();
    if (!me || e.fromId === me.userId || !mentionsName(e.text, me.name)) return;
    browserNotify("mention", e.text.length > 140 ? `${e.text.slice(0, 139)}…` : e.text, {
      title: `${e.fromName} te mencionó`,
      // El chat vive en el celular: se abre en Mensajes, en la pestaña del mensaje.
      onClick: () => usePhoneStore.getState().show({ app: "mensajes", scope: e.scope }),
    });
  });

  r.onMessage(MSG.tradeInvite, (inv: TradeInvite) => {
    browserNotify("invite", `${inv.fromName} te invita a intercambiar.`);
  });

  // "Alguien se acercó a hablarte": se mira el estado cuando llegan cambios (los parches del servidor
  // llegan aunque la pestaña esté oculta; la escena de Phaser, en cambio, se duerme).
  let prev: Set<string> | null = null;
  const lastNotified = new Map<string, number>();
  let myPos = "";
  let lastMovedAt = Date.now();
  let lastCheck = 0;
  r.onStateChange((state: { players?: Map<string, StatePlayer> }) => {
    const now = Date.now();
    if (now - lastCheck < NEARBY_CHECK_MS || !state.players) return;
    lastCheck = now;
    const me = state.players.get(r.sessionId);
    if (!me) return;
    const pos = `${me.area}:${Math.round(me.x)}:${Math.round(me.y)}`;
    if (pos !== myPos) {
      myPos = pos;
      lastMovedAt = now;
    }
    const here = positioned(me);
    const names = new Map<string, string>();
    const next = new Set<string>();
    state.players.forEach((p, sessionId) => {
      if (sessionId === r.sessionId || !p.userId || p.userId === me.userId) return;
      if (canHear(here, positioned(p), PROXIMITY_RADIUS)) {
        next.add(p.userId);
        names.set(p.userId, p.name);
      }
    });
    const arrivals = detectApproaches({ prev, next, still: now - lastMovedAt >= STILL_MS, now, lastNotified });
    prev = next;
    if (arrivals.length === 0) return;
    const who = arrivals.map((id) => names.get(id) ?? "Alguien");
    const body = who.length === 1 ? `${who[0]} se acercó a hablarte.` : `${who.slice(0, -1).join(", ")} y ${who.at(-1)} se acercaron a hablarte.`;
    if (browserNotify("nearby", body)) for (const id of arrivals) lastNotified.set(id, now);
  });
}
