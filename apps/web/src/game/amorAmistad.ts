// Amor y amistad en el navegador (las reglas las decide el servidor, rooms/amorAmistad.ts): lo mío del
// amigo secreto (el panel del cofre), los pedidos (anotarse, regalar, escribir, pedir serenata, comprar) y
// lo que llega: el detalle anónimo, Cupido que trae una carta (corre hasta uno y abre la tira con la
// carta), la serenata (el trío llega donde está quien la recibe y toca, con su música) y la revelación del
// cierre. También dice si una foto lleva el marco de corazones (sacada junto a la banca de los enamorados).
import { BANCA_ENAMORADOS } from "@hyvento/map";
import { drawCharacter, FRAME, styleFor } from "@hyvento/map/art";
import {
  AMOR,
  AMOR_CINE,
  AMOR_ERROR_TEXT,
  AMOR_MSG,
  CUPIDO,
  amorActivo,
  amorShopItem,
  bagItemName,
  cupidoSeVa,
  revelacionCine,
  serenataCine,
  type AmorEstado,
  type AmorResultado,
  type CartaLlega,
  type Look,
  type RegaloLlego,
  type Revelacion,
  type SerenataEvento,
} from "@hyvento/shared";
import { create } from "zustand";
import { playCinematic, playCineDef } from "./cinematicas/puerta";
import { abrirDialogo } from "./dialogo";
import { pararSerenata, tocarSerenata, volumenSerenata } from "./amorMusica";
import { toHtmlCanvas } from "./iso/canvas";
import { getRoom, onInteract, type OfficeRoom } from "./network";
import { selectMyUserId, useOfficeStore } from "./store";

const VACIO: AmorEstado = { festival: false, anotado: false, sorteado: false, anotados: 0, amigos: [], regalosDados: 0, cartasEnviadas: 0, recibidos: [], serenataHasta: 0 };

interface AmorStore {
  estado: AmorEstado;
  /** La última respuesta de cada pedido (sueltan los botones del panel). */
  last: { accion: AmorResultado["accion"]; ok: boolean; seq: number } | null;
}

let seq = 0;
export const useAmorStore = create<AmorStore>(() => ({ estado: VACIO, last: null }));

/** ¿Está abierta la fiesta ahora? */
export const amorAhora = () => {
  const f = useOfficeStore.getState().festival;
  return amorActivo(f.id, f.fase);
};

export const sendAnotar = () => getRoom()?.send(AMOR_MSG.anotar, {});
export const sendRegalo = (para: string, item: string, nota: string) => getRoom()?.send(AMOR_MSG.regalo, { para, item, nota });
export const sendCarta = (para: string, texto: string) => getRoom()?.send(AMOR_MSG.carta, { para, texto });
export const sendSerenata = (para: string, propina: number, anonima: boolean) => getRoom()?.send(AMOR_MSG.serenata, { para, propina, anonima });
export const sendAmorCompra = (item: string) => getRoom()?.send(AMOR_MSG.comprar, { item });
export const pedirEstadoAmor = () => getRoom()?.send(AMOR_MSG.pedirEstado, {});

/** Dónde estoy (px de mundo) y en qué nivel. */
function yo(): { area: string; x: number; y: number } | null {
  const s = useOfficeStore.getState();
  const me = s.sessionId ? getRoom()?.state.players.get(s.sessionId) : undefined;
  return me ? { area: me.area, x: me.x, y: me.y } : null;
}

/** Cuántos tiles de la banca de los enamorados cuentan para el marco de la foto. */
const MARCO_TILES = 4;

/** ¿La foto que se saca ahí lleva el marco de corazones? (en el jardín, en la fiesta, junto a la banca). */
export function marcoDeFoto(area: string, x: number, y: number, tileSize = 32): "enamorados" | undefined {
  if (area !== "jardin" || !amorAhora()) return undefined;
  const cx = (BANCA_ENAMORADOS.x + 1) * tileSize;
  const cy = (BANCA_ENAMORADOS.y + 0.5) * tileSize;
  return Math.hypot(x - cx, y - cy) <= MARCO_TILES * tileSize ? "enamorados" : undefined;
}

// ---------- El retrato de Cupido (sin Phaser: sale de su hoja dibujada) ----------

const retratos = new Map<string, string>();
function retratoDe(look: Look): string | null {
  const key = JSON.stringify(look);
  const hecho = retratos.get(key);
  if (hecho) return hecho;
  if (typeof document === "undefined") return null;
  const sheet = toHtmlCanvas(drawCharacter(styleFor("ada", look)));
  const x = Math.round(FRAME * 0.2);
  const y = Math.round(FRAME * 0.22);
  const size = Math.round(FRAME * 0.6);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  // La fila de arriba mira de frente; el cuadro del medio está quieto.
  ctx.drawImage(sheet, FRAME + x, y, size, size, 0, 0, size, size);
  const url = c.toDataURL();
  retratos.set(key, url);
  return url;
}

// ---------- Lo que llega ----------

