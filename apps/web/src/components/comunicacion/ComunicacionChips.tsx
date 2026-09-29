"use client";

// Chips del HUD de la comunicación rápida: "Siguiendo a X" (con "Dejar de seguir") y el anuncio por voz
// ("Anunciando · 3:12" con "Terminar" para quien anuncia; "X habla a toda la cabaña" para los demás).
// También el botón "Llamar" de la lista de Conectados y la lista para sumar gente a la llamada.
import { callHasRoom } from "@hyvento/shared";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { addToCall, callPerson, stopBroadcast, stopFollowing, useComStore } from "@/game/comunicacion";
import { usePhoneStore } from "@/game/phone";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";
import { BroadcastClock } from "./ComunicacionOverlays";

export function ComunicacionChips() {
  return (
    <>
      <FollowChip />
      <BroadcastChip />
    </>
  );
}

function FollowChip() {
  const following = useComStore((s) => s.following);
  if (!following) return null;
  return (
    <div className="cozy-chip flex h-[34px] items-center gap-2 pr-1 pl-2.5" role="status">
      <PixelIcon name="steps" size={14} color="var(--color-cozy-wood)" />
      <span className="max-w-[12rem] truncate">Siguiendo a {following.name}</span>
      <button type="button" onClick={() => stopFollowing(`Dejaste de seguir a ${following.name}.`)} className="cozy-btn px-2 py-0.5 text-[13px]">
        Dejar de seguir
      </button>
    </div>
  );
}

function BroadcastChip() {
  const broadcast = useComStore((s) => s.broadcast);
  const me = useOfficeStore(selectMyUserId);
  if (!broadcast) return null;
  const mine = broadcast.userId === me;
  return (
    <div className="cozy-chip flex h-[34px] items-center gap-2 pr-1 pl-2.5" role="status">
      <PixelIcon name="megaphone" size={14} color="var(--color-cozy-red)" />
      {mine ? (
        <>
          <span>
            Anunciando · <BroadcastClock endsAt={broadcast.endsAt} />
          </span>
          <button type="button" onClick={stopBroadcast} className="cozy-btn cozy-btn-danger px-2 py-0.5 text-[13px]">
            Terminar
          </button>
        </>
      ) : (
        <span className="max-w-[16rem] truncate pr-1.5">{broadcast.name} habla a toda la cabaña</span>
      )}
    </div>
  );
}

/** El telefonito de cada persona en Conectados: llamar (o sumarla, si ya estoy hablando). */
export function CallPersonButton({ person }: { person: { userId: string; name: string; status: string; call?: string } }) {
  const call = usePhoneStore((s) => s.call);
  const dialing = usePhoneStore((s) => s.dialing);
  const talking = call?.phase === "talking";
  // Con ella ya estoy en la llamada: no hay a quién marcar.
  if (call && call.members.some((m) => m.userId === person.userId)) return null;
  const blocked = person.status === "dnd" ? "Está en No molestar" : person.call ? "Está en otra llamada" : call && !talking ? "Ya estás en una llamada" : "";
  const label = talking ? `Sumar a ${person.name} a la llamada` : `Llamar a ${person.name}`;
  return (
    <button
      type="button"
      onClick={() => callPerson(person.userId)}
      disabled={Boolean(blocked) || dialing !== null}
      title={blocked || label}
      aria-label={label}
      className="p-1.5 hover:bg-cozy-paper-dark disabled:opacity-40"
    >
      <PixelIcon name="phone" size={14} color="var(--color-cozy-wood)" />
    </button>
  );
}

/**
 * "Sumar" del chip de la llamada: una lista corta de los conectados que se pueden sumar (disponibles y
 * sin otra llamada). Se abre hacia abajo, fija junto al botón.
 */
export function AddToCallButton() {
  const call = usePhoneStore((s) => s.call);
  const players = useOfficeStore((s) => s.players);
  const me = useOfficeStore(selectMyUserId);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 248) });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!list.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!call || call.phase !== "talking") return null;
  const inCall = new Set([me, ...call.members.map((m) => m.userId)]);
  const full = !callHasRoom(inCall.size);
  const people = Object.values(players)
    .filter((p) => p.userId && !inCall.has(p.userId))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={full}
        aria-haspopup="menu"
        aria-expanded={open}
        title={full ? "La llamada está llena" : "Sumar a alguien a la llamada"}
        className="cozy-btn px-2 py-0.5 text-[13px]"
      >
        + Sumar
      </button>
      {open && pos && (
        <div ref={list} role="menu" aria-label="Sumar a la llamada" style={{ top: pos.top, left: pos.left }} className="cozy-panel pointer-events-auto fixed z-50 w-60 p-1">
          {people.length === 0 ? (
            <p className="px-2 py-1.5 text-[13px] text-cozy-ink-soft">No hay nadie más conectado para sumar.</p>
          ) : (
            <ul className="cozy-scroll max-h-64 overflow-y-auto">
              {people.map((p) => {
                const why = p.status === "dnd" ? "No molestar" : p.call ? "En otra llamada" : "";
                return (
                  <li key={p.sessionId}>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={Boolean(why)}
                      onClick={() => {
                        addToCall(p.userId);
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[14px] hover:bg-cozy-paper-dark disabled:opacity-50"
                    >
                      <PixelIcon name="phone" size={13} color="var(--color-cozy-wood)" />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      {why && <span className="shrink-0 text-[12px] text-cozy-ink-soft">{why}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
