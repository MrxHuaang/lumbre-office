"use client";

// La historia en pantalla: la bienvenida de Doña Aurora (el prólogo, solo a quien recién llegó) y, en el
// cuadro de sus encargos, lo que enseña el paso de ahora, "Saludar a Doña Aurora" (el paso 3 se puede
// cumplir con ella si no hay nadie) y "Saltar historia", que siempre está a la mano.
import { AURORA_WELCOME, AURORA_WELCOME_BUS, CAPITULO_1, STORY_LESSONS, questById } from "@hyvento/shared";
import { useEncargos } from "@/game/encargos";
import { closePrologue, currentStoryStep, skipStory, useHistoria } from "@/game/historia";
import { sendEmote } from "@/game/network";
import { PixelIcon } from "../Cozy";

/** "Saltar historia" (con confirmación: se entregan todos sin pagar; llegan igual el logro y la carta). */
export function SkipStoryButton({ className = "" }: { className?: string }) {
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

/** Lo de la historia en el cuadro de Doña Aurora (va dentro del cuadro de encargos). */
export function AuroraStoryExtras() {
  const quests = useEncargos((s) => s.quests);
  const step = currentStoryStep(quests);
  if (!step) return null;
  return (
    <div className="flex flex-col gap-2 border-t-2 border-cozy-paper-dark pt-2">
      <p className="text-[13px] leading-snug">
        <b>Consejo de Aurora:</b> {STORY_LESSONS[step.questId]}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {step.questId === "llegada-3" && step.status === "ACTIVE" && (
          <button type="button" onClick={() => sendEmote("wave")} className="cozy-btn cozy-btn-primary px-2.5 py-1 text-[12px]">
            Saludar a Doña Aurora
          </button>
        )}
        <SkipStoryButton className="ml-auto" />
      </div>
    </div>
  );
}

/** La bienvenida de Doña Aurora (a quien recién llegó; si vino en el bus, al bajarse). */
export function PrologueCard() {
  const prologue = useHistoria((s) => s.prologue);
  const quests = useEncargos((s) => s.quests);
  if (!prologue?.open) return null;
  const step = currentStoryStep(quests);
  const def = step ? questById(step.questId) : undefined;
  const lines = prologue.byBus ? [AURORA_WELCOME_BUS, ...AURORA_WELCOME] : AURORA_WELCOME;
  return (
    <section aria-label="Bienvenida de Doña Aurora" className="cozy-panel pointer-events-auto flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2 p-3">
      <header className="flex items-center gap-2">
        <PixelIcon name="heart" size={16} color="var(--color-cozy-red)" />
        <h3 className="flex-1 text-[15px] font-semibold">Doña Aurora</h3>
        <span className="text-[11px] text-cozy-ink-soft">Capítulo 1 · {CAPITULO_1.title}</span>
      </header>
      {lines.map((l) => (
        <p key={l} className="text-[13px] leading-snug">
          {l}
        </p>
      ))}
      {def && (
        <p className="border-2 border-cozy-gold bg-cozy-paper-light px-2 py-1.5 text-[13px] leading-snug">
          <b>Primer paso: {def.title}.</b> {def.text}
        </p>
      )}
      <p className="text-[12px] text-cozy-ink-soft">La encuentra en el recibidor de la planta baja, junto a la escalera (la flechita le muestra a dónde ir).</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={closePrologue} className="cozy-btn cozy-btn-primary px-3 py-1 text-[13px]">
          ¡Vamos!
        </button>
        <SkipStoryButton className="ml-auto" />
      </div>
    </section>
  );
}
