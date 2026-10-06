"use client";

// La historia en los paneles: en la libreta de quien da el paso de ahora ("Ver encargos" desde su tira), su
// consejo y "Saltar historia", que está a la mano mientras dura el capítulo 1. Lo que se le dice o se le
// pregunta a quien da el paso (saludar a Doña Aurora, `STORY_ASKS`) y la bienvenida de Doña Aurora van por la
// tira de conversación (VIR-171: game/encargos.ts y game/historia.ts).
import { CAPITULO_1, QUEST_GIVERS, STORY_LESSONS, capituloOf, questById, type QuestGiverId } from "@hyvento/shared";
import { useEncargos } from "@/game/encargos";
import { currentStoryStep, skipStory } from "@/game/historia";

/** "Saltar historia" (con confirmación: se entregan todos sin pagar; llegan igual el logro y la carta). Solo el capítulo 1 se salta. */
export function SkipStoryButton({ className = "" }: { className?: string }) {
  const step = useEncargos((s) => currentStoryStep(s.quests));
  if (!step || capituloOf(step.questId)?.id !== CAPITULO_1.id) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm("¿Saltar la historia? Los pasos quedan entregados sin puntos, pero te llegan el logro y la carta igual.")) skipStory();
      }}
      className={`cozy-btn px-2.5 py-1 text-[12px] ${className}`}
    >
      Saltar historia
    </button>
  );
}

/** Lo de la historia en la libreta de quien da el paso de ahora: su consejo y "Saltar historia". */
export function StoryExtras({ giver }: { giver: QuestGiverId }) {
  const quests = useEncargos((s) => s.quests);
  const step = currentStoryStep(quests);
  if (!step || questById(step.questId)?.giver !== giver) return null;
  const lesson = STORY_LESSONS[step.questId];
  return (
    <div className="flex flex-col gap-2 border-t-2 border-cozy-paper-dark pt-2">
      {lesson && (
        <p className="text-[13px] leading-snug">
          <b>Consejo de {giver === "aurora" ? "Aurora" : QUEST_GIVERS[giver].name}:</b> {lesson}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <SkipStoryButton className="ml-auto" />
      </div>
    </div>
  );
}
