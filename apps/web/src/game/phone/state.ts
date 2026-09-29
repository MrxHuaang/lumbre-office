// Estado del celular: si está afuera, la carcasa, el fondo, el tono y la alarma. Es chico a propósito:
// lo importan el HUD y los sonidos del chat, y el celular en sí (pantallas, apps) se descarga recién
// al sacarlo. Las preferencias se guardan en este navegador.
import { CELULAR_ITEM, type ChatScope } from "@hyvento/shared";
import { create } from "zustand";
import { useBagStore } from "../bag";
import { useOfficeStore } from "../store";
import { CLASSIC_TONE } from "./tonos";
import type { Alarm } from "./hora";

export type PhoneSkin = "negro" | "vino" | "plata";
export type PhoneWallpaper = "cabana" | "lumbre" | "lluvia";

export const SKINS: { id: PhoneSkin; name: string }[] = [
  { id: "negro", name: "Negro mate" },
  { id: "vino", name: "Vino tinto" },
  { id: "plata", name: "Plata" },
];
export const WALLPAPERS: { id: PhoneWallpaper; name: string }[] = [
  { id: "cabana", name: "La cabaña" },
  { id: "lumbre", name: "Lumbre" },
  { id: "lluvia", name: "Noche de lluvia" },
];

interface Prefs {
  skin: PhoneSkin;
  wallpaper: PhoneWallpaper;
  /** Tono de los mensajes del chat (`clasico` = el bip de siempre). */
  tone: string;
  alarm: Alarm;
  snakeBest: number;
}

const STORAGE_KEY = "hyvento:celular";
const DEFAULTS: Prefs = {
  skin: "vino",
  wallpaper: "cabana",
  tone: CLASSIC_TONE,
  alarm: { on: false, h: 7, m: 30, firedOn: "" },
  snakeBest: 0,
};

function loadPrefs(): Prefs {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULTS };
    const v = JSON.parse(raw) as Partial<Prefs>;
    const alarm = { ...DEFAULTS.alarm, ...(typeof v.alarm === "object" && v.alarm ? v.alarm : {}) };
    return {
      skin: SKINS.some((s) => s.id === v.skin) ? v.skin! : DEFAULTS.skin,
      wallpaper: WALLPAPERS.some((w) => w.id === v.wallpaper) ? v.wallpaper! : DEFAULTS.wallpaper,
      tone: typeof v.tone === "string" ? v.tone : DEFAULTS.tone,
      alarm: {
        on: alarm.on === true,
        h: Number.isInteger(alarm.h) && alarm.h >= 0 && alarm.h < 24 ? alarm.h : DEFAULTS.alarm.h,
        m: Number.isInteger(alarm.m) && alarm.m >= 0 && alarm.m < 60 ? alarm.m : DEFAULTS.alarm.m,
        firedOn: typeof alarm.firedOn === "string" ? alarm.firedOn : "",
      },
      snakeBest: typeof v.snakeBest === "number" && Number.isFinite(v.snakeBest) ? Math.max(0, Math.floor(v.snakeBest)) : 0,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function savePrefs(p: Prefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Sin almacenamiento (incógnito, bloqueado): vale solo por esta visita.
  }
}

/** Adónde abrir el celular: el inicio, o Mensajes en una pestaña (listo para escribir). */
export type PhoneTarget = { app: "mensajes"; scope?: ChatScope; text?: string; quick?: boolean } | null;

interface PhoneStore extends Prefs {
  /** El celular está en pantalla (también mientras se cierra la tapa y se guarda). */
  mounted: boolean;
  /** Lo que se quiere: afuera y abierto, o guardándose. */
  open: boolean;
  /** Algo para hacer cuando termine de guardarse (sacar la foto de la cámara, abrir un perfil). */
  afterClose: (() => void) | null;
  /**
   * Hora (del servidor) del último mensaje leído. Arranca con el historial que llega al conectar (ver
   * network.ts): así lo viejo no cuenta como nuevo aunque el reloj del computador ande corrido.
   */
  readUntil: number;
  /** Pedido de abrir en una pantalla (cambia `nonce` en cada pedido, aunque ya esté afuera). */
  request: { target: PhoneTarget; nonce: number };
  /** Cambia en cada vibración (mensaje nuevo, alarma). */
  buzzAt: number;
  /** La alarma está sonando ahora. */
  ringing: boolean;
  show: (target?: PhoneTarget) => void;
  hide: (afterClose?: () => void) => void;
  toggle: () => void;
  /** La tapa terminó de cerrarse y el celular bajó: se desmonta. */
  closed: () => void;
  setPrefs: (p: Partial<Prefs>) => void;
  markRead: (ts: number) => void;
  buzz: () => void;
  setRinging: (on: boolean) => void;
}