/** Cupido llega corriendo con la carta y la lee en la tira; al cerrarla, se despide y se va. */
async function entregarCarta(carta: CartaLlega) {
  await playCinematic(AMOR_CINE.cupido);
  abrirDialogo({
    quien: `${CUPIDO.id}:${carta.id}`,
    nombre: CUPIDO.nombre,
    rol: "Carta anónima",
    retrato: retratoDe(CUPIDO.look),
    voz: 0.6,
    lineas: ["¡Correo del corazón! Alguien le mandó esto, sin firma:", `«${carta.texto}»`, "Yo no sé quién fue. Y si supiera, tampoco le diría."],
    alCerrar: () => void playCineDef(cupidoSeVa()),
  });
}

/** La serenata: si estoy en ese nivel, veo al trío llegar y tocar (y la oigo más fuerte cerca). */
let serenataTimer: number | null = null;
function serenata(ev: SerenataEvento) {
  const me = yo();
  const myId = selectMyUserId(useOfficeStore.getState());
  const paraMi = ev.paraId === myId;
  if (paraMi) useOfficeStore.getState().notify(ev.de ? `¡${ev.de} le mandó una serenata!` : "¡Alguien le mandó una serenata!", "success");
  if (!me || me.area !== ev.area) return;
  void playCineDef(serenataCine({ x: ev.x, y: ev.y }, { para: ev.para, de: ev.de, paraMi }));
  const vol = () => {
    const m = yo();
    if (!m || m.area !== ev.area) return 0;
    const d = Math.hypot(m.x / 32 - ev.x, m.y / 32 - ev.y);
    return Math.max(0, Math.min(0.9, 1.1 - d / 18));
  };
  tocarSerenata(vol());
  if (serenataTimer !== null) window.clearInterval(serenataTimer);
  const hasta = Date.now() + ev.ms + 2000;
  serenataTimer = window.setInterval(() => {
    if (Date.now() > hasta) {
      window.clearInterval(serenataTimer!);
      serenataTimer = null;
      return;
    }
    const v = vol();
    if (v <= 0) pararSerenata();
    else volumenSerenata(v);
  }, 500);
}

const NOTIFY_OK: Record<AmorResultado["accion"], (r: Extract<AmorResultado, { ok: true }>) => string> = {
  anotar: () => "Quedó anotado al amigo secreto. A las 10:00 se sortea.",
  regalo: (r) => `${r.item ? bagItemName(r.item) : "El detalle"} ya va para su amigo secreto. Sin firma, como debe ser.`,
  carta: () => "Cupido ya tiene su carta. Se la lleva en persona.",
  serenata: () => "El trío ya va en camino con su serenata.",
  comprar: (r) => `${amorShopItem(r.item ?? "")?.name ?? "La compra"} a la mochila.`,
};

/** Engancha los mensajes de Amor y amistad (en cada conexión) y la E del cofre y del trío. */
export function bindAmor(r: OfficeRoom) {
  const notify = (text: string, tone: "info" | "success" | "warning") => useOfficeStore.getState().notify(text, tone);
  r.onMessage(AMOR_MSG.estado, (e: AmorEstado) => useAmorStore.setState({ estado: e }));
  r.onMessage(AMOR_MSG.resultado, (res: AmorResultado) => {
    useAmorStore.setState({ last: { accion: res.accion, ok: res.ok, seq: ++seq } });
    if (res.ok) notify(NOTIFY_OK[res.accion](res), "success");
    else notify(AMOR_ERROR_TEXT[res.error], res.error === "anotado" ? "info" : "warning");
  });
  r.onMessage(AMOR_MSG.regaloLlego, (g: RegaloLlego) => notify(`Su amigo secreto le dejó: ${bagItemName(g.item)}${g.nota ? `. «${g.nota}»` : "."}`, "success"));
  r.onMessage(AMOR_MSG.cupido, (c: CartaLlega) => void entregarCarta(c));
  r.onMessage(AMOR_MSG.serenataEvento, (ev: SerenataEvento) => serenata(ev));
  r.onMessage(AMOR_MSG.revelacion, (rev: Revelacion) => {
    const myId = selectMyUserId(useOfficeStore.getState());
    void playCineDef(revelacionCine(rev.pares, myId));
    const mio = rev.pares.filter((p) => p.paraId === myId).map((p) => p.de);
    if (mio.length) notify(`Su amigo secreto era ${mio.join(" y ")}.`, "success");
  });
  onInteract("amorCofre", () => {
    pedirEstadoAmor();
    useOfficeStore.getState().openPanel("amorCofre", true);
  });
  onInteract("amorSerenata", () => {
    pedirEstadoAmor();
    useOfficeStore.getState().openPanel("amorSerenata", true);
  });
}

/** Las personas conectadas (para elegir a quién mandarle una carta o una serenata), sin mí. */
export function genteConectada(): { userId: string; name: string }[] {
  const s = useOfficeStore.getState();
  const me = selectMyUserId(s);
  const seen = new Map<string, string>();
  for (const p of Object.values(s.players)) if (p.userId !== me && !seen.has(p.userId)) seen.set(p.userId, p.name);
  return [...seen].map(([userId, name]) => ({ userId, name })).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export { AMOR };
