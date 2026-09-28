"use client";

// El escenario y el estudio de grabación en el HUD (van en la pila de avisos de abajo):
// - en las gradas: aplaudir, levantar o bajar la mano y, si me dieron la palabra, devolverla;
// - en la tarima: la fila de turnos con "Dar la palabra", quién la tiene y bajar del escenario;
// - en el estudio: grabar (pide permiso a todos), el estado "EN EL AIRE" con su reloj y detener.
// El diálogo del permiso para grabar va aparte, bien a la vista (`PodcastConsent`).
import type { HandView } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { sendClap, sendFloor, sendHand, sendPodcastConsent, sendPodcastStart, sendPodcastStop, sendStage } from "@/game/escenario/net";
import { useEscenarioStore } from "@/game/escenario/store";
import { useMediaStore } from "@/game/media";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";

const useMyUserId = () => useOfficeStore((s) => selectMyUserId(s));

export function EscenarioHud() {
  const here = useEscenarioStore((s) => s.here);
  const panel = useOfficeStore((s) => s.panel);
  const pcOn = useOfficeStore((s) => s.pcOn);
  if (panel || pcOn) return null;
  if (here.onStage) return <StageControls />;
  if (here.inSeats) return <SeatsControls />;
  if (here.inBooth) return <BoothControls />;
  return null;
}

/** En las gradas: aplaudir, la mano y la palabra. */
function SeatsControls() {
  const me = useMyUserId();
  const { hands, floor } = useEscenarioStore(useShallow((s) => ({ hands: s.hands, floor: s.floor })));
  const turn = hands.findIndex((h) => h.userId === me);
  const hasFloor = floor !== "" && floor === me;
  return (
    <div className="cozy-chip pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 px-2 py-1.5 text-[13px]">
      <ClapButton />
      {hasFloor ? (
        <>
          <span className="px-1.5 text-[#5ea247]">Tienes la palabra: todos te oyen</span>
          <button type="button" onClick={() => sendFloor(null)} className="cozy-btn px-2.5 py-1 text-[13px]">
            Devolver la palabra
          </button>
        </>
      ) : turn >= 0 ? (
        <button type="button" onClick={() => sendHand(false)} aria-pressed className="cozy-btn flex items-center gap-1.5 px-2.5 py-1 text-[13px]">
          <PixelIcon name="hand" size={14} />
          Bajar la mano · turno {turn + 1}
        </button>
      ) : (
        <button type="button" onClick={() => sendHand(true)} className="cozy-btn flex items-center gap-1.5 px-2.5 py-1 text-[13px]">
          <PixelIcon name="hand" size={14} />
          Levantar la mano
        </button>
      )}
    </div>
  );
}

function ClapButton() {
  return (
    <button type="button" onClick={() => sendClap()} className="cozy-btn cozy-btn-primary flex items-center gap-1.5 px-2.5 py-1 text-[13px]">
      <PixelIcon name="clap" size={14} />
      Aplaudir
    </button>
  );
}

/** En la tarima: la fila de turnos (quien la ve decide a quién darle la palabra) y bajar. */
function StageControls() {
  const { hands, floor, floorName } = useEscenarioStore(useShallow((s) => ({ hands: s.hands, floor: s.floor, floorName: s.floorName })));
  const sharing = useMediaStore((s) => s.screen);
  return (
    <div className="cozy-panel pointer-events-auto flex w-[min(360px,calc(100vw-1.5rem))] flex-col gap-2 px-3 py-2.5 text-[13px]">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">En el escenario: todo el anfiteatro te oye</p>
        <button type="button" onClick={() => sendStage(false)} className="cozy-btn shrink-0 px-2 py-0.5 text-[12px]">
          Bajar
        </button>
      </div>
      <p className="text-[12px] text-cozy-ink-soft">
        {sharing ? "Tu pantalla se ve en la pantalla grande." : "Comparte tu pantalla con el botón de la barra y se verá en la pantalla grande."}
      </p>
      {floor && (
        <div className="flex items-center justify-between gap-2 border-2 border-cozy-frame bg-cozy-paper-dark px-2 py-1">
          <span>
            Tiene la palabra: <strong>{floorName}</strong>
          </span>
          <button type="button" onClick={() => sendFloor(null)} className="cozy-btn px-2 py-0.5 text-[12px]">
            Quitar
          </button>
        </div>
      )}
      <HandsQueue hands={hands} />
      <div className="flex justify-center">
        <ClapButton />
      </div>
    </div>
  );
}

