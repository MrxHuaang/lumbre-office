// La Feria de la cosecha en el navegador (ver cosecha.ts de @hyvento/shared y rooms/cosecha.ts del
// servidor): lo que publica la sala en `state.cosecha` (la olla, las ahuyamas del concurso, las boletas y los
// ganadores), lo mío de esta feria, los pedidos (vender, comprar, aportar, pesar, boleta) con sus respuestas
// y la E de los puestos del mercado (cada puesto abre su panel), y el baile del patio (si va, si estoy en la
// pista y cómo voy). Todo lo decide el servidor.
import { INTERACT_REACH_TILES, pointsOfType, puestoDePunto, type OfficeMap } from "@hyvento/map";
import {
  APORTAR_ERROR_TEXT,
  BOLETA_ERROR_TEXT,
  COMPRAR_ERROR_TEXT,
  COSECHA_MSG,
  COSECHA_PUESTOS,
  PESAR_ERROR_TEXT,
  VENDER_ERROR_TEXT,
  ahuyamaDagOf,
  bagItemInfo,
  cosechaActiva,
  objItemId,
  pesoTexto,
  puestoById,
  type AportarResult,
  type BaileProgreso,
  type BoletaResult,
  type ComprarResult,
  type CosechaMine,
  type OllaFase,
  type PesarResult,
  type SancochoServido,
  type VenderResult,
} from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import { create } from "zustand";
import { getRoom, onInteract, sendEmote, type OfficeRoom } from "./network";
import { useOfficeStore } from "./store";

export interface AhuyamaView {
  userId: string;
  name: string;
  dag: number;
  at: number;
}

interface CosechaStore {
  olla: number;
  ollaFase: OllaFase;
  hierveDesde: number;
  /** Lo que lleva la olla: ingrediente → unidades. */
  aportado: Record<string, number>;
  ahuyamas: AhuyamaView[];
  boletas: number;
  ganadorAhuyama: string;
  ganadorDag: number;
  ganadorTombola: string;
  /** Va el baile del patio (lo dice el servidor) y si estoy en la pista (lo mira la escena). */
  baile: boolean;
  enPista: boolean;
  /** El último paso que contó (para el chip: "en pareja"). */
  pareja: boolean;
  mine: CosechaMine;
  /** El puesto que se abrió con E (el panel muestra ese). */
  puesto: string;
  /** La última respuesta de cada pedido (sueltan los botones del panel). */
  last: { kind: "vender" | "comprar" | "aportar" | "pesar" | "boleta"; ok: boolean; seq: number } | null;
}

let seq = 0;

export const useCosechaStore = create<CosechaStore>(() => ({
  olla: 1,
  ollaFase: "llenando",
  hierveDesde: 0,
  aportado: {},
  ahuyamas: [],
  boletas: 0,
  ganadorAhuyama: "",
  ganadorDag: 0,
  ganadorTombola: "",
  baile: false,
  enPista: false,
  pareja: false,
  mine: { vendido: 0, boletas: 0, dag: 0, pasos: 0, bailado: false },
  puesto: COSECHA_PUESTOS[0]!.id,
  last: null,
}));

/** ¿Está abierta la feria ahora? */
export const cosechaNow = () => {
  const f = useOfficeStore.getState().festival;
  return cosechaActiva(f.id, f.fase);
};

export const sendVender = (puesto: string, item: string, n: number) => getRoom()?.send(COSECHA_MSG.vender, { puesto, item, n });
export const sendComprar = (puesto: string, item: string) => getRoom()?.send(COSECHA_MSG.comprar, { puesto, item });
export const sendAportar = (item: string, n: number) => getRoom()?.send(COSECHA_MSG.aportar, { item, n });
export const sendPesar = () => getRoom()?.send(COSECHA_MSG.pesar, {});
export const sendBoleta = () => getRoom()?.send(COSECHA_MSG.boleta, {});
/** Un paso del baile: el emote "Bailar" (el servidor cuenta los de la pista del patio). */
export const bailarBambuco = () => sendEmote("dance");

/** El nivel que se ve (lo pone la escena con la capa de la olla, cosechaOlla.ts). */
let currentMap: OfficeMap | null = null;
export function setCosechaMap(map: OfficeMap) {
  currentMap = map;
}

/** El puesto del mercado más cercano a mí (al alcance de su punto), o null. */
function nearestPuesto(): string | null {
  const room = getRoom();
  const s = useOfficeStore.getState();
  const me = s.sessionId ? room?.state.players.get(s.sessionId) : undefined;
  const map = currentMap;
  if (!me || !map) return null;
  const reach = (INTERACT_REACH_TILES + 0.5) * map.tileSize;
  let best: { id: string; d: number } | null = null;
  for (const p of pointsOfType(map, "cosecha_puesto")) {
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    const id = puestoDePunto(p);
    if (id && d <= reach && (!best || d < best.d)) best = { id, d };
  }
  return best?.id ?? null;
}

/** Abre el panel de un puesto (desde su punto o desde quien lo atiende). */
export function abrirPuesto(puesto: string) {
  useCosechaStore.setState({ puesto });
  useOfficeStore.getState().openPanel("cosechaPuesto", true);
}

const done = (kind: NonNullable<CosechaStore["last"]>["kind"], ok: boolean) => useCosechaStore.setState({ last: { kind, ok, seq: ++seq } });

const nombre = (item: string) => bagItemInfo(objItemId(item)).name;

