"use client";

// El cuadro de quien da encargos: se abre con E junto a él (además de lo suyo: el tablón sigue mostrando
// las misiones y Don Evelio su mostrador) y dice lo que te pidió, cuánto llevas y, si ya está, "Entregar".
// Se cierra al alejarse (lo mide la escena) o con Esc.
import { QUEST_GIVERS, questById, questKey } from "@hyvento/shared";
import { useEffect } from "react";
import { claimQuest, questGiverToTalk, questsOfGiver, stopTalking, useEncargos } from "@/game/encargos";
import { PixelIcon } from "../Cozy";
import { StoryExtras } from "../historia/HistoriaCard";
import { QuestEntry, QuestTag } from "./QuestParts";

export function QuestCard() {
  const talking = useEncargos((s) => s.talking);
  const quests = useEncargos((s) => s.quests);
  const claiming = useEncargos((s) => s.claiming);

  useEffect(() => {
    if (!talking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stopTalking();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [talking]);

  if (!talking) return null;
  const giver = QUEST_GIVERS[talking.giver];
  const mine = questsOfGiver(quests, talking.giver);
  return (
    <section
      aria-label={`Encargos de ${giver.name}`}
      className="cozy-panel pointer-events-auto flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2 p-3"
    >
      <header className="flex items-start gap-2">
        <PixelIcon name={talking.giver === "tablon" ? "board" : "chat"} size={16} color="var(--color-cozy-wood)" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-tight">{giver.name}</h3>
          {/* La key reinicia la animación cuando dice otra cosa (el saludo o las gracias). */}
          <p key={talking.seq} className="animate-[cozy-pop_0.35s_steps(3)] text-[13px] italic leading-snug text-cozy-ink-soft">
            {talking.line}
          </p>
        </div>
        <button type="button" onClick={stopTalking} aria-label="Cerrar" className="cozy-hit shrink-0 p-1 text-cozy-ink-soft hover:text-cozy-ink">
          <PixelIcon name="close" size={10} />
        </button>
      </header>
      {mine.length === 0 ? (
        <p className="text-[13px] text-cozy-ink-soft">Por hoy no te queda nada pendiente aquí. Vuelve mañana, que siempre hay algo.</p>
      ) : (
        <div className="cozy-scroll flex max-h-[min(22rem,45vh)] flex-col gap-2 overflow-y-auto">
          {mine.map((q) => {
            const key = questKey(q.questId, q.period);
            const def = questById(q.questId);
            return (
              <QuestEntry
                key={key}
                q={q}
                showGiver={false}
                tag={q.late ? <QuestTag tone="red">de ayer</QuestTag> : q.shared ? <QuestTag>{def?.kind === "weekly" ? "de la semana" : "de todos"}</QuestTag> : undefined}
                actions={
                  q.status === "DONE" ? (
                    <button type="button" disabled={claiming === key} onClick={() => claimQuest(q)} className="cozy-btn cozy-btn-primary px-3 py-1 text-[13px]">
                      {claiming === key ? "Entregando…" : "Entregar"}
                    </button>
                  ) : null
                }
              />
            );
          })}
        </div>
      )}
      <StoryExtras giver={talking.giver} />
    </section>
  );
}

/** Lo que dice la "E" junto a un personaje que te dio un encargo. */
export function QuestPromptLabel() {
  useEncargos((s) => s.near);
  const giver = questGiverToTalk();
  return <>{giver ? `Hablar con ${QUEST_GIVERS[giver].name}` : "Hablar del encargo"}</>;
}
