"use client";

// "¡Logro desbloqueado!": baja un cartelito arriba al centro con la insignia, se queda unos segundos y
// se va solo. No roba el foco ni tapa el juego; un clic abre tu perfil. Los épicos y legendarios brillan.
import { achievementById, ACHIEVEMENT_CATEGORY, ACHIEVEMENT_RARITY, ACHIEVEMENT_SCORE } from "@hyvento/shared";
import { useAchievementStore } from "@/game/achievements";
import { PixelIcon } from "../Cozy";
import { Badge } from "./Badge";

export function AchievementToasts() {
  const toasts = useAchievementStore((s) => s.toasts);
  const dismiss = useAchievementStore((s) => s.dismissToast);
  const openProfile = useAchievementStore((s) => s.openProfile);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none flex w-full flex-col gap-2" aria-live="polite">
      {toasts.map((t) => {
        const a = achievementById(t.achievementId);
        if (!a) return null;
        const rarity = ACHIEVEMENT_RARITY[a.rarity];
        const shiny = a.rarity === "epico" || a.rarity === "legendario";
        return (
          <div
            key={t.key}
            role="status"
            className={`achievement-toast cozy-panel pointer-events-auto relative flex items-center gap-3 overflow-hidden py-2 pr-2 pl-2.5 ${shiny ? "achievement-toast-shiny" : ""}`}
          >
            <span className="achievement-toast-badge shrink-0">
              <Badge achievement={a} scale={2} />
            </span>
            <button
              type="button"
              onClick={() => {
                dismiss(t.key);
                openProfile("me");
              }}
              className="min-w-0 flex-1 text-left"
              title="Ver tus logros"
            >
              <span className="flex items-center gap-2 text-[12px] leading-none font-semibold tracking-wide uppercase">
                <span className="text-cozy-gold">¡Logro desbloqueado!</span>
                <span className="ml-auto flex items-center gap-1 tabular-nums text-cozy-ink-soft normal-case" title="Puntaje de logros">
                  <PixelIcon name="star" size={9} color="var(--color-cozy-gold)" />+{ACHIEVEMENT_SCORE[a.rarity]}
                </span>
              </span>
              <span className="mt-1 block truncate text-[16px] leading-tight font-semibold">{a.name}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-cozy-ink-soft">{a.description}</span>
              <span className="mt-1 block text-[11px] leading-none">
                <span style={{ color: rarity.color }} className="font-semibold">
                  {rarity.label}
                </span>
                <span className="text-cozy-ink-soft"> · {ACHIEVEMENT_CATEGORY[a.category].label}</span>
              </span>
            </button>
            <button type="button" onClick={() => dismiss(t.key)} aria-label="Cerrar aviso" className="shrink-0 self-start p-1 text-cozy-ink-soft hover:text-cozy-ink">
              <PixelIcon name="close" size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
