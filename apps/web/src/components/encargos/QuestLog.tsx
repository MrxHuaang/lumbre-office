"use client";

// La libreta de encargos (pestaña del menú de la mochila): los diarios —el de todos marcado—, el semanal y
// el hueco de la historia. Cada uno con quién lo da, el progreso, la recompensa y "Seguir" para fijarlo en
// el rastreador. Se entregan junto a quien los dio (con E), no desde aquí.
import { QUEST_GIVERS, questById, questKey, type QuestView } from "@hyvento/shared";
import { pinQuest, trackedQuest, useEncargos } from "@/game/encargos";
import { QuestEntry, QuestTag } from "./QuestParts";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex flex-wrap items-baseline gap-x-2 border-b-2 border-cozy-paper-dark pb-1 text-[14px] font-semibold">
        {title}
        {hint && <span className="text-[12px] font-normal text-cozy-ink-soft">{hint}</span>}
      </h3>
      {children}
    </section>
  );
}

export function QuestLog() {
  const quests = useEncargos((s) => s.quests);
  const loaded = useEncargos((s) => s.loaded);
  const pinned = useEncargos((s) => s.pinned);
  const tracked = trackedQuest(quests, pinned);
  if (!loaded) return <p className="cozy-dots py-8 text-center text-[14px] text-cozy-ink-soft">Abriendo la libreta</p>;

  const kind = (q: QuestView) => questById(q.questId)?.kind;
  const daily = quests.filter((q) => kind(q) === "daily");
  const weekly = quests.filter((q) => kind(q) === "weekly");
  const story = quests.filter((q) => kind(q) === "story");

  const entry = (q: QuestView) => {
    const key = questKey(q.questId, q.period);
    const def = questById(q.questId);
    const following = tracked !== null && questKey(tracked.questId, tracked.period) === key;
    const giver = def ? QUEST_GIVERS[def.giver] : undefined;
    const tags = (
      <>
        {q.shared && def?.kind === "daily" && <QuestTag>de todos</QuestTag>}
        {q.late && <QuestTag tone="red">de ayer: entrégalo hoy</QuestTag>}
        {q.status === "DONE" && <QuestTag tone="gold">{def?.giver === "tablon" ? "listo: llévalo al tablón" : `listo: llévaselo a ${giver?.name ?? ""}`}</QuestTag>}
        {q.status === "CLAIMED" && <QuestTag>entregado</QuestTag>}
      </>
    );
    return (
      <QuestEntry
        key={key}
        q={q}
        tag={tags}
        actions={
          q.status === "CLAIMED" ? null : (
            <button type="button" aria-pressed={following} onClick={() => pinQuest(following ? null : key)} className="cozy-btn px-2.5 py-1 text-[12px]">
              {following ? "Siguiendo" : "Seguir"}
            </button>
          )
        }
      />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-cozy-ink-soft">
        Se cumplen solos haciendo lo que piden y se entregan con <kbd className="cozy-kbd">E</kbd> junto a quien los dio (la marca <b className="text-cozy-red-deep">?</b> dorada sobre su cabeza). Los diarios cambian a la medianoche; lo de ayer cumplido se puede entregar hoy.
      </p>
      <Section title="Diarios" hint="uno igual para todos y dos tuyos">
        {daily.length ? daily.map(entry) : <p className="text-[13px] text-cozy-ink-soft">Hoy no hay encargos (raro: pregúntale al tablón).</p>}
      </Section>
      <Section title="Semanal" hint="más grande, de lunes a domingo">
        {weekly.length ? weekly.map(entry) : <p className="text-[13px] text-cozy-ink-soft">Esta semana no hay encargo grande.</p>}
      </Section>
      <Section title="Historia">
        {story.length ? (
          story.map(entry)
        ) : (
          <p className="border-2 border-dashed border-cozy-paper-dark p-3 text-center text-[13px] italic text-cozy-ink-soft">
            Una página en blanco. Alguien va a llegar a la cabaña con una historia que contar…
          </p>
        )}
      </Section>
    </div>
  );
}
