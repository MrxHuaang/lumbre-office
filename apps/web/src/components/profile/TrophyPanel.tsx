"use client";

// La vitrina de trofeos de una oficina (E junto a la vitrina): los logros que ya tiene el dueño, lo más
// difícil primero. Los datos salen de su perfil público (GET /api/profile/[id]). En la casa propia, la
// vitrina es del dueño de la casa.
import { ACHIEVEMENT_RARITIES, ACHIEVEMENT_RARITY, achievementById, type Achievement, type ProfileDTO } from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { useAchievementStore } from "@/game/achievements";
import { useOfficeStore } from "@/game/store";
import { casaOwnerOf } from "@/lib/casaGaleria";
import { api, PanelShell } from "../PointsPanels";
import { Badge } from "./Badge";

const day = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

export function TrophyPanel({ onClose }: { onClose: () => void }) {
  // La vitrina es de la oficina donde estoy parado (el punto de la vitrina queda adentro).
  const office = useOfficeStore((s) => {
    const zoneId = s.sessionId ? s.players[s.sessionId]?.zoneId : undefined;
    return zoneId ? s.offices[zoneId] : undefined;
  });
  const casaOwner = useOfficeStore((s) => casaOwnerOf(s.area));
  const version = useAchievementStore((s) => s.version);
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ownerId = casaOwner ?? office?.ownerId ?? "";

  useEffect(() => {
    if (!ownerId) return;
    let alive = true;
    setError(null);
    api<ProfileDTO>(`/api/profile/${encodeURIComponent(ownerId)}`).then(
      (p) => alive && setProfile(p),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [ownerId, version]);

  const won = useMemo(() => {
    if (!profile) return [];
    const rank = (a: Achievement) => ACHIEVEMENT_RARITIES.length - ACHIEVEMENT_RARITIES.indexOf(a.rarity);
    return profile.achievements
      .filter((st) => st.unlockedAt)
      .map((st) => ({ a: achievementById(st.id), at: st.unlockedAt! }))
      .filter((x): x is { a: Achievement; at: string } => Boolean(x.a))
      .sort((x, y) => rank(y.a) - rank(x.a) || y.at.localeCompare(x.at));
  }, [profile]);

  const ownerName = casaOwner ? profile?.name : office?.ownerName;
  const title = ownerName ? `Vitrina de ${ownerName}` : "Vitrina de trofeos";
  return (
    <PanelShell title={title} icon="trophy" onClose={onClose} wide>
      {!ownerId ? (
        <p className="text-[14px] text-cozy-ink-soft">Esta oficina todavía no tiene dueño: la vitrina espera sus primeros trofeos.</p>
      ) : !profile ? (
        <p className={`text-[14px] ${error ? "text-cozy-red-deep" : "cozy-dots text-cozy-ink-soft"}`}>{error ?? "Abriendo la vitrina"}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
            <p className="text-cozy-ink-soft">
              {won.length === 0
                ? profile.isMe
                  ? "Tu vitrina está vacía. Cada logro que consigas pone un trofeo aquí."
                  : `${profile.name} todavía no tiene logros.`
                : `“${profile.title}”. Un trofeo por cada logro, del más difícil al más común.`}
            </p>
            <span className="cozy-chip shrink-0 px-2.5 py-1 tabular-nums">
              {won.length} de {profile.achievements.length} logros
            </span>
          </div>
          {won.length > 0 && (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {won.map(({ a, at }) => (
                <li key={a.id} className="flex min-w-0 items-center gap-2.5 border-2 border-cozy-paper-dark bg-cozy-paper-light px-2.5 py-2">
                  <Badge achievement={a} scale={2} className="shrink-0" />
                  <div className="min-w-0 text-[13px]">
                    <p className="flex flex-wrap items-center gap-1.5 text-[15px] leading-tight font-semibold">
                      {a.name}
                      <span className="inline-flex items-center gap-1 text-[12px] font-normal text-cozy-ink-soft">
                        <span className="size-2 shrink-0 border border-cozy-frame" style={{ background: ACHIEVEMENT_RARITY[a.rarity].color }} />
                        {ACHIEVEMENT_RARITY[a.rarity].label}
                      </span>
                    </p>
                    <p className="mt-0.5 leading-snug">{a.description}</p>
                    <p className="mt-0.5 text-[12px] text-cozy-ink-soft">Desde el {day(at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PanelShell>
  );
}
