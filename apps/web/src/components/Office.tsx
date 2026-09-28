"use client";

import { ACTIVITY_PING_MS, AUTO_AWAY, IdleTimer } from "@hyvento/shared";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions";
import { fetchGameToken } from "@/game/gameToken";
import { wakeGameServer } from "@/game/reconexion";
import { ReconnectChip } from "./ReconnectChip";
import { media } from "@/game/media";
import { connect, disconnect, sendActivity, sendIdle } from "@/game/network";
import { useOfficeStore, type Profile } from "@/game/store";
import { getArriveByBus } from "@/lib/arriveByBus";
import { BusTrip } from "./bus/BusTrip";
import { EntryLoader } from "./EntryLoader";
import { useEntryStore } from "@/game/entryStore";
import { waitForCozyFont } from "@/lib/cozy";
import { warmPrerender } from "@/game/iso/prerender-paths";
import { AdminDialog } from "./AdminDialog";
import { ChatPanel } from "./ChatPanel";
import { Hud, PeoplePanel } from "./Hud";
import { MediaControls } from "./MediaControls";
import { ScreenFocus, VideoStrip } from "./VideoStrip";
import { RadioTapPrompt } from "./RoomPanel";
import { SideDock } from "./SideDock";
import { DecorPanel } from "./DecorPanel";
import { WorldEditPanel } from "./WorldEditPanel";
import { DoorPrompt, InvitationRequests, KnockRequests, Notices, SeatPrompt } from "./OfficeOverlays";
import { NotifyPrompt } from "./NotifyPrompt";
import { BoardPanel, InteractPrompt, MailboxPanel } from "./PointsPanels";
import { BarPanel, CafePanel, SnacksPanel } from "./CafePanel";
import { UsablePrompt } from "./UsePrompt";
import { HandActions, Hotbar } from "./bag/Hotbar";
import { PlayerMenu } from "./bag/PlayerMenu";
import { CashierPanel } from "./casino/CashierPanel";
import { BlackjackStrip, RouletteStrip } from "./casino/TableStrip";
import { MesaStrip } from "./casino/MesaStrip";
import { ShopPanel } from "./ShopPanel";
import { FittingPanel } from "./FittingPanel";
import { PhotoFlash, PhotoGallery, PhotoPreview } from "./PhotoPanels";
import { ProfileDialog } from "./ProfileDialog";
import { ArcadePanel } from "./arcade/ArcadePanel";
import { BoardGameStrip } from "./arcade/BoardGameStrip";
import { HockeyStrip } from "./arcade/HockeyStrip";
import { ClubHud } from "./club/ClubHud";
import { DjConsole } from "./club/DjConsole";
import { CinemaHud, CinemaPanel } from "./cinema/CinemaPanel";
import { EscenarioHud, PodcastConsent } from "./escenario/EscenarioHud";
import { WhiteboardPanel } from "./WhiteboardPanel";
import { RacePanel, RaceTimer } from "./RacePanel";
import { AquariumPanel } from "./AquariumPanel";
import { BookReader } from "./BookReader";
import { DoorNotePrompt, DoorNotesChip, DoorNotesPanel, DoorNoteWritePanel } from "./DoorNotesPanels";
import { IncomingCall, PhonePanel } from "./PhonePanels";
import { ShedPanel } from "./ShedPanel";
import { CoopPanel, GrillPanel } from "./GranjaPanels";
import { KitchenPanel } from "./KitchenPanel";
import { DiarioPanel } from "./observatorio/DiarioPanel";
import { MarshmallowStrip } from "./observatorio/MarshmallowStrip";
import { OrreryPanel } from "./observatorio/OrreryPanel";
import { RadarPanel } from "./observatorio/RadarPanel";
import { TelescopePanel } from "./observatorio/TelescopePanel";
import { SombreroPanel } from "./SombreroPanel";
import { PescaPanel } from "./PescaPanel";
import { FishAlbum } from "./fishing/FishAlbum";
import { CatchCard, FishingHint } from "./fishing/FishingHud";
import { SocialOverlays } from "./social/SocialOverlays";
import { AchievementToasts } from "./profile/AchievementToasts";
import { PlayerProfileDialog } from "./profile/PlayerProfileDialog";
import { TrophyPanel } from "./profile/TrophyPanel";
import { useAchievementStore } from "@/game/achievements";