export const usePhoneStore = create<PhoneStore>((set, get) => ({
  ...loadPrefs(),
  mounted: false,
  open: false,
  afterClose: null,
  readUntil: 0,
  request: { target: null, nonce: 0 },
  buzzAt: 0,
  ringing: false,
  show: (target = null) => {
    if (!tengoCelular()) {
      useOfficeStore.getState().notify("Tu celular no está en la mochila.", "warning");
      return;
    }
    if (!get().mounted) {
      // Desde que se pide, el teclado es del celular: mientras baja su código (la primera vez tarda un
      // poco) las letras no mueven al personaje y se guardan para escribirlas apenas abra.
      useOfficeStore.getState().setTyping(true);
      startTypeAhead();
    }
    set((s) => ({ mounted: true, open: true, afterClose: null, request: { target, nonce: s.request.nonce + 1 } }));
  },
  hide: (afterClose) => set({ open: false, afterClose: afterClose ?? null }),
  toggle: () => (get().open ? get().hide() : get().show()),
  closed: () => {
    const after = get().afterClose;
    if (!get().mounted) return;
    takeTypeAhead();
    set({ mounted: false, open: false, afterClose: null });
    useOfficeStore.getState().setTyping(false);
    // Después de desmontar: el celular suelta el teclado del juego y recién ahí se puede sacar la foto.
    if (after) setTimeout(after, 0);
  },
  setPrefs: (p) => {
    set(p);
    const { skin, wallpaper, tone, alarm, snakeBest } = get();
    savePrefs({ skin, wallpaper, tone, alarm, snakeBest });
  },
  markRead: (ts) => set((s) => ({ readUntil: Math.max(s.readUntil, ts) })),
  buzz: () => set({ buzzAt: Date.now() }),
  setRinging: (ringing) => set({ ringing }),
}));

/**
 * ¿Tengo el celular en la mochila? Mientras la mochila no llega del servidor se deja sacar: el servidor
 * se lo da a todos al entrar y no se puede tirar (ver CELULAR_ITEM en bolsa.ts).
 */
export function tengoCelular(): boolean {
  const bag = useBagStore.getState();
  if (!bag.loaded) return true;
  return [...bag.slots, ...bag.overflow].some((s) => s?.itemId === CELULAR_ITEM);
}

/**
 * ¿Los avisos del chat van callados? (contador de sin leer, aviso de mensaje nuevo, tono y vibración).
 * Punto único para enchufar otras condiciones, p. ej. el modo foco (`selectFocusing`) cuando llegue.
 */
export function selectChatMuted(_s: ReturnType<typeof useOfficeStore.getState>): boolean {
  return false;
}

/** Mensajes de otras personas que llegaron después de lo último leído en el celular. */
export function useUnread(): number {
  const readUntil = usePhoneStore((s) => s.readUntil);
  return useOfficeStore((s) =>
    selectChatMuted(s) ? 0 : s.messages.reduce((n, m) => (m.fromId !== s.sessionId && m.ts > readUntil ? n + 1 : n), 0),
  );
}

// ---------- Teclas mientras el celular se descarga ----------

let typeAhead: KeyboardEvent[] | null = null;

function recordKey(e: KeyboardEvent) {
  if (!typeAhead || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.length !== 1 && !["Enter", "Backspace", "Escape"].includes(e.key)) return;
  e.preventDefault();
  if (typeAhead.length < 80) typeAhead.push(e);
}

function startTypeAhead() {
  if (typeAhead || typeof window === "undefined") return;
  typeAhead = [];
  window.addEventListener("keydown", recordKey, true);
}

/** Lo tecleado desde que se pidió el celular hasta que empezó a escuchar (y deja de guardar). */
export function takeTypeAhead(): KeyboardEvent[] {
  const keys = typeAhead ?? [];
  typeAhead = null;
  if (typeof window !== "undefined") window.removeEventListener("keydown", recordKey, true);
  return keys;
}
