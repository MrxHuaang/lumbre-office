// El Festival de cometas en el navegador (ver cometas.ts, cometa.ts y cometa-vuelo.ts de @hyvento/shared):
// lo que vuela y lo inscrito (sale de `state.cometas`), lo mío del festival, los pedidos (armar, comprar,
// inscribir, votar, bajar la cometa del techo) con sus respuestas y el vuelo: con la cometa en la mano, F
// en el voladero la suelta, y el minijuego corre aquí con el mismo simulador que repite la sala. Los botones
// (cuándo se jala y cuándo se da hilo) se mandan cada poquito, así la altura que ven los demás se pone al
// día y el récord es el de verdad. La capa del cielo está en cometasCielo.ts (usa Phaser).
import {
  ARMAR_ERROR_TEXT,
  COMETA_CONCURSO_ERROR_TEXT,
  COMETAS,
  COMETAS_BUY_ERROR_TEXT,
  COMETAS_MSG,
  CometaSim,
  TECHO_ERROR_TEXT,
  VOLAR_ERROR_TEXT,
  VUELO,
  VUELO_FIN_TEXT,
  VUELO_FRAME_MS,
  bagItemInfo,
  cometaCodeOf,
  cometaName,
  cometasActiva,
  cometasShopItem,
  objItemId,
  type ArmarResult,
  type CometaConcursoResult,
  type CometaInscritaView,
  type CometasBuyResult,
  type CometasMine,
  type CometaVueloView,
  type TechoResult,
  type VolarResult,
  type VueloEnd,
  type VueloStart,
} from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import { create } from "zustand";
import { getRoom, onInteract, type OfficeRoom } from "./network";
import { useOfficeStore } from "./store";

/** Mi vuelo en curso (lo que muestra el panel del minijuego). */
export interface MiVuelo {
  id: number;
  code: string;
  viento: number;
  altura: number;
  tension: number;
  rafaga: number;
  /** Segundos que quedan. */
  quedan: number;
  hold: boolean;
}

interface CometasStore {
  /** Lo que vuela, por sessionId de quien la sostiene. */
  vuelos: Record<string, CometaVueloView>;
  inscritas: Record<string, CometaInscritaView>;
  record: { altura: number; id: string; name: string };
  mine: CometasMine;
  vuelo: MiVuelo | null;
  /** La última respuesta de cada pedido (sueltan los botones del panel). */
  last: { kind: "armar" | "comprar" | "concurso" | "techo"; ok: boolean; seq: number } | null;
}

let seq = 0;

export const useCometasStore = create<CometasStore>(() => ({
  vuelos: {},
  inscritas: {},
  record: { altura: 0, id: "", name: "" },
  mine: { voto: null, techo: false },
  vuelo: null,
  last: null,
}));

/** ¿Está abierto el festival? */
export const cometasNow = () => {
  const f = useOfficeStore.getState().festival;
  return cometasActiva(f.id, f.fase);
};

/** La cometa que llevo en la mano (su código), o null. */
export function heldCometa(): string | null {
  const s = useOfficeStore.getState();
  const held = s.sessionId ? s.players[s.sessionId]?.held : "";
  return held ? cometaCodeOf(held) : null;
}

export const sendCometaArmar = (code: string) => getRoom()?.send(COMETAS_MSG.armar, { code });
export const sendCometasComprar = (item: string) => getRoom()?.send(COMETAS_MSG.comprar, { item });
export const sendCometaInscribir = () => getRoom()?.send(COMETAS_MSG.inscribir, {});
export const sendCometaVotar = (owner: string) => getRoom()?.send(COMETAS_MSG.votar, { owner });

// ---------- El vuelo ----------

interface Flight {
  start: VueloStart;
  sim: CometaSim;
  t0: number;
  toggles: number[];
  sent: number;
  sentAt: number;
  hold: boolean;
  /** Lo que se usó en el último cuadro (para saber cuándo cambió). */
  stepped: boolean;
  raf: number;
  over: boolean;
}

let flight: Flight | null = null;
/** Los dedos o el mouse que están jalando (y las teclas): se jala mientras haya alguno. */
const pulling = new Set<string>();

/** ¿Tengo una cometa en el aire? (la escena no deja caminar). */
export const cometaVolando = () => Boolean(flight && !flight.over);

