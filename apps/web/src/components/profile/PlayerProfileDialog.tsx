"use client";

// El perfil dentro de la cabaña: se abre con clic en alguien, en la lista de conectados o con
// "Mi perfil" del menú. Los datos salen de GET /api/profile/[id] (solo lo público del equipo).
import type { ProfileDTO } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { useAchievementStore } from "@/game/achievements";
import { api } from "../PointsPanels";
import { OfficeDialog } from "../OfficeDialog";
import { profileHref, ProfileView } from "./ProfileView";

export function PlayerProfileDialog({ userId, onClose, onEditProfile }: { userId: string; onClose: () => void; onEditProfile?: () => void }) {
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Si desbloqueo algo con mi perfil abierto, se vuelve a pedir.
  const version = useAchievementStore((s) => s.version);

  useEffect(() => {
    let alive = true;
    setError(null);
    api<ProfileDTO>(`/api/profile/${encodeURIComponent(userId)}`).then(
      (p) => alive && setProfile(p),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [userId, version]);

  const title = !profile ? "Perfil" : profile.isMe ? "Tu perfil" : `Perfil de ${profile.name}`;
  return (
    <OfficeDialog
      title={title}
      onClose={onClose}
      className="max-w-4xl"
      footer={
        profile && (
          <>
            {profile.isMe && onEditProfile && (
              <button type="button" onClick={onEditProfile} className="cozy-btn cozy-btn-primary px-4 py-2 text-[14px]">
                Editar perfil
              </button>
            )}
            <a href={profileHref(profile.id)} target="_blank" rel="noreferrer" className="cozy-btn px-4 py-2 text-[14px]">
              Abrir en otra pestaña
            </a>
          </>
        )
      }
    >
      <div className="cozy-scroll min-h-0 overflow-y-auto px-4 py-4">
        {profile ? (
          <ProfileView profile={profile} />
        ) : (
          <p className={`py-10 text-center text-[15px] ${error ? "text-cozy-red-deep" : "cozy-dots text-cozy-ink-soft"}`}>{error ?? "Abriendo el perfil"}</p>
        )}
      </div>
    </OfficeDialog>
  );
}