// El PC (con el editor de notas) se descarga recién al prenderlo: no pesa en la carga de la oficina.
const Computer = dynamic(() => import("./pc/Computer").then((m) => m.Computer), { ssr: false });

const RELOAD_FLAG = "hyvento:reloaded-after-update";
/** Cuánto se espera el mapa ya conectado antes de ofrecer "Reintentar". */
const MAP_TIMEOUT_MS = 20_000;

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
  // "Ausente" automático: sin mouse ni teclado un rato, o con la pestaña oculta. El servidor decide el
  // estado (si lo pusiste a mano, o estás en "No molestar", no lo toca) y lo quita al volver.
  useEffect(() => {
    const timer = new IdleTimer(Date.now());
    const report = (changed: boolean) => changed && sendIdle(timer.idle);
    const onInput = () => report(timer.activity(Date.now()));
    const onVisibility = () => report(timer.visibility(document.visibilityState === "hidden", Date.now()));
    onVisibility();
    const events = ["pointerdown", "pointermove", "keydown", "wheel"] as const;
    for (const e of events) window.addEventListener(e, onInput, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    const id = setInterval(() => report(timer.check(Date.now())), AUTO_AWAY.checkMs);
    return () => {
      clearInterval(id);
      for (const e of events) window.removeEventListener(e, onInput);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer.idle) sendIdle(false);
    };
  }, []);
  const error = useOfficeStore((s) => s.error);
  const onExit = () => void logout();
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // La pantalla de carga se va sola (con la cabaña que llega y la puerta que se abre) después del primer
  // cuadro del juego; cada intento la vuelve a mostrar.
  const [loaderGone, setLoaderGone] = useState(false);
  const onLoaderGone = useCallback(() => setLoaderGone(true), []);

  // Conectado pero sin mapa después de un rato: algo se trabó al dibujar. Mejor el error con
  // "Reintentar" que "Entrando…" para siempre (la escena también avisa si el dibujo falla).
  const waitingMap = connection === "connected" && !mapReady;
  useEffect(() => {
    if (!waitingMap) return;
    // Solo cuenta con la pestaña a la vista: en segundo plano el juego espera a propósito (waitForVisible).
    let waited = 0;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      waited += 1000;
      const s = useOfficeStore.getState();
      if (waited >= MAP_TIMEOUT_MS && s.connection === "connected" && !s.mapReady) {
        s.setConnection("error", "La cabaña está tardando demasiado en cargar. Reintenta o recarga la página.");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [waitingMap, attempt]);

  useEffect(() => {
    let cancelled = false;
    let game: import("phaser").Game | undefined;
    // El motor (Phaser, el chunk más pesado) y el arte pre-dibujado se empiezan a bajar ya, a la par del
    // token y la conexión: antes se pedían recién con la sala conectada, uno detrás del otro. El error,
    // si lo hay, se ve abajo al esperarlo.
    setLoaderGone(false);
    // Las etapas de la barra de carga (lib/entry.ts): el token, la conexión y el motor se marcan acá; el
    // arte, el nivel y el primer cuadro, en la escena.
    const entry = useEntryStore.getState();
    entry.reset();
    entry.start("sesion");
    entry.start("motor");
    const gameModule = import("@/game/createGame");
    gameModule.then(() => !cancelled && useEntryStore.getState().done("motor")).catch(() => undefined);
    warmPrerender();
    // A la par del token: despertar al servidor de juego si está dormido (Render free tarda hasta ~1 min).
    entry.start("despertar");
    const awake = wakeGameServer(() => cancelled).finally(() => !cancelled && useEntryStore.getState().done("despertar"));

    (async () => {
      try {
        const token = await fetchGameToken();
        if (cancelled) return;
        useEntryStore.getState().done("sesion");
        await awake;
        if (cancelled) return;
        useEntryStore.getState().start("conexion");
        // "Llegar en bus" (Mi personaje): solo al entrar; al reconectar se sigue donde se estaba.
        await connect({ token, arriveByBus: getArriveByBus() || undefined });
        if (!cancelled) useEntryStore.getState().done("conexion");
      } catch (err) {
        if (!cancelled && useOfficeStore.getState().connection !== "error") {
          useOfficeStore.getState().setConnection("error", err instanceof Error ? err.message : String(err));
        }
        return;
      }
      if (cancelled || !gameRef.current) return;
      try {
        const { createGame, waitForSize, waitForVisible } = await gameModule; // Phaser necesita `window`
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
      // Audio/video: opcional; si LiveKit no está disponible la oficina funciona igual. No conecta todavía:
      // la sala se abre sola cuando hay alguien cerca (LiveKit cobra por minuto conectado).
      media.start();
    })();

    return () => {
      cancelled = true;
      useOfficeStore.getState().setMapReady(false);
      game?.destroy(true);
      void media.stop();
      void disconnect();
    };
  }, [attempt]);

  return (
    <main className="cozy-void relative h-full w-full overflow-hidden font-pixel text-cozy-ink">
      <div ref={gameRef} className="absolute inset-0" />
      {/* Adentro del Megabús en ruta no se ve el mundo: la pantalla del viaje (el HUD queda encima). */}
      {connection === "connected" && <BusTrip />}
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
            className={`pointer-events-none absolute top-3 right-3 z-10 flex flex-col items-end gap-2 ${decorating || worldEditing ? "w-[min(300px,calc(100%-1.5rem))]" : "w-[min(270px,calc(100%-1.5rem))] max-md:w-auto"}`}
          >
            {worldEditing ? <WorldEditPanel /> : decorating ? <DecorPanel /> : <PeoplePanel />}
            {/* En el celular la columna se ajusta a la ficha de conectados y los avisos bajan hasta debajo del HUD. */}
            <div className="flex w-full flex-col items-end gap-2 empty:hidden max-md:absolute max-md:top-[calc(var(--cozy-hud-bottom,3rem)_-_0.25rem)] max-md:right-0 max-md:w-[min(16rem,calc(100vw-1.5rem))]">
              <DoorNotesChip />
              <Notices />
              <NotifyPrompt />
            </div>
          </div>
          <ChatPanel isAdmin={isAdmin} />
          <SideDock />
          {/* Abajo al centro, sobre la barra: los avisos del momento apilados (nunca uno encima de otro). */}
          <div className="pointer-events-none absolute bottom-[var(--cozy-bar-top,7rem)] left-1/2 z-10 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col-reverse items-center gap-2">
            <DoorPrompt />
            <DoorNotePrompt />
            <SeatPrompt />
            <InteractPrompt />
            <MarshmallowStrip />
            <UsablePrompt />
            <FishingHint />
            <RaceTimer />
            <RadioTapPrompt />
            <ClubHud />
            <CinemaHud />
            <EscenarioHud />
          </div>
          {/* Arriba al centro: la reconexión, los logros y el pez recién sacado, uno debajo del otro. */}
          <div className="pointer-events-none absolute top-[calc(var(--cozy-hud-bottom,3.5rem)_+_0.5rem)] left-1/2 z-30 flex w-[min(340px,calc(100%-1.5rem))] -translate-x-1/2 flex-col items-center gap-2">
            {connection === "reconnecting" && <ReconnectChip />}
            <AchievementToasts />
            <CatchCard />
          </div>
          <KnockRequests />
          <InvitationRequests />
          <PodcastConsent />
          <IncomingCall />
          <SocialOverlays />
          {/* Abajo al centro: los botones y la fila de la mochila (lo elegido va en la mano). */}
          <MediaControls actions={<HandActions />} tail={<ControlsHint />}>
            <Hotbar />
          </MediaControls>
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
          {(panel?.kind === "baccarat" || panel?.kind === "dados" || panel?.kind === "caballos") && <MesaStrip table={panel.kind} />}
          {panel?.kind === "shop" && <ShopPanel atObject={panel.atObject} onClose={closePanel} />}
          {panel?.kind === "backpack" && (
            <PlayerMenu
              profile={profile}
              onClose={closePanel}
              onEditCharacter={() => {
                closePanel();
                setDialog("character");
              }}
            />
          )}
          {panel?.kind === "fishAlbum" && <FishAlbum onClose={closePanel} />}
          {panel?.kind === "photos" && <PhotoGallery onClose={closePanel} />}
          {panel?.kind === "trophies" && <TrophyPanel onClose={closePanel} />}
          <PhotoPreview />
          <PhotoFlash />
          <BookReader />
          {panel?.kind === "fitting" && (
            <FittingPanel profile={profile} atObject={panel.atObject} onClose={closePanel} onSaved={onProfileChange} />
          )}
          {panel?.kind === "dj" && <DjConsole atObject={panel.atObject} onClose={closePanel} />}
          {panel?.kind === "cinema" && <CinemaPanel onClose={closePanel} />}
          {panel?.kind === "snacks" && <SnacksPanel atObject={panel.atObject} onClose={closePanel} />}
          {panel?.kind === "arcade" && <ArcadePanel onClose={closePanel} />}
          {/* El hockey de mesa también se juega sobre la mesa: solo la tira de abajo. */}
          {panel?.kind === "hockey" && <HockeyStrip />}
          {/* Ajedrez y damas: la cámara mira la mesa y el tablero va en la tira de abajo. */}
          {panel?.kind === "boardgame" && <BoardGameStrip />}
          {panel?.kind === "whiteboard" && <WhiteboardPanel onClose={closePanel} />}
          {panel?.kind === "race" && <RacePanel atObject={panel.atObject} onClose={closePanel} />}
          {panel?.kind === "aquarium" && <AquariumPanel onClose={closePanel} />}
          {panel?.kind === "doorNote" && <DoorNoteWritePanel onClose={closePanel} />}
          {panel?.kind === "doorNotes" && <DoorNotesPanel onClose={closePanel} />}
          {panel?.kind === "phone" && <PhonePanel onClose={closePanel} />}
          {panel?.kind === "shed" && <ShedPanel atObject={panel.atObject} onClose={closePanel} />}
          {panel?.kind === "grill" && <GrillPanel atObject={panel.atObject} onClose={closePanel} />}
          {panel?.kind === "coop" && <CoopPanel onClose={closePanel} />}
          {panel?.kind === "kitchen" && <KitchenPanel atObject={panel.atObject} onClose={closePanel} />}
          {panel?.kind === "telescope" && <TelescopePanel onClose={closePanel} />}
          {panel?.kind === "orrery" && <OrreryPanel onClose={closePanel} />}
          {panel?.kind === "radar" && <RadarPanel onClose={closePanel} />}
          {panel?.kind === "logbook" && <DiarioPanel onClose={closePanel} />}
          {panel?.kind === "sombrero" && <SombreroPanel atObject={panel.atObject} onClose={closePanel} />}
          {panel?.kind === "pesca" && <PescaPanel atObject={panel.atObject} onClose={closePanel} />}
        </>
      ) : null}


      {(connection === "error" || !loaderGone) && (
        <EntryLoader
          key={attempt}
          profile={profile}
          error={connection === "error" ? (error ?? "Algo salió mal.") : null}
          onRetry={retry}
          onExit={onExit}
          onGone={onLoaderGone}
        />
      )}
    </main>
  );
}

