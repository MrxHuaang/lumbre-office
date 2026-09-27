"use client";

import { ACTIVITY_PING_MS } from "@hyvento/shared";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions";
import { media } from "@/game/media";
import { connect, disconnect, sendActivity } from "@/game/network";
import { useOfficeStore, type Profile } from "@/game/store";
import { EntryLoader } from "./EntryLoader";
import { waitForCozyFont } from "@/lib/cozy";
import { AdminDialog } from "./AdminDialog";
import { ChatPanel } from "./ChatPanel";
import { Hud, PeoplePanel } from "./Hud";
import { MediaControls } from "./MediaControls";
import { ScreenFocus, VideoStrip } from "./VideoStrip";
import { MyOfficePanel } from "./MyOfficePanel";
import { DecorPanel } from "./DecorPanel";
import { WorldEditPanel } from "./WorldEditPanel";
import { DoorPrompt, KnockRequests, Notices, SeatPrompt } from "./OfficeOverlays";
import { BoardPanel, InteractPrompt, MailboxPanel } from "./PointsPanels";
import { BarPanel, CafePanel } from "./CafePanel";
import { HeldSlot, UsablePrompt } from "./UsePrompt";
import { CashierPanel } from "./casino/CashierPanel";
import { BlackjackStrip, RouletteStrip } from "./casino/TableStrip";
import { BackpackPanel, ShopPanel } from "./ShopPanel";
import { FittingPanel } from "./FittingPanel";
import { PhotoFlash, PhotoGallery, PhotoPreview } from "./PhotoPanels";
import { ProfileDialog } from "./ProfileDialog";
import { ArcadePanel } from "./arcade/ArcadePanel";
import { ClubHud } from "./club/ClubHud";
import { DjConsole } from "./club/DjConsole";
import { CozyOverlay, CozyTitle } from "./Cozy";
import { FishAlbum } from "./fishing/FishAlbum";
import { FishingHud } from "./fishing/FishingHud";
import { SocialOverlays } from "./social/SocialOverlays";
import { AchievementToasts } from "./profile/AchievementToasts";
import { PlayerProfileDialog } from "./profile/PlayerProfileDialog";
import { useAchievementStore } from "@/game/achievements";

// El PC (con el editor de notas) se descarga recién al prenderlo: no pesa en la carga de la oficina.
const Computer = dynamic(() => import("./pc/Computer").then((m) => m.Computer), { ssr: false });

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
  useOfficeStore.getState().setConnection("error", "No se pudo cargar la cabaña. Recarga la página.");
}

async function fetchGameToken(): Promise<string> {
  const res = await fetch("/api/game-token", { cache: "no-store" });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }
  const body = (await res.json().catch(() => null)) as { token?: string; error?: string } | null;
  if (!res.ok || !body?.token) throw new Error(body?.error ?? "No se pudo obtener el acceso a la cabaña");
  return body.token;
}

interface OfficeProps {
  isAdmin: boolean;
  profile: Profile;
  onProfileChange: (p: Profile) => void;
}

/** Ventanas que se abren sobre la oficina sin salir de la sala. */
type Dialog = "profile" | "character" | "admin" | null;

