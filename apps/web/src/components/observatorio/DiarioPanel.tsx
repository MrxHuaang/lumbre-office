"use client";

// El diario de exploración (el escritorio del observatorio o el menú): una bitácora con lo descubierto
// (cada nivel, las estrellas fugaces, el malvavisco perfecto, lo raro del lago), sacado de los
// contadores del perfil. Cada página va con su logro; lo que falta se ve como "???" con una pista.
import { achievementById, explorationLog, type LogEntry, type ProfileDTO } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { useAchievementStore } from "@/game/achievements";
import { api, PanelShell } from "../PointsPanels";
import { Badge } from "../profile/Badge";

const GROUPS: { id: LogEntry["group"]; title: string }[] = [
  { id: "lugares", title: "Lugares" },
  { id: "cielo", title: "El cielo" },
  { id: "fogata", title: "La fogata" },
  { id: "lago", title: "El lago" },
];

export function DiarioPanel({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const version = useAchievementStore((s) => s.version);
  useEffect(() => {
    api<ProfileDTO>("/api/profile/me").then(setProfile, (e: Error) => setError(e.message));
  }, [version]);
  const log = profile ? explorationLog(profile.stats) : [];
  const unlocked = new Set(profile?.achievements.filter((a) => a.unlockedAt).map((a) => a.id) ?? []);
  const found = log.filter((e) => e.found).length;
  return (
    <PanelShell title="Diario de exploración" icon="board" onClose={onClose} wide>
      {error ? (
        <p className="text-center text-cozy-ink-soft">{error}</p>
      ) : !profile ? (
        <p className="py-8 text-center text-cozy-ink-soft">Buscando la página…</p>
      ) : (
        <div className="flex flex-col gap-4 text-[14px]">
          <p className="text-cozy-ink-soft">
            {found} de {log.length} descubrimientos anotados. Lo que falta tiene pista: sal a buscarlo.
          </p>
          {GROUPS.map((g) => (
            <section key={g.id} aria-label={g.title} className="flex flex-col gap-2">
              <h3 className="border-b-2 border-cozy-paper-dark pb-1 text-[15px] font-semibold">{g.title}</h3>
              <ul className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                {log
                  .filter((e) => e.group === g.id)
                  .map((e) => {
                    const ach = e.achievementId ? achievementById(e.achievementId) : undefined;
                    return (
                      <li key={e.id} className={`flex items-start gap-2 border-2 px-2 py-1.5 ${e.found ? "border-cozy-wood bg-cozy-paper-light" : "border-dashed border-cozy-paper-dark"}`}>
                        {ach && <Badge achievement={ach} locked={!ach || !unlocked.has(ach.id)} scale={1} className="mt-0.5 shrink-0" />}
                        <span className="min-w-0">
                          <span className="block font-semibold">{e.found ? e.title : "???"}</span>
                          <span className="block text-[12px] text-cozy-ink-soft">{e.found ? e.note : e.hint}</span>
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PanelShell>
  );
}