/** Teclas del juego y del editor: se muestran en la lista de controles. */
const CONTROLS: [string, string][] = [
  ["WASD", "caminar (o clic en el piso)"],
  ["E", "sentarte o usar"],
  ["F", "usar lo de la mano"],
  ["T", "emotes"],
  ["P", "foto"],
  ["N", "nombres: completos, cortos u ocultos"],
  ["Enter", "chatear"],
  ["Tab", "cambiar la fila de la barra"],
  ["1-9 0 - =", "elegir la casilla (la mano)"],
  ["I", "mochila, stats y personaje"],
  ["/time", "la hora del juego (/ muestra los comandos)"],
];
const DECOR_CONTROLS: [string, string][] = [
  ["Clic", "poner o elegir"],
  ["R", "girar"],
  ["Supr", "guardar"],
  ["Esc", "soltar o terminar"],
];

/**
 * Recordatorio de controles: un botón "?" chico al final de la barra de abajo que abre la lista hacia
 * arriba. Antes era un chip suelto en la esquina y chocaba con la barra en pantallas medianas.
 */
function ControlsHint() {
  const decorating = useOfficeStore((s) => s.decorating);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  const rows = decorating ? DECOR_CONTROLS : CONTROLS;
  const label = decorating ? "Teclas del editor" : "Controles";
  return (
    <div ref={box} className="relative max-md:hidden">
      {open && (
        <div id="lista-controles" className="cozy-panel absolute right-0 bottom-full mb-3 w-64 px-3 py-2.5">
          <p className="mb-1.5 text-[12px] text-cozy-ink-soft">{decorating ? "Decorando" : "Controles"}</p>
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {rows.map(([key, what]) => (
              <li key={key} className="flex items-center gap-2">
                <kbd className="cozy-kbd min-w-[3.25rem] text-center">{key}</kbd>
                <span>{what}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="lista-controles"
        aria-label={label}
        title={label}
        className="cozy-btn size-9 p-0 text-[15px] font-semibold text-cozy-ink-soft"
      >
        ?
      </button>
    </div>
  );
}
