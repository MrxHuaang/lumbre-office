"use client";

// El rastreador de encargos: una fichita en la columna de la derecha (bajo los conectados, con los avisos)
// con el encargo fijado y su progreso en vivo. Si no se eligió ninguno, va el primero sin entregar; clic
// abre la libreta (la mochila, pestaña Encargos).
import { QUEST_GIVERS, questById } from "@hyvento/shared";
import { requestQuestLog, trackedQuest, useEncargos } from "@/game/encargos";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";
import { SkipStoryButton } from "../historia/HistoriaCard";
import { QuestBar } from "./QuestParts";

export function QuestTracker() {
  const quests = useEncargos((s) => s.quests);
  const pinned = useEncargos((s) => s.pinned);
  // Con la mochila abierta la libreta ya se ve entera.
  const bagOpen = useOfficeStore((s) => s.panel?.kind === "backpack");
  const q = trackedQuest(quests, pinned);
  const def = q ? questById(q.questId) : undefined;
  if (!q || !def || bagOpen) return null;
  const done = q.status === "DONE";
  const giver = QUEST_GIVERS[def.giver];
  const story = def.kind === "story";
  return (
    <div className="flex w-full max-w-[16rem] flex-col items-end gap-1">
      <button
        type="button"
        onClick={requestQuestLog}
        title="Abrir la libreta de encargos"
        className={`cozy-panel pointer-events-auto flex w-full flex-col gap-1 px-2.5 py-2 text-left hover:brightness-105 ${done ? "outline-2 outline-cozy-gold" : ""}`}
      >
        <span className="flex items-center gap-1.5 text-[11px] text-cozy-ink-soft">
          <PixelIcon name="board" size={11} color="var(--color-cozy-wood)" />
          {story ? "Historia" : "Encargo"} · {giver.name}
        </span>
        <span className="text-[13px] font-semibold leading-tight">{def.title}</span>
        <QuestBar q={q} def={def} compact />
        {done && <span className="text-[12px] font-semibold text-cozy-red-deep">{def.giver === "tablon" ? "¡Listo! Llévalo al tablón." : `¡Listo! Llévaselo a ${giver.name}.`}</span>}
      </button>
      {/* En la historia, saltarla siempre queda a la mano. */}
      {story && <SkipStoryButton className="pointer-events-auto" />}
    </div>
  );
}
