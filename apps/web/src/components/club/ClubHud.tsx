"use client";

// En el club, lo del momento (va en la pila de avisos de abajo): el botón "Bailar" y los pasos cuando
// estás parado sobre la pista con música, "Soltar el tubo" mientras bailas en el tubo y "Activar el
// sonido" si el navegador no dejó sonar el video. Junto a la tarima, con alguien en el tubo, "Tirar
// billetes" y el selector de montos. Lo que suena, las reacciones, la cola y el volumen
// están en el panel lateral (ClubDock).
import { drawBill } from "@hyvento/map/art";
import { DANCE_MOVES, isPlaying, TIP_AMOUNTS, type DanceMoveId, type TipAmount } from "@hyvento/shared";
import { useShallow } from "zustand/react/shallow";
import { tapVideos } from "@/game/youtube";
import { sendClubDance, sendClubPole, sendClubTip } from "@/game/club/net";
import { useClubStore } from "@/game/club/store";
import { useOfficeStore } from "@/game/store";
import { ArtImage } from "../casino/PixelArt";
import { useMyPoints } from "../PointsPanels";
import { PixelIcon } from "../Cozy";

export function ClubHud() {
  const here = useClubStore((s) => s.here);
  const music = useClubStore(useShallow((s) => ({ track: s.track, video: s.video, paused: s.paused, startedAt: s.startedAt, pausedAt: s.pausedAt })));
  const needsTap = useClubStore((s) => s.needsTap);
  const myMove = useClubStore((s) => {
    const id = useOfficeStore.getState().sessionId;
    const d = id ? s.dancers[id] : undefined;
    return d?.kind === "floor" ? (d.move as DanceMoveId) : null;
  });
  const chosen = useClubStore((s) => s.move);
  const panel = useOfficeStore((s) => s.panel);
  const pcOn = useOfficeStore((s) => s.pcOn);
  if (!here.inClub || panel || pcOn) return null;
  const playing = isPlaying(music);

  const dance = (move: DanceMoveId) => {
    useClubStore.getState().setMove(move);
    sendClubDance(move);
  };

  return (
    <div className="pointer-events-auto flex w-max max-w-full flex-col items-center gap-1.5 font-pixel">
      {here.dancing === "pole" && (
        <button type="button" onClick={() => sendClubPole(false)} className="cozy-chip flex items-center gap-2 px-3 py-1.5 text-[14px]">
          <kbd className="cozy-kbd">Esc</kbd>
          Soltar el tubo
        </button>
      )}
      {here.tipTarget && here.dancing !== "pole" && <TipPicker target={here.tipTarget} />}
      {here.onFloor && here.dancing !== "pole" && playing && (
        <div className="cozy-chip flex flex-wrap items-center justify-center gap-1.5 px-2 py-1.5 text-[13px]">
          {myMove ? (
            <button type="button" onClick={() => sendClubDance(null)} className="cozy-btn px-2.5 py-1 text-[13px]">
              <kbd className="cozy-kbd mr-1.5">E</kbd>
              Dejar de bailar
            </button>
          ) : (
            <button type="button" onClick={() => dance(chosen)} className="cozy-btn cozy-btn-primary px-2.5 py-1 text-[13px]">
              <kbd className="cozy-kbd mr-1.5">E</kbd>
              Bailar
            </button>
          )}
          {DANCE_MOVES.map((m) => (
            <button key={m.id} type="button" onClick={() => dance(m.id)} aria-pressed={(myMove ?? chosen) === m.id} className="cozy-btn px-2 py-1 text-[12px]">
              {m.name}
            </button>
          ))}
        </div>
      )}
      {here.onFloor && !playing && <p className="cozy-chip px-3 py-1 text-[12px]">Para bailar, pon música en la cabina del DJ.</p>}
      {needsTap && (
        <button type="button" onClick={() => tapVideos()} className="cozy-btn cozy-btn-primary px-3 py-1.5 text-[13px]">
          <span className="inline-flex items-center gap-1">
            <PixelIcon name="play" size={11} /> Activar el sonido del video
          </span>
        </button>
      )}
    </div>
  );
}

/** Tirarle billetes a quien baila en el tubo: el botón con E y, al abrirlo, los cuatro montos. */
function TipPicker({ target }: { target: string }) {
  const name = useOfficeStore((s) => s.players[target]?.name ?? "quien baila");
  const open = useClubStore((s) => s.tipOpen);
  const chosen = useClubStore((s) => s.tipAmount);
  const points = useMyPoints();
  const toggle = () => useClubStore.getState().setTipOpen(!open);
  const tip = (amount: TipAmount) => {
    useClubStore.getState().setTipAmount(amount);
    sendClubTip(target, amount);
  };
  if (!open)
    return (
      <button type="button" onClick={toggle} className="cozy-chip flex items-center gap-2 px-3 py-1.5 text-[14px]">
        <kbd className="cozy-kbd">E</kbd>
        <ArtImage id="billete-5-0" make={() => drawBill(5)} scale={2} alt="" />
        Tirar billetes a {name}
      </button>
    );
  return (
    <div className="cozy-chip flex flex-wrap items-center justify-center gap-1.5 px-2 py-1.5 text-[13px]" role="group" aria-label={`Tirar billetes a ${name}`}>
      {TIP_AMOUNTS.map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => tip(amount)}
          disabled={points < amount}
          aria-pressed={chosen === amount}
          title={points < amount ? "No te alcanzan los puntos" : `Tirar ${amount} a ${name}`}
          className="cozy-btn flex items-center gap-1.5 px-2 py-1 text-[13px] disabled:opacity-50"
        >
          <ArtImage id={`billete-${amount}-0`} make={() => drawBill(amount)} scale={2} alt="" />
          {amount}
        </button>
      ))}
      <span className="px-1 text-[11px] opacity-75">clic sobre {name}: 1</span>
      <button type="button" onClick={toggle} className="cozy-btn px-2 py-1 text-[12px]" aria-label="Cerrar los billetes">
        <kbd className="cozy-kbd">E</kbd>
      </button>
    </div>
  );
}
