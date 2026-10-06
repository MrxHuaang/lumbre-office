// La Feria de las flores en el navegador (ver feria-flores.ts de @hyvento/shared): lo exhibido en el patio
// de la feria (sale de `state.feria`), mi voto, los pedidos (armar, exhibir, votar, comprar) con sus
// respuestas, el aviso del desfile y la capa que pone cada silleta exhibida encima de su exhibidor, para
// todos (esa capa está en feriaSilletas.ts, que usa Phaser). Todo lo decide el servidor; aquí solo se pide
// y se muestra.
import { INTERACT_REACH_TILES, pointsOfType, standOfPoint, type OfficeMap } from "@hyvento/map";
import {
  BUILD_ERROR_TEXT,
  EXHIBIT_ERROR_TEXT,
  FERIA_BUY_ERROR_TEXT,
  FERIA_MSG,
  VOTE_ERROR_TEXT,
  feriaActiva,
  feriaShopItem,
  silletaCodeOf,
  silletaName,
  standKey,
  type BuildResult,
  type ExhibitResult,
  type FeriaBuyResult,
  type FeriaMine,
  type SilletaExhibitView,
  type VoteResult,
} from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import { create } from "zustand";
import { getRoom, onInteract, type OfficeRoom } from "./network";
import { useOfficeStore } from "./store";

interface FeriaStore {
  /** Lo exhibido, por exhibidor ("x,y" del mueble). */
  exhibits: Record<string, SilletaExhibitView>;
  winner: { id: string; name: string; votes: number };
  mine: FeriaMine;
  /** El exhibidor que se abrió con E (el panel muestra ese). */
  stand: string | null;
  /** La última respuesta de cada pedido (sueltan los botones del panel). */
  last: { kind: "build" | "exhibit" | "vote" | "buy"; ok: boolean; seq: number } | null;
}

let seq = 0;

export const useFeriaStore = create<FeriaStore>(() => ({
  exhibits: {},
  winner: { id: "", name: "", votes: 0 },
  mine: { voted: false, stand: null },
  stand: null,
  last: null,
}));

/** ¿Está abierta la feria ahora? */
export const feriaNow = () => {
  const f = useOfficeStore.getState().festival;
  return feriaActiva(f.id, f.fase);
};

/** La silleta que llevo en la mano (su código), o null. */
export function heldSilleta(): string | null {
  const s = useOfficeStore.getState();
  const held = s.sessionId ? s.players[s.sessionId]?.held : "";
  return held ? silletaCodeOf(held) : null;
}

export const sendSilletaBuild = (code: string) => getRoom()?.send(FERIA_MSG.build, { code });
export const sendSilletaExhibit = (stand: string) => getRoom()?.send(FERIA_MSG.exhibit, { stand });
export const sendSilletaVote = (stand: string) => getRoom()?.send(FERIA_MSG.vote, { stand });
export const sendFeriaBuy = (item: string) => getRoom()?.send(FERIA_MSG.buy, { item });

/** El exhibidor más cercano a mí (al alcance de su punto), o null. */
function nearestStand(): string | null {
  const room = getRoom();
  const s = useOfficeStore.getState();
  const me = s.sessionId ? room?.state.players.get(s.sessionId) : undefined;
  const map = currentMap;
  if (!me || !map) return null;
  const reach = (INTERACT_REACH_TILES + 0.5) * map.tileSize;
  let best: { key: string; d: number } | null = null;
  for (const p of pointsOfType(map, "silleta_stand")) {
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    const st = standOfPoint(p);
    if (d <= reach && (!best || d < best.d)) best = { key: standKey(st.x, st.y), d };
  }
  return best?.key ?? null;
}

/** El nivel que se ve (lo pone la escena con la capa de las silletas, feriaSilletas.ts). */
let currentMap: OfficeMap | null = null;
export function setFeriaMap(map: OfficeMap) {
  currentMap = map;
}

const done = (kind: NonNullable<FeriaStore["last"]>["kind"], ok: boolean) => useFeriaStore.setState({ last: { kind, ok, seq: ++seq } });

/** Engancha el estado de la feria y las respuestas (en cada conexión), y la E de los exhibidores. */
export function bindFeria(r: OfficeRoom) {
  const $ = getStateCallbacks(r);
  type Remote = { exhibits: Map<string, SilletaExhibitView>; winnerId: string; winnerName: string; winnerVotes: number };
  const push = () => {
    const f = (r.state as unknown as { feria?: Remote }).feria;
    if (!f) return;
    const exhibits: Record<string, SilletaExhibitView> = {};
    f.exhibits.forEach((e, key) => (exhibits[key] = { stand: e.stand, ownerId: e.ownerId, ownerName: e.ownerName, code: e.code, votes: e.votes }));
    useFeriaStore.setState({ exhibits, winner: { id: f.winnerId, name: f.winnerName, votes: f.winnerVotes } });
  };
  ($(r.state) as unknown as { listen(field: string, cb: (v: Remote | undefined) => void): () => void }).listen("feria", (f) => {
    if (!f) return;
    const f$ = $(f as never) as unknown as {
      onChange(cb: () => void): () => void;
      exhibits: { onAdd(cb: (e: unknown) => void): () => void; onRemove(cb: () => void): () => void };
    };
    f$.onChange(push);
    f$.exhibits.onAdd((e) => {
      ($(e as never) as unknown as { onChange(cb: () => void): () => void }).onChange(push);
      push();
    });
    f$.exhibits.onRemove(push);
    push();
  });

  // E junto a un exhibidor: el panel de ese exhibidor (exhibir la mía o votar).
  onInteract("silletaStand", () => {
    useFeriaStore.setState({ stand: nearestStand() });
    useOfficeStore.getState().openPanel("silletaStand", true);
  });

  const notify = (text: string, tone: "info" | "success" | "warning") => useOfficeStore.getState().notify(text, tone);
  r.onMessage(FERIA_MSG.mine, (m: FeriaMine) => useFeriaStore.setState({ mine: m }));
  r.onMessage(FERIA_MSG.buildResult, (res: BuildResult) => {
    done("build", res.ok);
    if (res.ok) notify(`${silletaName(res.code)}: quedó en tu mano. Exhíbela en el patio de la feria.`, "success");
    else notify(BUILD_ERROR_TEXT[res.error], "warning");
  });
  r.onMessage(FERIA_MSG.exhibitResult, (res: ExhibitResult) => {
    done("exhibit", res.ok);
    if (res.ok) notify("Tu silleta quedó exhibida. ¡Que voten!", "success");
    else notify(EXHIBIT_ERROR_TEXT[res.error], "warning");
  });
  r.onMessage(FERIA_MSG.voteResult, (res: VoteResult) => {
    done("vote", res.ok);
    if (res.ok) notify("Voto contado. Al cierre se sabe cuál gana.", "success");
    else notify(VOTE_ERROR_TEXT[res.error], res.error === "voted" ? "info" : "warning");
  });
  r.onMessage(FERIA_MSG.buyResult, (res: FeriaBuyResult) => {
    done("buy", res.ok);
    if (res.ok) notify(`${feriaShopItem(res.item)?.name ?? "Las semillas"} a la mochila. Siémbralas en el huerto.`, "success");
    else notify(FERIA_BUY_ERROR_TEXT[res.error], "warning");
  });
  r.onMessage(FERIA_MSG.desfile, () => notify("¡El desfile de silleteros está pasando por el jardín!", "info"));
}
