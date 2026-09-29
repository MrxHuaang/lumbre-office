"use client";

// Lo que se ve de la comunicación rápida (game/comunicacion.ts): el saludo que te llega ("X te saluda",
// con Ir y Llamar), el aviso grande para toda la cabaña y el panel para anunciar (texto y voz; permiso
// `anunciar`). Los chips del HUD (seguir y anunciando) están en ComunicacionChips.tsx.
import { announcementTime, broadcastLeft, COMUNICACION, type WaveEvent } from "@hyvento/shared";
import { useEffect, useRef, useState } from "react";
import {
  announce,
  callBackWave,
  dismissAnnouncement,
  dismissWave,
  goToWave,
  openAnnounce,
  startBroadcast,
  stopBroadcast,
  useComStore,
} from "@/game/comunicacion";
import { usePuedo } from "@/game/permisos";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";
import { PanelShell } from "../PointsPanels";

export function ComunicacionOverlays() {
  const announceOpen = useComStore((s) => s.announceOpen);
  // Quien tenga el permiso `anunciar` (los admins siempre); el servidor lo valida igual.
  const announcer = usePuedo("anunciar");
  return (
    <>
      <AnnouncementBanner />
      <WaveNotices />
      {announcer && announceOpen && <AnnouncePanel onClose={() => openAnnounce(false)} />}
    </>
  );
}

/** Los saludos que me llegan: un papelito suave abajo a la izquierda, sin tapar el centro. */
function WaveNotices() {
  const waves = useComStore((s) => s.waves);
  if (waves.length === 0) return null;
  return (
    <div className="pointer-events-none absolute bottom-[calc(var(--cozy-bar-top,7rem)_+_0.5rem)] left-3 z-20 flex w-[min(320px,calc(100%-1.5rem))] flex-col gap-2">
      {waves.map((w) => (
        <WaveCard key={w.waveId} wave={w} />
      ))}
    </div>
  );
}

function WaveCard({ wave }: { wave: WaveEvent }) {
  return (
    <div role="status" aria-label={`${wave.fromName} te saluda`} className="cozy-panel pointer-events-auto px-4 py-3 motion-safe:animate-[cozy-pop_0.18s_steps(3)]">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center border-2 border-cozy-frame bg-cozy-paper-light motion-safe:animate-[cozy-ring_0.25s_steps(2)_6_alternate]">
          <PixelIcon name="wave" size={16} color="var(--color-cozy-wood)" />
        </span>
        <p className="min-w-0 flex-1 text-[15px]">
          <strong>{wave.fromName}</strong> te saluda
        </p>
        <button type="button" onClick={() => dismissWave(wave.waveId)} className="cozy-hit p-1 opacity-70 hover:opacity-100" aria-label="Cerrar el saludo">
          <PixelIcon name="close" size={11} color="var(--color-cozy-wood)" />
        </button>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <button type="button" onClick={() => goToWave(wave)} className="cozy-btn cozy-btn-primary">
          <PixelIcon name="steps" size={13} />
          Ir
        </button>
        <button type="button" onClick={() => callBackWave(wave)} className="cozy-btn">
          <PixelIcon name="phone" size={13} />
          Llamar
        </button>
      </div>
    </div>
  );
}

/** El aviso para toda la cabaña: grande, arriba al centro, con quién y a qué hora. Se va solo o con "Entendido". */
function AnnouncementBanner() {
  const a = useComStore((s) => s.announcement);
  if (!a) return null;
  return (
    <div className="pointer-events-none absolute top-[calc(var(--cozy-hud-bottom,3.5rem)_+_0.75rem)] left-1/2 z-40 w-[min(520px,calc(100%-1.5rem))] -translate-x-1/2">
      <section role="alert" aria-label={`Aviso de ${a.fromName}`} className="cozy-panel pointer-events-auto p-1.5">
        <header className="flex items-center gap-2 bg-cozy-wood px-3 py-1.5 text-cozy-paper-light">
          <PixelIcon name="megaphone" size={16} />
          <span className="flex-1 truncate text-[14px] font-semibold">Aviso para toda la cabaña</span>
          <span className="shrink-0 text-[12px] tabular-nums opacity-90">{announcementTime(a.at)}</span>
        </header>
        <p className="px-3 pt-3 text-[19px] leading-snug break-words">{a.text}</p>
        <footer className="flex items-center justify-between gap-3 px-3 pt-2 pb-2">
          <span className="truncate text-[13px] text-cozy-ink-soft">— {a.fromName}</span>
          <button type="button" onClick={dismissAnnouncement} className="cozy-btn shrink-0 py-0.5 text-[13px]">
            Entendido
          </button>
        </footer>
      </section>
    </div>
  );
}

/** Panel para anunciar (permiso `anunciar`): un aviso de texto para todos y la voz a toda la cabaña (con tope de tiempo). */
function AnnouncePanel({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const broadcast = useComStore((s) => s.broadcast);
  const me = useOfficeStore(selectMyUserId);
  const mine = broadcast?.userId === me;
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => input.current?.focus(), []);
  const send = () => {
    if (!text.trim()) return;
    announce(text);
    setText("");
    onClose();
  };
  const minutes = Math.round(COMUNICACION.broadcastMaxMs / 60_000);
  return (
    <PanelShell title="Anuncio a toda la cabaña" icon="megaphone" onClose={onClose}>
      <label htmlFor="com-anuncio" className="mb-1.5 block text-[14px] font-semibold">
        Aviso de texto
      </label>
      <p className="mb-2 text-[13px] text-cozy-ink-soft">Le sale en grande a todos los conectados, estén en el nivel que estén, con tu nombre y la hora.</p>
      <textarea
        id="com-anuncio"
        ref={input}
        value={text}
        maxLength={COMUNICACION.announceMaxChars}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Ej.: En 10 minutos nos vemos en el escenario del jardín."
        className="cozy-input w-full resize-none"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[12px] text-cozy-ink-soft tabular-nums">
          {text.length}/{COMUNICACION.announceMaxChars}
        </span>
        <button type="button" onClick={send} disabled={!text.trim()} className="cozy-btn cozy-btn-primary">
          <PixelIcon name="megaphone" size={14} />
          Mandar aviso
        </button>
      </div>

      <hr className="my-4 border-t-2 border-dashed border-cozy-paper-dark" />

      <p className="mb-1.5 text-[14px] font-semibold">Hablar por voz</p>
      <p className="mb-3 text-[13px] text-cozy-ink-soft">
        Mientras dure, todos te oyen encima de reuniones y salas cerradas. Se prende tu micrófono y se corta solo a los {minutes} minutos.
      </p>
      {broadcast && !mine ? (
        <p className="text-[14px]">
          <strong>{broadcast.name}</strong> ya le está hablando a toda la cabaña.
        </p>
      ) : mine ? (
        <button type="button" onClick={stopBroadcast} className="cozy-btn cozy-btn-danger">
          Terminar el anuncio
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            startBroadcast();
            onClose();
          }}
          className="cozy-btn cozy-btn-primary"
        >
          <PixelIcon name="mic" size={14} />
          Hablarle a toda la cabaña
        </button>
      )}
      {mine && broadcast && <BroadcastClock endsAt={broadcast.endsAt} className="ml-3 text-[13px] text-cozy-ink-soft" />}
    </PanelShell>
  );
}

/** Lo que le queda al anuncio por voz (con su propio reloj: solo se monta mientras se ve). */
export function BroadcastClock({ endsAt, className }: { endsAt: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className={`tabular-nums ${className ?? ""}`}>{broadcastLeft(endsAt - now)}</span>;
}
