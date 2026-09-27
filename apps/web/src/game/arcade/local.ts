// La máquina del arcade que tiene delante el jugador local (según su posición en el estado de la sala).
import { getRoom } from "@/game/network";
import { useOfficeStore } from "@/game/store";
import { machineAt } from "./games";

export function localMachine(): number | null {
  const sessionId = useOfficeStore.getState().sessionId;
  const me = sessionId ? getRoom()?.state.players.get(sessionId) : undefined;
  return me && me.area === "sotano" ? machineAt(me.x, me.y) : null;
}