/** Jalar (true) o dar hilo (false) desde el panel o el teclado. */
export function jalar(on: boolean, who = "boton") {
  if (on) pulling.add(who);
  else pulling.delete(who);
  if (flight) flight.hold = pulling.size > 0;
}

/** F con la cometa en la mano: la suelta en el voladero (o la recoge si ya vuela). Devuelve si la usó. */
export function volarConF(): boolean {
  if (flight && !flight.over) {
    recogerCometa();
    return true;
  }
  if (!heldCometa()) return false;
  getRoom()?.send(COMETAS_MSG.volar, {});
  return true;
}

/** Manda los botones pendientes (`fin`: recoger). */
function sendPaso(f: Flight, fin: boolean) {
  const toggles = f.toggles.slice(f.sent);
  f.sent = f.toggles.length;
  f.sentAt = performance.now();
  getRoom()?.send(fin ? COMETAS_MSG.recoger : COMETAS_MSG.paso, { id: f.start.id, toggles, frames: f.sim.frame });
}

/** Recoge la cometa con lo que subió. */
export function recogerCometa() {
  const f = flight;
  if (!f || f.over) return;
  f.over = true;
  cancelAnimationFrame(f.raf);
  sendPaso(f, true);
}

function onKey(e: KeyboardEvent) {
  if (!flight || flight.over) return;
  if (e.code === "Space" || e.code === "KeyF") {
    e.preventDefault();
    jalar(e.type === "keydown", e.code);
  } else if (e.code === "Escape" && e.type === "keydown") recogerCometa();
}

function startFlight(start: VueloStart) {
  stopFlight();
  pulling.clear();
  const f: Flight = {
    start,
    sim: new CometaSim({ seed: start.seed, viento: start.viento, code: start.code }),
    t0: performance.now(),
    toggles: [],
    sent: 0,
    sentAt: performance.now(),
    hold: false,
    stepped: false,
    raf: 0,
    over: false,
  };
  flight = f;
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  const loop = () => {
    if (flight !== f || f.over) return;
    // Los cuadros que tocan por el reloj (nunca más rápido que eso: la sala lo revisa).
    const target = Math.min(VUELO.maxFrames, Math.floor((performance.now() - f.t0) / VUELO_FRAME_MS));
    while (f.sim.frame < target && !f.sim.done) {
      if (f.hold !== f.stepped) {
        f.toggles.push(f.sim.frame);
        f.stepped = f.hold;
      }
      f.sim.step(f.stepped);
    }
    useCometasStore.setState({
      vuelo: {
        id: start.id,
        code: start.code,
        viento: start.viento,
        altura: f.sim.altura,
        tension: f.sim.tension,
        rafaga: f.sim.rafaga,
        quedan: Math.max(0, (VUELO.maxFrames - f.sim.frame) * VUELO_FRAME_MS) / 1000,
        hold: f.hold,
      },
    });
    if (f.sim.done) {
      // Se acabó solo (rota, caída o el tiempo): la sala lo repite y contesta.
      f.over = true;
      sendPaso(f, false);
      return;
    }
    if (performance.now() - f.sentAt >= COMETAS.pasoMs) sendPaso(f, false);
    f.raf = requestAnimationFrame(loop);
  };
  f.raf = requestAnimationFrame(loop);
}

function stopFlight() {
  if (flight) cancelAnimationFrame(flight.raf);
  flight = null;
  pulling.clear();
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("keyup", onKey);
  useCometasStore.setState({ vuelo: null });
}

// ---------- El estado y las respuestas ----------

const done = (kind: NonNullable<CometasStore["last"]>["kind"], ok: boolean) => useCometasStore.setState({ last: { kind, ok, seq: ++seq } });