/** Engancha el estado de la feria y las respuestas (en cada conexión), y la E de los puestos. */
export function bindCosecha(r: OfficeRoom) {
  const $ = getStateCallbacks(r);
  type Remote = {
    olla: number;
    ollaFase: string;
    hierveDesde: number;
    aportado: Map<string, number>;
    ahuyamas: Map<string, AhuyamaView>;
    boletas: number;
    ganadorAhuyama: string;
    ganadorDag: number;
    ganadorTombola: string;
    baile: boolean;
  };
  const push = () => {
    const c = (r.state as unknown as { cosecha?: Remote }).cosecha;
    if (!c) return;
    const aportado: Record<string, number> = {};
    c.aportado.forEach((n, k) => (aportado[k] = n));
    const ahuyamas: AhuyamaView[] = [];
    c.ahuyamas.forEach((e) => ahuyamas.push({ userId: e.userId, name: e.name, dag: e.dag, at: e.at }));
    useCosechaStore.setState({
      olla: c.olla,
      ollaFase: c.ollaFase as OllaFase,
      hierveDesde: c.hierveDesde,
      aportado,
      ahuyamas,
      boletas: c.boletas,
      ganadorAhuyama: c.ganadorAhuyama,
      ganadorDag: c.ganadorDag,
      ganadorTombola: c.ganadorTombola,
      baile: Boolean(c.baile),
    });
  };
  ($(r.state) as unknown as { listen(field: string, cb: (v: Remote | undefined) => void): () => void }).listen("cosecha", (c) => {
    if (!c) return;
    const c$ = $(c as never) as unknown as {
      onChange(cb: () => void): () => void;
      aportado: { onAdd(cb: () => void): () => void; onRemove(cb: () => void): () => void; onChange(cb: () => void): () => void };
      ahuyamas: { onAdd(cb: (e: unknown) => void): () => void; onRemove(cb: () => void): () => void };
    };
    c$.onChange(push);
    c$.aportado.onAdd(push);
    c$.aportado.onRemove(push);
    c$.aportado.onChange(push);
    c$.ahuyamas.onAdd((e) => {
      ($(e as never) as unknown as { onChange(cb: () => void): () => void }).onChange(push);
      push();
    });
    c$.ahuyamas.onRemove(push);
    push();
  });

  onInteract("cosechaPuesto", () => abrirPuesto(nearestPuesto() ?? useCosechaStore.getState().puesto));

  const notify = (text: string, tone: "info" | "success" | "warning") => useOfficeStore.getState().notify(text, tone);
  r.onMessage(COSECHA_MSG.mine, (m: CosechaMine) => useCosechaStore.setState({ mine: m }));
  r.onMessage(COSECHA_MSG.venderResult, (res: VenderResult) => {
    done("vender", res.ok);
    if (res.ok) notify(`Vendió ${res.n} de ${nombre(res.item).toLowerCase()}: +${res.puntos} puntos.`, "success");
    else notify(VENDER_ERROR_TEXT[res.error], "warning");
  });
  r.onMessage(COSECHA_MSG.comprarResult, (res: ComprarResult) => {
    done("comprar", res.ok);
    const v = puestoById(res.puesto)?.vende.find((x) => x.id === res.item);
    if (res.ok) notify(`${v?.name ?? "Lo que compró"} a la mochila.`, "success");
    else notify(COMPRAR_ERROR_TEXT[res.error], "warning");
  });
  r.onMessage(COSECHA_MSG.aportarResult, (res: AportarResult) => {
    done("aportar", res.ok);
    if (res.ok) notify(res.llena ? "¡La olla está llena! Ya hierve: quédese cerca para el plato." : `Echó ${res.n} de ${nombre(res.item).toLowerCase()} a la olla.`, "success");
    else notify(APORTAR_ERROR_TEXT[res.error], "warning");
  });
  r.onMessage(COSECHA_MSG.pesarResult, (res: PesarResult) => {
    done("pesar", res.ok);
    if (res.ok) notify(`La báscula marca ${pesoTexto(res.dag)}: va de ${res.puesto} en el concurso.${res.devuelta ? " La de antes volvió a la mochila." : ""}`, "success");
    else notify(PESAR_ERROR_TEXT[res.error], res.error === "menos" ? "info" : "warning");
  });
  r.onMessage(COSECHA_MSG.boletaResult, (res: BoletaResult) => {
    done("boleta", res.ok);
    if (res.ok) notify(`Boleta ${res.n} de la tómbola. ¡Suerte en el sorteo del cierre!`, "success");
    else notify(BOLETA_ERROR_TEXT[res.error], res.error === "max" ? "info" : "warning");
  });
  r.onMessage(COSECHA_MSG.baile, (b: BaileProgreso) => {
    const { mine } = useCosechaStore.getState();
    useCosechaStore.setState({ pareja: b.pareja, mine: { ...mine, pasos: b.pasos, bailado: b.pasos >= b.meta } });
    if (b.pasos >= b.meta)
      notify(
        b.premio ? `¡Bailó el bambuco de la cosecha! Doña Rubiela aplaude: +${b.premio} puntos.` : "¡Bailó el bambuco de la cosecha! Doña Rubiela aplaude desde la olla.",
        "success",
      );
  });
  r.onMessage(COSECHA_MSG.servido, (s: SancochoServido) =>
    notify(s.plato ? "Doña Rubiela le sirvió un plato de sancocho: está en la mochila. Cómaselo con F y le da energía para un buen rato." : "Le iban a servir sancocho, pero la mochila está llena.", s.plato ? "success" : "warning"),
  );
  r.send(COSECHA_MSG.mine, {});
}

/** El peso de la ahuyama que llevo en la mano (o null). */
export function heldAhuyama(): number | null {
  const s = useOfficeStore.getState();
  const held = s.sessionId ? s.players[s.sessionId]?.held : "";
  return held ? ahuyamaDagOf(held) : null;
}
