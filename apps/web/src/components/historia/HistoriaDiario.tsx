"use client";

// La pestaña "Historia" de la mochila: el diario de "Lo que dejó E.". Los capítulos terminados con su
// resumen, el de ahora con sus pasos (los hechos, el abierto con su consejo y los que siguen como "???",
// para no adelantar nada), los que faltan escondidos y las cartas que llegaron, para releerlas. Las banderas
// de los capítulos y las cartas vienen de /api/points; los pasos abiertos, de la libreta de encargos.
import { QUEST_GIVERS, STORY_LESSONS, STORY_PERIOD, questById, storyDiary, type DiaryChapter, type DiaryStep, type StoryLetter } from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { useEncargos } from "@/game/encargos";
import { PixelIcon } from "../Cozy";
import { api, LetterCard, type PointsState } from "../PointsPanels";

function StepRow({ step }: { step: DiaryStep }) {
  const def = questById(step.questId);
  if (step.state === "hidden" || !def) {
    return (
      <li className="flex items-center gap-2 text-[13px] text-cozy-ink-soft">
        <PixelIcon name="lock" size={11} color="var(--color-cozy-ink-soft)" />
        ???
      </li>
    );
  }
  if (step.state === "done") {
    return (
      <li className="flex items-center gap-2 text-[13px] text-cozy-ink-soft">
        <PixelIcon name="star" size={11} color="var(--color-cozy-gold)" />
        <span className="line-through decoration-cozy-wood/60">{def.title}</span>
      </li>
    );
  }
  const giver = QUEST_GIVERS[def.giver].name;
  const lesson = STORY_LESSONS[def.id];
  return (
    <li className="flex flex-col gap-1 border-2 border-cozy-gold bg-cozy-paper-light px-2.5 py-2">
      <p className="flex flex-wrap items-baseline gap-x-2 text-[14px] font-semibold leading-tight">
        <PixelIcon name={step.state === "ready" ? "gift" : "chevron"} size={11} color="var(--color-cozy-red)" />
        {def.title}
        <span className="text-[12px] font-normal text-cozy-ink-soft">{step.state === "ready" ? `¡Listo! Entrégaselo a ${giver}` : `de ${giver}`}</span>
      </p>
      <p className="text-[13px] leading-snug">{def.text}</p>
      {lesson && (
        <p className="text-[12px] leading-snug text-cozy-ink-soft">
          <b>Consejo:</b> {lesson}
        </p>
      )}
    </li>
  );
}

function ChapterCard({ entry }: { entry: DiaryChapter }) {
  const { chapter, state } = entry;
  const label = `Capítulo ${chapter.n}`;
  if (state === "locked") {
    return (
      <article aria-label={`${label}: todavía no`} className="flex items-center gap-2 border-2 border-dashed border-cozy-paper-dark px-3 py-2 text-cozy-ink-soft">
        <PixelIcon name="lock" size={13} color="var(--color-cozy-ink-soft)" />
        <span className="text-[13px]">{label}</span>
        <span className="text-[14px] font-semibold">???</span>
      </article>
    );
  }
  const done = state === "done";
  return (
    <article aria-label={`${label}: ${chapter.title}`} className={`flex flex-col gap-2 border-2 p-3 ${done ? "border-cozy-paper-dark bg-cozy-paper" : "border-cozy-wood bg-cozy-paper"}`}>
      <header className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[12px] text-cozy-ink-soft">{label}</span>
        <h4 className="text-[15px] font-semibold">{chapter.title}</h4>
        <span className={`cozy-chip ml-auto px-2 py-0.5 text-[12px] ${done ? "text-cozy-green" : "text-cozy-red-deep"}`}>{done ? "Terminado" : "En curso"}</span>
      </header>
      {done ? (
        <p className="text-[13px] leading-snug">{chapter.summary}</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {entry.steps?.map((s) => (
            <StepRow key={s.questId} step={s} />
          ))}
        </ol>
      )}
    </article>
  );
}

export function HistoriaDiario() {
  const quests = useEncargos((s) => s.quests);
  const [data, setData] = useState<PointsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api<PointsState>("/api/points").then(
      (p) => alive && setData(p),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, []);
  const diary = useMemo(() => {
    if (!data) return null;
    const flags = data.storyFlags ?? {};
    const open = quests.filter((q) => q.period === STORY_PERIOD && q.status !== "CLAIMED");
    return storyDiary((k) => flags[k], open);
  }, [data, quests]);

  if (!diary) return <p className={`py-8 text-center text-[14px] ${error ? "text-cozy-red-deep" : "cozy-dots text-cozy-ink-soft"}`}>{error ?? "Abriendo el diario"}</p>;
  return <HistoriaDiarioView diary={diary} letters={data?.letters ?? []} />;
}

/** El diario ya armado (lo usa la pestaña; separado para poder verlo con datos de mentira). */
export function HistoriaDiarioView({ diary, letters }: { diary: readonly DiaryChapter[]; letters: readonly StoryLetter[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-cozy-ink-soft">
        <b className="text-cozy-ink">Lo que dejó E.</b> El cuidador de antes se fue sin despedirse y dejó cosas por hacer. Los pasos se entregan con E a quien los pide.
      </p>
      <div className="flex flex-col gap-2">
        {diary.map((c) => (
          <ChapterCard key={c.chapter.id} entry={c} />
        ))}
      </div>
      <section aria-label="Cartas recibidas" className="flex flex-col gap-2">
        <h4 className="flex items-center gap-1.5 text-[14px] font-semibold">
          <PixelIcon name="mail" size={13} color="var(--color-cozy-red)" />
          Cartas recibidas
        </h4>
        {letters.length === 0 ? (
          <p className="text-[13px] text-cozy-ink-soft">Todavía ninguna. Llegan al buzón del jardín cuando termina un capítulo.</p>
        ) : (
          letters.map((l) => <LetterCard key={l.id} letter={l} />)
        )}
      </section>
    </div>
  );
}