/** Engancha el estado del festival y las respuestas (en cada conexión), y la E del techo del garaje. */
export function bindCometas(r: OfficeRoom) {
  stopFlight();
  const $ = getStateCallbacks(r);
  type Remote = {
    vuelos: Map<string, CometaVueloView>;
    inscritas: Map<string, CometaInscritaView>;
    recordAltura: number;
    recordId: string;
    recordName: string;
  };
  const push = () => {
    const c = (r.state as unknown as { cometas?: Remote }).cometas;
    if (!c) return;
    const vuelos: Record<string, CometaVueloView> = {};
    c.vuelos.forEach((v, k) => (vuelos[k] = { userId: v.userId, name: v.name, code: v.code, altura: v.altura, tenso: v.tenso }));
    const inscritas: Record<string, CometaInscritaView> = {};
    c.inscritas.forEach((e, k) => (inscritas[k] = { ownerId: e.ownerId, ownerName: e.ownerName, code: e.code, votes: e.votes }));
    useCometasStore.setState({ vuelos, inscritas, record: { altura: c.recordAltura, id: c.recordId, name: c.recordName } });
  };
  type Coll = { onAdd(cb: (e: unknown) => void): () => void; onRemove(cb: () => void): () => void };
  ($(r.state) as unknown as { listen(field: string, cb: (v: Remote | undefined) => void): () => void }).listen("cometas", (c) => {
    if (!c) return;
    const c$ = $(c as never) as unknown as { onChange(cb: () => void): () => void; vuelos: Coll; inscritas: Coll };
    c$.onChange(push);
    for (const coll of [c$.vuelos, c$.inscritas]) {
      coll.onAdd((e) => {
        ($(e as never) as unknown as { onChange(cb: () => void): () => void }).onChange(push);
        push();
      });
      coll.onRemove(push);
    }
    push();
  });

  const notify = (text: string, tone: "info" | "success" | "warning") => useOfficeStore.getState().notify(text, tone);
  r.onMessage(COMETAS_MSG.mine, (m: CometasMine) => useCometasStore.setState({ mine: m }));
  r.onMessage(COMETAS_MSG.armarResult, (res: ArmarResult) => {
    done("armar", res.ok);
    if (res.ok) notify(`${cometaName(res.code)}: quedó en tu mano. Vuélala con F en el voladero de la loma.`, "success");
    else notify(ARMAR_ERROR_TEXT[res.error], "warning");
  });
  r.onMessage(COMETAS_MSG.comprarResult, (res: CometasBuyResult) => {
    done("comprar", res.ok);
    if (res.ok) notify(`${cometasShopItem(res.item)?.name ?? bagItemInfo(objItemId(res.item)).name} a la mochila.`, "success");
    else notify(COMETAS_BUY_ERROR_TEXT[res.error], "warning");
  });
  r.onMessage(COMETAS_MSG.concursoResult, (res: CometaConcursoResult) => {
    done("concurso", res.ok);
    if (res.ok) notify(res.accion === "inscribir" ? "Tu cometa quedó inscrita en el concurso. ¡Que voten!" : "Voto contado. Al cierre se sabe cuál gana.", "success");
    else notify(COMETA_CONCURSO_ERROR_TEXT[res.error], res.error === "votaste" ? "info" : "warning");
  });
  r.onMessage(COMETAS_MSG.techoResult, (res: TechoResult) => {
    done("techo", res.ok);
    if (res.ok) notify("Bajaste la cometa del techo del garaje. Santiago la anda buscando en la loma.", "success");
    else notify(TECHO_ERROR_TEXT[res.error], res.error === "ya" ? "info" : "warning");
  });
  r.onMessage(COMETAS_MSG.vuelo, (res: VolarResult) => {
    if (res.ok) startFlight(res);
    else notify(VOLAR_ERROR_TEXT[res.error], "warning");
  });
  r.onMessage(COMETAS_MSG.fin, (end: VueloEnd) => {
    if (flight && flight.start.id !== end.id) return;
    stopFlight();
    const subio = end.altura > 0 ? ` Subió a ${end.altura} metros.` : "";
    notify(`${VUELO_FIN_TEXT[end.motivo]}${subio}${end.record ? " ¡Es el récord del día!" : ""}`, end.altura > 0 ? "success" : "info");
  });
}

if (typeof window !== "undefined") {
  // E junto a la escalera del garaje: bajar la cometa de Santiago (sin panel).
  onInteract("cometaTecho", () => void getRoom()?.send(COMETAS_MSG.techo, {}));
  // Si se va el festival con la cometa en el aire, se recoge.
  useOfficeStore.subscribe((s, prev) => {
    if (s.festival.id !== prev.festival.id && flight) recogerCometa();
  });
}
