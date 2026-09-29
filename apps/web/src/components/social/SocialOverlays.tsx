"use client";

// Lo social sobre la cabaña: el menú al hacer clic en una persona, la ventana de regalo, las
// invitaciones a intercambiar y la ventana del intercambio. Más los botones chicos de la lista de
// conectados y el aviso de regalos del HUD.
import { tradeReach } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { getRoom } from "@/game/network";
import { usePermisosStore } from "@/game/permisos";
import { callPerson, followPerson, wavePerson } from "@/game/comunicacion";
import { respondTrade, sendTradeRequest, useSocialStore, type GiftTarget } from "@/game/social";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";
import { PanelShell } from "../PointsPanels";
import { socialApi } from "./common";
import { GiftForm } from "./GiftForm";
import { TradeWindow } from "./TradeWindow";

export function SocialOverlays() {
  const trade = useSocialStore((s) => s.trade);
  const giftTo = useSocialStore((s) => s.giftTo);
  const openGift = useSocialStore((s) => s.openGift);
  return (
    <>
      <PersonMenu />
      <TradeInvites />
      {giftTo && (
        <PanelShell title="Regalar" icon="gift" onClose={() => openGift(null)}>
          <GiftForm to={giftTo} onSent={() => openGift(null)} onCancel={() => openGift(null)} />
        </PanelShell>
      )}
      {trade && <TradeWindow key={trade.id} trade={trade} />}
    </>
  );
}

/** Menú junto a la persona en la que se hizo clic: su nombre, Regalar, Intercambiar, Llamar, Saludar y Seguir. */
function PersonMenu() {
  const menu = useSocialStore((s) => s.personMenu);
  const close = useSocialStore((s) => s.closePersonMenu);
  const openGift = useSocialStore((s) => s.openGift);
  const person = useOfficeStore((s) => (menu ? s.players[menu.sessionId] : undefined));
  const near = useNearMe(menu?.sessionId ?? null);
  const admin = usePermisosStore((s) => s.admin);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, close]);
  // Si la persona se va de la cabaña, el menú se cierra solo.
  useEffect(() => {
    if (menu && !person) close();
  }, [menu, person, close]);
  if (!menu || !person) return null;

  const left = Math.min(Math.max(8, menu.x - 90), window.innerWidth - 188);
  const top = Math.min(Math.max(8, menu.y - 150), window.innerHeight - 290);
  const item = "flex w-full items-center gap-2 px-2.5 py-2 text-left text-[14px] hover:bg-cozy-paper-dark disabled:opacity-50";
  const act = (fn: () => void) => () => {
    fn();
    close();
  };
  return (
    <div role="menu" aria-label={`Acciones con ${person.name}`} className="cozy-panel fixed z-30 w-[180px] p-1.5" style={{ left, top }}>
      <p className="flex items-center gap-2 bg-cozy-wood px-2.5 py-1.5 text-[14px] font-semibold text-cozy-paper-light">
        <span className="min-w-0 flex-1 truncate">{person.name}</span>
        <button type="button" onClick={close} aria-label="Cerrar" className="p-0.5">
          <PixelIcon name="close" size={10} />
        </button>
      </p>
      <button type="button" role="menuitem" onClick={() => openGift({ userId: person.userId, name: person.name })} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[14px] hover:bg-cozy-paper-dark">
        <PixelIcon name="gift" size={13} color="var(--color-cozy-red)" />
        Regalar
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!near}
        title={near ? undefined : "Acércate para intercambiar"}
        onClick={() => {
          sendTradeRequest(menu.sessionId);
          close();
        }}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[14px] hover:bg-cozy-paper-dark disabled:opacity-50"
      >
        <PixelIcon name="swap" size={13} color="var(--color-cozy-wood)" />
        Intercambiar
        {!near && <span className="ml-auto text-[11px] text-cozy-ink-soft">lejos</span>}
      </button>
      {/* Comunicación rápida (game/comunicacion.ts): el servidor valida "No molestar", ocupado y las pausas. */}
      <button type="button" role="menuitem" disabled={person.status === "dnd"} onClick={act(() => callPerson(person.userId))} className={item}>
        <PixelIcon name="phone" size={13} color="var(--color-cozy-wood)" />
        Llamar
      </button>
      <button type="button" role="menuitem" disabled={person.status === "dnd"} onClick={act(() => wavePerson(person.userId))} className={item}>
        <PixelIcon name="wave" size={13} color="var(--color-cozy-wood)" />
        Saludar
      </button>
      <button type="button" role="menuitem" onClick={act(() => followPerson(person.userId))} className={item}>
        <PixelIcon name="steps" size={13} color="var(--color-cozy-wood)" />
        Seguir
      </button>
      {admin && (
        <button type="button" role="menuitem" onClick={act(() => usePermisosStore.getState().openEditor({ userId: person.userId, name: person.name }))} className={item}>
          <PixelIcon name="unlock" size={13} color="var(--color-cozy-wood)" />
          Dar permiso…
        </button>
      )}
    </div>
  );
}

