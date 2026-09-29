"use client";

// El teléfono de escritorio: el directorio de oficinas para llamar (se abre con E junto al teléfono), la
// llamada que te suena (Contestar / Colgar) y el chip de la llamada en curso en el HUD.
import { callClock, canCallStatus, DIRECTORY_PERSON_TEXT, DIRECTORY_TEXT, namesList, phoneDirectory, type DirectoryEntry, type DirectoryStatus } from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { answerPhone, hangUpPhone, sendPhoneCall, sendPhoneCallTo, usePhoneStore } from "@/game/phone";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { STATUS_HEX } from "@/lib/cozy";
import { PixelIcon } from "./Cozy";
import { PanelShell } from "./PointsPanels";
import { AddToCallButton } from "./comunicacion/ComunicacionChips";

/** Color del puntito de cada estado del directorio (los mismos del estado de presencia). */
const DOT: Record<DirectoryStatus, string> = {
  office: STATUS_HEX.available,
  elsewhere: STATUS_HEX.available,
  away: STATUS_HEX.away,
  dnd: STATUS_HEX.dnd,
  busy: STATUS_HEX.busy,
  offline: "transparent",
};

/** Directorio del teléfono: cada oficina con su dueño y la gente conectada sin oficina, y el botón para llamar. */
export function PhonePanel({ onClose }: { onClose: () => void }) {
  const offices = useOfficeStore((s) => s.offices);
  const players = useOfficeStore((s) => s.players);
  const me = useOfficeStore(selectMyUserId);
  const call = usePhoneStore((s) => s.call);
  const dialing = usePhoneStore((s) => s.dialing);

  const entries = useMemo<DirectoryEntry[]>(() => phoneDirectory(Object.values(offices), Object.values(players), me), [offices, players, me]);
  const callEntry = (e: DirectoryEntry) => (e.kind === "office" ? sendPhoneCall(e.zoneId) : sendPhoneCallTo(e.userId));

  return (
    <PanelShell title="Teléfono" icon="phone" onClose={onClose}>
      {call ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <p className="text-[15px]">
            {call.phase === "talking" ? "Estás hablando con " : call.phase === "calling" ? "Llamando a " : "Te está llamando "}
            <strong>{call.withName}</strong>
          </p>
          <button type="button" onClick={hangUpPhone} className="cozy-btn cozy-btn-danger">
            Colgar
          </button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-cozy-ink-soft">
            Llama a quien quieras, tenga oficina o no: le suena esté donde esté en la cabaña, y mientras hablan se oyen a cualquier distancia.
          </p>
          {entries.length === 0 ? (
            <p className="py-4 text-center text-[14px] text-cozy-ink-soft">Todavía no hay nadie a quien llamar.</p>
          ) : (
            // El tarjetero del teléfono: renglones de libreta, una oficina por renglón.
            <ul className="border-2 border-cozy-wood bg-cozy-paper-light">
              {entries.map((e) => {
                const callable = canCallStatus(e.status);
                return (
                  <li
                    key={e.key}
                    className="flex items-center gap-3 border-b-2 border-dashed border-cozy-paper-dark px-3 py-2.5 last:border-b-0"
                  >
                    <span
                      className="h-3 w-3 shrink-0 border-2 border-cozy-frame"
                      style={{ background: DOT[e.status] }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{e.kind === "office" ? `Oficina de ${e.name}` : e.name}</span>
                      <span className="block truncate text-[12px] text-cozy-ink-soft">
                        {e.kind === "office" ? `${e.office} · ${DIRECTORY_TEXT[e.status]}` : DIRECTORY_PERSON_TEXT[e.status]}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => callEntry(e)}
                      disabled={!callable || dialing !== null}
                      title={callable ? `Llamar a ${e.name}` : DIRECTORY_TEXT[e.status]}
                      className="cozy-btn cozy-btn-primary shrink-0"
                    >
                      <PixelIcon name="phone" size={14} />
                      {dialing === e.key ? "Marcando…" : "Llamar"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </PanelShell>
  );
}

/** La llamada que me suena: quién llama y desde dónde, Contestar o Colgar. */
export function IncomingCall() {
  const call = usePhoneStore((s) => s.call);
  if (!call || call.phase !== "ringing") return null;
  return (
    <div className="absolute top-1/3 left-1/2 z-30 w-[min(360px,calc(100%-1.5rem))] -translate-x-1/2">
      <div role="alertdialog" aria-label={`${call.withName} te llama`} className="cozy-panel px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 motion-safe:animate-[cozy-ring_0.12s_steps(2)_infinite_alternate] place-items-center border-2 border-cozy-frame bg-[#a8463d] text-cozy-paper-light">
            <PixelIcon name="phone" size={20} />
          </span>
          <p className="text-[15px]">
            <strong>{call.withName}</strong> te llama desde {call.from}
            {/* Si te suman a una llamada en curso: con quiénes vas a hablar. */}
            {call.members.length > 1 && (
              <span className="block text-[13px] text-cozy-ink-soft">
                Para sumarte a la llamada con {namesList(call.members.filter((m) => m.phase !== "ringing").map((m) => m.name))}
              </span>
            )}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={() => answerPhone(true)} className="cozy-btn cozy-btn-primary">
            Contestar
          </button>
          <button type="button" onClick={() => answerPhone(false)} className="cozy-btn cozy-btn-danger">
            Colgar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Chip del HUD: "Llamando a X…" o "En llamada con X · 02:13", con el botón para colgar. */
export function CallChip() {
  const call = usePhoneStore((s) => s.call);
  const [now, setNow] = useState(() => Date.now());
  const talking = call?.phase === "talking";
  useEffect(() => {
    if (!talking) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [talking]);
  if (!call || call.phase === "ringing") return null;
  // En una llamada grupal: los que hablan (y a quiénes les está sonando, entre paréntesis).
  const talkers = call.members.filter((m) => m.phase !== "ringing").map((m) => m.name);
  const ringing = call.members.filter((m) => m.phase === "ringing").map((m) => m.name);
  const withWho = talkers.length ? namesList(talkers) : call.withName;
  return (
    <div className="cozy-chip flex h-[34px] items-center gap-2 pr-1 pl-2.5" role="status">
      <PixelIcon name="phone" size={14} color="#a8463d" />
      <span className="max-w-[20rem] truncate" title={ringing.length ? `Le está sonando a ${namesList(ringing)}` : undefined}>
        {talking ? (
          <>
            En llamada con {withWho}
            {ringing.length > 0 && <span className="text-cozy-ink-soft"> (+{ringing.length} sonando)</span>} ·{" "}
            <span className="tabular-nums">{callClock(now - call.since)}</span>
          </>
        ) : (
          `Llamando a ${call.withName}…`
        )}
      </span>
      <AddToCallButton />
      <button type="button" onClick={hangUpPhone} className="cozy-btn cozy-btn-danger px-2 py-0.5 text-[13px]">
        Colgar
      </button>
    </div>
  );
}
