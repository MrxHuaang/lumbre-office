"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { sendInvite } from "@/game/network";
import { usePermisosStore } from "@/game/permisos";
import { callPerson, followPerson, stopFollowing, useComStore, wavePerson } from "@/game/comunicacion";
import { usePhoneStore } from "@/game/phone";
import { selectMyOffice, useOfficeStore } from "@/game/store";
import { PixelIcon, type PixelIconName } from "./Cozy";

interface Person {
  sessionId: string;
  userId: string;
  name: string;
  /** Para apagar "Llamar" si no se puede (el servidor igual lo valida). */
  status?: string;
  call?: string;
}

/** A dónde invito según dónde estoy: mi oficina, la sala con nombre o simplemente "aquí". */
function useInviteLabel(): string {
  const zone = useOfficeStore((s) => s.zone);
  const myOffice = useOfficeStore(useShallow(selectMyOffice));
  if (myOffice && zone?.id === myOffice.zoneId) return "Invitar a mi oficina";
  if (zone?.name) return `Invitar a ${zone.name}`;
  return "Invitar a donde estoy";
}

/**
 * Menú chico junto a cada nombre de Conectados: ir caminando hasta la persona, llamarla (o sumarla a mi
 * llamada), saludarla, seguirla, invitarla a donde estoy o ver su perfil. Se abre con clic o teclado (Enter/espacio/flecha abajo); flechas, Inicio y Fin recorren
 * las opciones; Esc lo cierra y devuelve el foco al botón.
 */
export function PersonMenu({ person, onProfile }: { person: Person; onProfile: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const inviteLabel = useInviteLabel();
  const walkToPlayer = useOfficeStore((s) => s.walkToPlayer);
  const admin = usePermisosStore((s) => s.admin);
  const following = useComStore((s) => s.following?.userId === person.userId);
  const call = usePhoneStore((s) => s.call);
  const inMyCall = Boolean(call?.members.some((m) => m.userId === person.userId));
  const canCall = !inMyCall && person.status !== "dnd" && !person.call && (!call || call.phase === "talking");

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) button.current?.focus();
  };

  // Posición fija junto al botón: la lista de Conectados tiene scroll y recortaría un menú adentro.
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  }, [open]);

  // Con el menú abierto, las flechas son del menú y no mueven al personaje.
  useEffect(() => {
    if (!open) return;
    const { setTyping } = useOfficeStore.getState();
    setTyping(true);
    return () => setTyping(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]:not(:disabled)")?.focus();
    const onDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) close(false);
    };
    // Si la lista se mueve, el menú quedaría flotando en otro lado: se cierra.
    const onMove = () => close(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", onMove);
    document.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not(:disabled)") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      items[(n + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") close(false);
  };

  const run = (fn: () => void) => () => {
    fn();
    close();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Opciones para ${person.name}`}
        title={`Opciones para ${person.name}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        data-on={open || undefined}
        className="grid size-10 shrink-0 place-items-center opacity-70 hover:opacity-100 focus-visible:opacity-100 data-[on]:opacity-100"
      >
        <PixelIcon name="dots" size={13} color="var(--color-cozy-wood)" />
      </button>
      {open && pos && (
        <div
          ref={menu}
          role="menu"
          aria-label={`Opciones para ${person.name}`}
          onKeyDown={onMenuKey}
          style={{ top: pos.top, right: pos.right }}
          className="cozy-panel pointer-events-auto fixed z-40 w-max max-w-[16rem] p-1"
        >
          <Item icon="steps" onClick={run(() => walkToPlayer(person.sessionId))}>
            Ir hasta {person.name}
          </Item>
          {!inMyCall && (
            <Item icon="phone" disabled={!canCall} onClick={run(() => callPerson(person.userId))}>
              {call?.phase === "talking" ? `Sumar a ${person.name} a la llamada` : `Llamar a ${person.name}`}
            </Item>
          )}
          <Item icon="wave" disabled={person.status === "dnd"} onClick={run(() => wavePerson(person.userId))}>
            Saludar
          </Item>
          <Item
            icon="steps"
            onClick={run(() => (following ? stopFollowing(`Dejaste de seguir a ${person.name}.`) : followPerson(person.userId)))}
          >
            {following ? "Dejar de seguir" : `Seguir a ${person.name}`}
          </Item>
          <Item icon="mail" onClick={run(() => sendInvite(person.userId))}>
            {inviteLabel}
          </Item>
          <Item icon="smile" onClick={run(onProfile)}>
            Ver perfil
          </Item>
          {admin && (
            <Item icon="unlock" onClick={run(() => usePermisosStore.getState().openEditor({ userId: person.userId, name: person.name }))}>
              Dar permiso…
            </Item>
          )}
        </div>
      )}
    </>
  );
}

function Item({ children, icon, onClick, disabled }: { children: React.ReactNode; icon: PixelIconName; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 px-2 py-1.5 text-left text-[14px] outline-none hover:bg-cozy-paper-dark focus-visible:bg-cozy-paper-dark disabled:opacity-45 disabled:hover:bg-transparent"
    >
      <PixelIcon name={icon} size={14} color="var(--color-cozy-wood)" />
      <span className="truncate">{children}</span>
    </button>
  );
}
