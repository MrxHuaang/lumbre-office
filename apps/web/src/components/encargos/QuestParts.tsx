"use client";

// Piezas de los encargos que comparten la libreta, el cuadro de quien los da y el rastreador: la barra de
// progreso, la recompensa y la ficha de un encargo.
import { QUEST_GIVERS, QUEST_SKILL_TEXT, bagItemInfo, objItemId, questById, questProgressText, type QuestDef, type QuestView } from "@hyvento/shared";
import type { ReactNode } from "react";
import { ItemIcon } from "../bag/ItemIcon";
import { PixelIcon } from "../Cozy";

export function QuestBar({ q, def, compact = false }: { q: Pick<QuestView, "progress" | "goal" | "status">; def: QuestDef | undefined; compact?: boolean }) {
  const pct = Math.round((Math.min(q.progress, q.goal) / Math.max(1, q.goal)) * 100);
  const ready = q.status !== "ACTIVE";
  return (
    <div className="flex items-center gap-2">
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={q.goal}
        aria-valuenow={Math.min(q.progress, q.goal)}
        className={`relative block flex-1 overflow-hidden border-2 border-cozy-wood bg-cozy-paper-dark ${compact ? "h-2" : "h-3"}`}
      >
        <span className="absolute inset-y-0 left-0 block" style={{ width: `${pct}%`, background: ready ? "var(--color-cozy-gold)" : "var(--color-cozy-green)" }} />
      </span>
      <span className={`shrink-0 tabular-nums ${compact ? "text-[11px]" : "text-[12px]"} ${ready ? "font-semibold text-cozy-red-deep" : "text-cozy-ink-soft"}`}>
        {questProgressText(q, def)}
      </span>
    </div>
  );
}

export function QuestReward({ def }: { def: QuestDef }) {
  const item = def.reward.item;
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-cozy-ink-soft">
      <span className="flex items-center gap-1">
        <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
        {def.reward.points}
      </span>
      <span className="flex items-center gap-1">
        <PixelIcon name="star" size={12} color="var(--color-cozy-wood)" />+{def.reward.xp} {QUEST_SKILL_TEXT[def.reward.skill].toLowerCase()}
      </span>
      {item && (
        <span className="flex items-center gap-1">
          <span className="relative inline-block h-4 w-4">
            <ItemIcon itemId={objItemId(item.id)} className="absolute inset-0 h-full w-full" />
          </span>
          {item.qty > 1 ? `${item.qty} × ` : ""}
          {bagItemInfo(objItemId(item.id)).name.toLowerCase()}
        </span>
      )}
    </span>
  );
}

/** Quién da el encargo, dicho corto ("Don Evelio", "El tablón"). */
export const giverName = (def: QuestDef | undefined) => (def ? QUEST_GIVERS[def.giver].name : "");

/** La ficha de un encargo: título, quién lo da, el texto, el progreso y la recompensa. */
export function QuestEntry({ q, tag, actions, showGiver = true }: { q: QuestView; tag?: ReactNode; actions?: ReactNode; showGiver?: boolean }) {
  const def = questById(q.questId);
  if (!def) return null;
  const claimed = q.status === "CLAIMED";
  return (
    <article className={`flex flex-col gap-1.5 border-2 p-2.5 ${q.status === "DONE" ? "border-cozy-gold bg-cozy-paper-light" : "border-cozy-paper-dark bg-cozy-paper"} ${claimed ? "opacity-60" : ""}`}>
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h4 className="text-[15px] font-semibold text-cozy-ink">{def.title}</h4>
        {tag}
        {showGiver && <span className="ml-auto text-[12px] text-cozy-ink-soft">{giverName(def)}</span>}
      </header>
      <p className="text-[13px] leading-snug text-cozy-ink">{def.text}</p>
      {!claimed && <QuestBar q={q} def={def} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <QuestReward def={def} />
        {actions}
      </div>
    </article>
  );
}

/** La etiqueta chica de un encargo ("de todos", "de ayer", "entregado"). */
export function QuestTag({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "gold" | "red" }) {
  const cls = tone === "gold" ? "border-cozy-gold text-cozy-red-deep" : tone === "red" ? "border-cozy-red text-cozy-red-deep" : "border-cozy-wood-light text-cozy-ink-soft";
  return <span className={`border px-1.5 text-[11px] leading-[1.4] ${cls}`}>{children}</span>;
}