/**
 * ¿Está esa persona lo bastante cerca para intercambiar? El cliente solo lo anticipa (el servidor lo
 * valida): se lee la posición de las dos del estado de la sala.
 */
function useNearMe(sessionId: string | null) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!sessionId) return;
    const check = () => {
      const room = getRoom();
      const me = room && room.state.players.get(room.sessionId);
      const other = room?.state.players.get(sessionId);
      setNear(Boolean(me && other && tradeReach(me, other)));
    };
    check();
    const timer = setInterval(check, 400);
    return () => clearInterval(timer);
  }, [sessionId]);
  return near;
}

/**
 * Invitaciones a intercambiar (como los toques de puerta): aceptar o no. Van por encima de los paneles
 * (z-40, como el buzón o el PC): si no, con uno abierto la invitación vence sin que se vea.
 */
function TradeInvites() {
  const invites = useSocialStore((s) => s.invites);
  if (invites.length === 0) return null;
  return (
    <div className="absolute top-1/4 left-1/2 z-50 flex w-[min(360px,calc(100%-1.5rem))] -translate-x-1/2 flex-col gap-3">
      {invites.map((inv) => (
        <div key={inv.requestId} role="alert" className="cozy-panel px-5 py-4">
          <p className="flex items-center gap-2 text-[15px]">
            <PixelIcon name="swap" size={14} color="var(--color-cozy-wood)" />
            <span>
              <strong>{inv.fromName}</strong> quiere intercambiar contigo
            </span>
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => respondTrade(inv.requestId, true)} className="cozy-btn cozy-btn-primary">
              Ver el intercambio
            </button>
            <button onClick={() => respondTrade(inv.requestId, false)} className="cozy-btn">
              Ahora no
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Botón chico de la lista de conectados: regalarle a esa persona. */
export function PersonActions({ to }: { to: GiftTarget }) {
  const openGift = useSocialStore((s) => s.openGift);
  return (
    <button type="button" onClick={() => openGift(to)} title={`Regalarle a ${to.name}`} aria-label={`Regalarle a ${to.name}`} className="shrink-0 p-0.5 opacity-70 hover:opacity-100">
      <PixelIcon name="gift" size={13} color="var(--color-cozy-red)" />
    </button>
  );
}

/** Aviso del HUD: regalos sin abrir (clic: abre el buzón). */
export function GiftChip() {
  const unopened = useSocialStore((s) => s.unopened);
  const setUnopened = useSocialStore((s) => s.setUnopened);
  const openPanel = useOfficeStore((s) => s.openPanel);
  useEffect(() => {
    socialApi<{ unopened: number }>("/api/gifts").then(
      (r) => setUnopened(r.unopened),
      () => undefined,
    );
  }, [setUnopened]);
  if (!unopened) return null;
  return (
    <button type="button" onClick={() => openPanel("mailbox", false)} className="cozy-btn h-[34px] gap-1.5 px-2 py-0" title="Regalos sin abrir en el buzón">
      <PixelIcon name="gift" size={15} color="var(--color-cozy-red)" />
      {unopened}
    </button>
  );
}
