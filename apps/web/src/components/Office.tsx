"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions";
import { media } from "@/game/media";
import { connect, disconnect } from "@/game/network";
import { useOfficeStore, type Profile } from "@/game/store";
import { RISO, waitForRisoFont } from "@/lib/riso";
import { CharacterDialog } from "./CharacterDialog";
import { ChatPanel } from "./ChatPanel";
import { Hud, PeoplePanel } from "./Hud";
import { MediaControls } from "./MediaControls";
import { ScreenFocus, VideoStrip } from "./VideoStrip";
import { MyOfficePanel } from "./MyOfficePanel";
import { DoorPrompt, KnockRequests, Notices, SeatPrompt } from "./OfficeOverlays";
import { Overprint } from "./Riso";

const RELOAD_FLAG = "hyvento:reloaded-after-update";

const sessionStorageSafe = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      // sin almacenamiento: no se puede evitar un segundo reintento
    }
  },
  remove: (k: string) => {
    try {
      sessionStorage.removeItem(k);
    } catch {
      // ignorar
    }
  },
};

/**
 * Si falla la carga del módulo del juego (típicamente porque se desplegó una versión nueva y la
 * pestaña pide un chunk que ya no existe), recargar una vez; si vuelve a fallar, avisar.
 */
function handleGameLoadError(err: unknown) {
  console.error("No se pudo cargar el juego:", err);
  const message = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  const isChunkError = /ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch/i.test(message);
  if (isChunkError && !sessionStorageSafe.get(RELOAD_FLAG)) {
    sessionStorageSafe.set(RELOAD_FLAG, "1");
    window.location.reload();
    return;
  }
  useOfficeStore.getState().setConnection("error", "No se pudo cargar el mapa de la oficina. Recarga la página.");
}

async function fetchGameToken(): Promise<string> {
  const res = await fetch("/api/game-token", { cache: "no-store" });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }
  const body = (await res.json().catch(() => null)) as { token?: string; error?: string } | null;
  if (!res.ok || !body?.token) throw new Error(body?.error ?? "No se pudo obtener el acceso a la oficina");
  return body.token;
}

interface OfficeProps {
  isAdmin: boolean;
  profile: Profile;
  onProfileChange: (p: Profile) => void;
  onEditProfile: () => void;
}

export function Office({ isAdmin, profile, onProfileChange, onEditProfile }: OfficeProps) {
  const gameRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [editingCharacter, setEditingCharacter] = useState(false);
  const closeCharacter = useCallback(() => setEditingCharacter(false), []);
  const connection = useOfficeStore((s) => s.connection);
  const error = useOfficeStore((s) => s.error);
  const onExit = () => void logout();

  useEffect(() => {
    let cancelled = false;
    let game: import("phaser").Game | undefined;

    (async () => {
      try {
        const token = await fetchGameToken();
        if (cancelled) return;
        await connect({ token });
      } catch (err) {
        if (!cancelled && useOfficeStore.getState().connection !== "error") {
          useOfficeStore.getState().setConnection("error", err instanceof Error ? err.message : String(err));
        }
        return;
      }
      if (cancelled || !gameRef.current) return;
      try {
        const { createGame, waitForSize, waitForVisible } = await import("@/game/createGame"); // Phaser necesita `window`
        if (cancelled || !gameRef.current) return;
        await waitForVisible();
        await waitForSize(gameRef.current);
        await waitForRisoFont();
        if (cancelled || !gameRef.current) return;
        game = createGame(gameRef.current);
        game.events.once("ready", () => sessionStorageSafe.remove(RELOAD_FLAG));
      } catch (err) {
        if (cancelled) return;
        handleGameLoadError(err);
        return;
      }
      // Audio/video: opcional; si LiveKit no está disponible la oficina funciona igual.
      void media.connect();
    })();

    return () => {
      cancelled = true;
      game?.destroy(true);
      void media.disconnect();
      void disconnect();
    };
  }, [attempt]);

  return (
    <main className="riso-halftone relative h-full w-full overflow-hidden font-plex text-riso-navy">
      <div ref={gameRef} className="absolute inset-0" />
      {connection === "connected" || connection === "reconnecting" ? (
        <>
          <Hud
            isAdmin={isAdmin}
            onEditProfile={onEditProfile}
            onEditCharacter={() => setEditingCharacter(true)}
            onLogout={onExit}
          />
          <div className="pointer-events-none absolute top-3 right-3 z-10 flex w-[min(270px,calc(100%-1.5rem))] flex-col items-end gap-3 max-md:w-44">
            <PeoplePanel />
            <Notices />
          </div>
          <ChatPanel />
          <MyOfficePanel />
          <DoorPrompt />
          <SeatPrompt />
          <KnockRequests />
          <MediaControls />
          <ControlsHint />
          <VideoStrip />
          <ScreenFocus />
          {editingCharacter && <CharacterDialog profile={profile} onClose={closeCharacter} onSaved={onProfileChange} />}
        </>
      ) : null}

      {connection === "reconnecting" && (
        <div className="riso-chip absolute top-16 left-1/2 z-20 -translate-x-1/2 bg-riso-yellow px-3.5 py-1.5 text-xs font-semibold">
          Reconectando…
        </div>
      )}

      {(connection === "connecting" || connection === "idle") && (
        <Overlay>
          <Title text="Entrando…" />
          <p className="mt-4 text-[13px] text-riso-muted">Preparando la oficina</p>
        </Overlay>
      )}

      {connection === "error" && (
        <Overlay>
          <Title text="Uy." />
          <p className="mt-5 max-w-sm text-center text-[15px] leading-relaxed">{error ?? "Algo salió mal."}</p>
          <div className="mt-6 flex items-center gap-4">
            <button onClick={() => setAttempt((n) => n + 1)} className="riso-pill riso-press bg-riso-pink px-5 py-3 text-[15px]">
              Reintentar
            </button>
            <button onClick={onExit} className="text-[14px] underline underline-offset-2">
              Cerrar sesión
            </button>
          </div>
        </Overlay>
      )}
    </main>
  );
}

/** Recordatorio de controles (abajo a la derecha, solo en pantallas anchas). */
function ControlsHint() {
  return (
    <div className="absolute right-3 bottom-4 hidden border-[1.5px] border-riso-navy bg-riso-paper px-2.5 py-1.5 text-xs text-riso-muted xl:block">
      WASD / flechas · clic para caminar · E para sentarte · Enter para chatear
    </div>
  );
}

function Title({ text }: { text: string }) {
  return <Overprint lines={[text]} back={RISO.blue} front={RISO.pink} offset={[4, 3]} className="text-6xl leading-none tracking-tight" />;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-riso-paper/90 p-4">{children}</div>
  );
}
