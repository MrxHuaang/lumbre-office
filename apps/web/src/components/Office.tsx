"use client";

import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions";
import { media } from "@/game/media";
import { connect, disconnect } from "@/game/network";
import { useOfficeStore } from "@/game/store";
import { AgentPanel } from "./AgentPanel";
import { ChatPanel } from "./ChatPanel";
import { Hud } from "./Hud";
import { MediaControls } from "./MediaControls";
import { ScreenFocus, VideoStrip } from "./VideoStrip";
import { MyOfficePanel } from "./MyOfficePanel";
import { DoorPrompt, KnockRequests, Notices } from "./OfficeOverlays";

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

export function Office({ isAdmin, onEditProfile }: { isAdmin: boolean; onEditProfile: () => void }) {
  const gameRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const connection = useOfficeStore((s) => s.connection);
  const error = useOfficeStore((s) => s.error);
  const onExit = () => void logout();
  const agentOpen = useOfficeStore((s) => s.openAgentId !== null);

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
      const { createGame } = await import("@/game/createGame"); // Phaser necesita `window`
      if (cancelled || !gameRef.current) return;
      game = createGame(gameRef.current);
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
    <main className="relative h-full w-full overflow-hidden">
      <div ref={gameRef} className="absolute inset-0" />
      {connection === "connected" || connection === "reconnecting" ? (
        <>
          <Hud isAdmin={isAdmin} onEditProfile={onEditProfile} onLogout={onExit} />
          {agentOpen ? <AgentPanel /> : <ChatPanel />}
          <MyOfficePanel />
          <DoorPrompt />
          <KnockRequests />
          <Notices />
          <MediaControls />
          <VideoStrip />
          <ScreenFocus />
        </>
      ) : null}

      {connection === "reconnecting" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500/90 px-3 py-1 text-xs font-medium text-black">
          Reconectando…
        </div>
      )}

      {(connection === "connecting" || connection === "idle") && (
        <Overlay>
          <p className="text-sm text-muted">Entrando a la oficina…</p>
        </Overlay>
      )}

      {connection === "error" && (
        <Overlay>
          <p className="max-w-sm text-center text-sm">{error ?? "Algo salió mal."}</p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setAttempt((n) => n + 1)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
            >
              Reintentar
            </button>
            <button onClick={onExit} className="rounded-lg border border-line px-4 py-2 text-sm">
              Cerrar sesión
            </button>
          </div>
        </Overlay>
      )}
    </main>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/85 p-4">{children}</div>
  );
}
