"use client";

// El texto del aviso "E" junto a una máquina del arcade: dice si se puede jugar o si está rota. Se mira
// cada tanto porque caminar de una máquina a la de al lado no cambia el aviso.
import { ARCADE_GAME_INFO, arcadeGameOf } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { localMachine } from "@/game/arcade/local";

export function ArcadePromptLabel() {
  const [machine, setMachine] = useState<number | null>(() => localMachine());
  useEffect(() => {
    const id = window.setInterval(() => setMachine(localMachine()), 300);
    return () => window.clearInterval(id);
  }, []);
  const game = machine === null ? null : arcadeGameOf(machine);
  if (machine !== null && !game) return <>Mirar la máquina (fuera de servicio)</>;
  return <>{game ? `Jugar ${ARCADE_GAME_INFO[game].name}` : "Jugar en la máquina"}</>;
}