function HandsQueue({ hands }: { hands: HandView[] }) {
  if (!hands.length) return <p className="text-[12px] text-cozy-ink-soft">Nadie ha levantado la mano.</p>;
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[12px] text-cozy-ink-soft">
        <PixelIcon name="hand" size={12} />
        Manos levantadas, en orden
      </p>
      <ol className="cozy-scroll flex max-h-36 flex-col gap-1 overflow-y-auto">
        {hands.map((h, i) => (
          <li key={h.userId} className="flex items-center justify-between gap-2">
            <span className="truncate">
              <span className="text-cozy-ink-soft">{i + 1}.</span> {h.name}
            </span>
            <button type="button" onClick={() => sendFloor(h.userId)} className="cozy-btn shrink-0 px-2 py-0.5 text-[12px]">
              Dar la palabra
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Reloj de la grabación (mm:ss desde `since`, con la hora del navegador). */
function useElapsed(since: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);
  const ms = since ? Math.max(0, now - since) : 0;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Adentro del estudio: grabar, esperar los permisos o el "EN EL AIRE". */
function BoothControls() {
  const me = useMyUserId();
  const podcast = useEscenarioStore((s) => s.podcast);
  const recording = useEscenarioStore((s) => s.recording);
  const names = useOfficeStore(useShallow((s) => Object.fromEntries(Object.values(s.players).map((p) => [p.userId, p.name]))));
  const audio = useMediaStore((s) => s.status === "connected");
  const [startedHere, setStartedHere] = useState(0);
  useEffect(() => {
    if (podcast.phase === "recording") setStartedHere((t) => t || Date.now());
    else setStartedHere(0);
  }, [podcast.phase]);
  const clock = useElapsed(startedHere);

  if (podcast.phase === "recording")
    return (
      <div className="cozy-chip pointer-events-auto flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 text-[13px]">
        <PixelIcon name="record" size={12} color="var(--color-cozy-red)" className="animate-pulse" />
        <strong className="text-cozy-red">EN EL AIRE</strong>
        <span className="tabular-nums">{clock}</span>
        <span className="text-cozy-ink-soft">{podcast.host === me ? (recording ? "· se graba en tu navegador" : "· preparando…") : `· graba ${podcast.hostName}`}</span>
        <button type="button" onClick={() => sendPodcastStop()} className="cozy-btn cozy-btn-danger px-2.5 py-1 text-[13px]">
          Detener
        </button>
      </div>
    );
  if (podcast.phase === "asking") {
    const waiting = Object.entries(podcast.consents)
      .filter(([, ok]) => !ok)
      .map(([id]) => names[id] ?? "alguien");
    return (
      <div className="cozy-chip pointer-events-auto flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 text-[13px]">
        <span>Esperando el permiso de: {waiting.join(", ") || "…"}</span>
        <button type="button" onClick={() => sendPodcastStop()} className="cozy-btn px-2.5 py-1 text-[13px]">
          Cancelar
        </button>
      </div>
    );
  }
  return (
    <div className="cozy-chip pointer-events-auto flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 text-[13px]">
      <span>Estudio de grabación · solo se graba si todos los de adentro aceptan</span>
      <button
        type="button"
        onClick={() => (audio ? sendPodcastStart() : useOfficeStore.getState().notify("Para grabar hay que tener el audio conectado.", "warning"))}
        className="cozy-btn cozy-btn-primary flex items-center gap-1.5 px-2.5 py-1 text-[13px]"
      >
        <PixelIcon name="record" size={12} color="var(--color-cozy-red)" />
        Grabar
      </button>
    </div>
  );
}

/**
 * El permiso para grabar: a cada persona del estudio que todavía no respondió, bien a la vista. La voz
 * de nadie se graba sin que acepte aquí.
 */
export function PodcastConsent() {
  const me = useMyUserId();
  const podcast = useEscenarioStore((s) => s.podcast);
  const inBooth = useEscenarioStore((s) => s.here.inBooth);
  if (!inBooth || podcast.phase !== "asking" || !me || podcast.consents[me] !== false) return null;
  return (
    <div className="absolute top-1/3 left-1/2 z-20 w-[min(380px,calc(100%-1.5rem))] -translate-x-1/2">
      <div role="alertdialog" aria-labelledby="podcast-permiso" className="cozy-panel px-5 py-4">
        <p id="podcast-permiso" className="flex items-center gap-2 text-[15px] font-semibold">
          <PixelIcon name="record" size={14} color="var(--color-cozy-red)" />
          ¿Grabamos?
        </p>
        <p className="mt-2 text-[14px] leading-relaxed">
          <strong>{podcast.hostName}</strong> quiere grabar la conversación del estudio. Es solo audio: el archivo se arma y se
          guarda en el computador de {podcast.hostName}, no en el servidor. Puedes detenerla cuando quieras.
        </p>
        <p className="mt-2 text-[14px]">¿Aceptas que se grabe tu voz?</p>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={() => sendPodcastConsent(true)} className="cozy-btn cozy-btn-primary">
            Sí, acepto
          </button>
          <button type="button" onClick={() => sendPodcastConsent(false)} className="cozy-btn">
            No, gracias
          </button>
        </div>
      </div>
    </div>
  );
}