export function Office({ isAdmin, profile, onProfileChange }: OfficeProps) {
  const gameRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const pcOn = useOfficeStore((s) => s.pcOn);
  const atComputer = useOfficeStore((s) => s.atComputer);
  const setPcOn = useOfficeStore((s) => s.setPcOn);

  // Si dejas de estar frente al computador (p. ej. el servidor te levantó), el PC se apaga.
  useEffect(() => {
    if (pcOn && !atComputer) setPcOn(false);
  }, [pcOn, atComputer, setPcOn]);
  // Al salir de la oficina el PC queda apagado.
  useEffect(() => () => useOfficeStore.getState().setPcOn(false), []);
  const panel = useOfficeStore((s) => s.panel);
  const closePanel = useOfficeStore((s) => s.closePanel);
  const connection = useOfficeStore((s) => s.connection);
  const mapReady = useOfficeStore((s) => s.mapReady);
  const decorating = useOfficeStore((s) => s.decorating);
  const worldEditing = useOfficeStore((s) => s.worldEditing);
  const profileId = useAchievementStore((s) => s.profileId);
  const closeProfile = useAchievementStore((s) => s.closeProfile);
  // Al salir de la cabaña no queda un perfil abierto para la próxima vez.
  useEffect(() => () => useAchievementStore.getState().closeProfile(), []);

  // Actividad real (mouse, teclado): cuenta para los puntos de presencia. Como mucho un aviso por minuto.
  useEffect(() => {
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last < ACTIVITY_PING_MS) return;
      last = now;
      sendActivity();
    };
    const events = ["pointerdown", "pointermove", "keydown", "wheel"] as const;
    for (const e of events) window.addEventListener(e, onActivity, { passive: true });
    return () => {
      for (const e of events) window.removeEventListener(e, onActivity);
    };
  }, []);
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
        await waitForCozyFont();
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
      useOfficeStore.getState().setMapReady(false);
      game?.destroy(true);
      void media.disconnect();
      void disconnect();
    };
  }, [attempt]);

  return (
    <main className="cozy-void relative h-full w-full overflow-hidden font-pixel text-cozy-ink">
      <div ref={gameRef} className="absolute inset-0" />
      {connection === "connected" || connection === "reconnecting" ? (
        <>
          <Hud
            isAdmin={isAdmin}
            onEditProfile={() => setDialog("profile")}
            onEditCharacter={() => setDialog("character")}
            onMyProfile={() => useAchievementStore.getState().openProfile("me")}
            onAdmin={() => setDialog("admin")}
            onLogout={onExit}
          />
          {/* Decorando tu oficina, el panel del editor toma el lugar de los conectados. */}
          <div
            className={`pointer-events-none absolute top-3 right-3 z-10 flex flex-col items-end gap-3 ${decorating || worldEditing ? "w-[min(300px,calc(100%-1.5rem))]" : "w-[min(270px,calc(100%-1.5rem))] max-md:w-44"}`}
          >
            {worldEditing ? <WorldEditPanel /> : decorating ? <DecorPanel /> : <PeoplePanel />}
            <Notices />
          </div>
          <ChatPanel />
          <MyOfficePanel />
          <DoorPrompt />
          <SeatPrompt />
          <InteractPrompt />
          <UsablePrompt />
          <ClubHud />
          <KnockRequests />
          <AchievementToasts />
          <FishingHud />
          <SocialOverlays />
          <MediaControls>
            <HeldSlot />
          </MediaControls>
          <ControlsHint />
          <VideoStrip />
          <ScreenFocus />
          {pcOn && <Computer profile={profile} onOff={() => setPcOn(false)} />}
          {(dialog === "profile" || dialog === "character") && (
            <ProfileDialog profile={profile} withName={dialog === "profile"} onClose={closeDialog} onSaved={onProfileChange} />
          )}
          {dialog === "admin" && <AdminDialog onClose={closeDialog} />}
          {profileId && !dialog && (
            <PlayerProfileDialog
              userId={profileId}
              onClose={closeProfile}
              onEditProfile={() => {
                closeProfile();
                setDialog("profile");
              }}
            />
          )}
          {panel?.kind === "mailbox" && <MailboxPanel atObject={panel.atObject} onClose={closePanel} />}
          {panel?.kind === "board" && <BoardPanel onClose={closePanel} />}
          {panel?.kind === "cafe" && <CafePanel atObject={panel.atObject} onClose={closePanel} />}
          {/* La ruleta y el blackjack se juegan sobre la mesa (modo mesa): solo queda la tira de abajo. */}
          {panel?.kind === "roulette" && <RouletteStrip />}
          {panel?.kind === "bar" && <BarPanel atObject={panel.atObject} onClose={closePanel} />}
          {panel?.kind === "cashier" && <CashierPanel onClose={closePanel} />}
          {panel?.kind === "blackjack" && <BlackjackStrip />}
          {panel?.kind === "shop" && <ShopPanel atObject={panel.atObject} onClose={closePanel} />}
          {panel?.kind === "backpack" && <BackpackPanel onClose={closePanel} />}
          {panel?.kind === "fishAlbum" && <FishAlbum onClose={closePanel} />}
          {panel?.kind === "photos" && <PhotoGallery onClose={closePanel} />}
          <PhotoPreview />
          <PhotoFlash />
          {panel?.kind === "fitting" && (
            <FittingPanel profile={profile} atObject={panel.atObject} onClose={closePanel} onSaved={onProfileChange} />
          )}
          {panel?.kind === "dj" && <DjConsole atObject={panel.atObject} onClose={closePanel} />}
          {panel?.kind === "arcade" && <ArcadePanel onClose={closePanel} />}
        </>
      ) : null}

      {connection === "reconnecting" && (
        <div className="cozy-chip absolute top-16 left-1/2 z-20 -translate-x-1/2 px-3.5 py-1.5 text-[13px]">Reconectando…</div>
      )}

      {(connection === "connecting" || connection === "idle" || (connection === "connected" && !mapReady)) && (
        <CozyOverlay>
          <EntryLoader profile={profile} />
        </CozyOverlay>
      )}

      {connection === "error" && (
        <CozyOverlay>
          <div className="cozy-panel flex max-w-md flex-col items-center px-8 py-7 text-center">
            <p className="text-[26px] font-semibold">Uy.</p>
            <p className="mt-3 text-[15px] leading-relaxed">{error ?? "Algo salió mal."}</p>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={() => setAttempt((n) => n + 1)} className="cozy-btn cozy-btn-primary px-5 py-2.5 text-[15px]">
                Reintentar
              </button>
              <button onClick={onExit} className="cozy-btn px-5 py-2.5 text-[15px]">
                Cerrar sesión
              </button>
            </div>
          </div>
        </CozyOverlay>
      )}
    </main>
  );
}

/** Recordatorio de controles (abajo a la derecha, solo en pantallas anchas). */
function ControlsHint() {
  const decorating = useOfficeStore((s) => s.decorating);
  return (
    <div className="cozy-chip absolute right-3 bottom-4 hidden px-2.5 py-1.5 text-[12px] text-cozy-ink-soft xl:block">
      {decorating
        ? "Clic para poner o elegir · R para girar · Supr para guardar · Esc para soltar o terminar"
        : "WASD / flechas · clic para caminar · E sentarte o usar · F lo de la mano · T emotes · P foto · Enter chatear"}
    </div>
  );
}
