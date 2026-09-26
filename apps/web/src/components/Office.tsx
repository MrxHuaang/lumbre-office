"use client";

import { useEffect, useRef, useState } from "react";
import { connect, disconnect } from "@/game/network";
import { useOfficeStore, type Profile } from "@/game/store";
import { ChatPanel } from "./ChatPanel";
import { Hud } from "./Hud";

export function Office({ profile, onExit }: { profile: Profile; onExit: () => void }) {
  const gameRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const connection = useOfficeStore((s) => s.connection);
  const error = useOfficeStore((s) => s.error);

  useEffect(() => {
    let cancelled = false;
    let game: import("phaser").Game | undefined;

    (async () => {
      try {
        await connect(profile);
      } catch {
        return; // el error queda en el store
      }
      if (cancelled || !gameRef.current) return;
      const { createGame } = await import("@/game/createGame"); // Phaser necesita `window`
      if (cancelled || !gameRef.current) return;
      game = createGame(gameRef.current);
    })();

    return () => {
      cancelled = true;
      game?.destroy(true);
      void disconnect();
    };
  }, [profile, attempt]);

  return (
    <main className="relative h-full w-full overflow-hidden">
      <div ref={gameRef} className="absolute inset-0" />
      {connection === "connected" || connection === "reconnecting" ? (
        <>
          <Hud onExit={onExit} />
          <ChatPanel />
          <p className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 rounded-full bg-ink/70 px-3 py-1 text-xs text-muted xl:block">
            WASD o flechas para caminar · clic para ir a un lugar · Enter para chatear
          </p>
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
              Volver
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
