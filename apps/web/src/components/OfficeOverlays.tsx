"use client";

import { useDoorNotesStore } from "@/game/doorNotes";
import { respondInvite, respondKnock, sendKnock, sendSwivel } from "@/game/network";
import { useOfficeStore } from "@/game/store";
import type { Invitation } from "@hyvento/shared";
import { PixelIcon } from "./Cozy";

/** Frente a la puerta de una oficina cerrada: ofrecer tocar. */
export function DoorPrompt() {
  const zoneId = useOfficeStore((s) => s.doorPrompt);
  const office = useOfficeStore((s) => (s.doorPrompt ? s.offices[s.doorPrompt] : undefined));
  const pending = useOfficeStore((s) => s.pendingKnock);
  if (!zoneId || !office) return null;
  const waiting = pending === zoneId;

  return (
    <div className="cozy-panel pointer-events-auto flex w-max max-w-full flex-wrap items-center justify-center gap-3 px-5 py-3 text-[14px]">
      <PixelIcon name="lock" size={16} color="var(--color-cozy-wood)" />
      <span>
        La oficina de <strong>{office.ownerName}</strong> está cerrada
      </span>
      <button onClick={() => sendKnock(zoneId)} disabled={waiting} className="cozy-btn cozy-btn-primary">
        {waiting ? "Esperando respuesta…" : "Tocar la puerta"}
      </button>
      {/* Si no está (o no puede abrir), se le deja una nota en la puerta. */}
      <button onClick={() => useDoorNotesStore.getState().write(zoneId)} className="cozy-btn">
        <PixelIcon name="mail" size={14} />
        Dejar una nota
      </button>
    </div>
  );
}

/** Para el dueño: alguien toca la puerta de su oficina. */
export function KnockRequests() {
  const requests = useOfficeStore((s) => s.knockRequests);
  if (requests.length === 0) return null;
  return (
    <div className="absolute top-1/3 left-1/2 z-20 flex w-[min(360px,calc(100%-1.5rem))] -translate-x-1/2 flex-col gap-3">
      {requests.map((r) => (
        <div key={r.requestId} role="alert" className="cozy-panel px-5 py-4">
          <p className="text-[15px]">
            <strong>{r.fromName}</strong> toca la puerta de tu oficina
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => respondKnock(r.requestId, true)} className="cozy-btn cozy-btn-primary">
              Dejar pasar
            </button>
            <button onClick={() => respondKnock(r.requestId, false)} className="cozy-btn">
              Ahora no
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** "a su oficina", "a Sala de reuniones" o "a donde está". */
function invitePlaceText(inv: Invitation): string {
  if (inv.place === "office") return "a su oficina";
  if (inv.place === "zone" && inv.placeName) return `a ${inv.placeName}`;
  return "a donde está";
}

/** Invitaciones recibidas desde la lista de Conectados: "Ir" camina hasta quien invitó. */
export function InvitationRequests() {
  const invitations = useOfficeStore((s) => s.invitations);
  if (invitations.length === 0) return null;
  return (
    <div className="absolute top-1/4 left-1/2 z-20 flex w-[min(360px,calc(100%-1.5rem))] -translate-x-1/2 flex-col gap-3">
      {invitations.map((inv) => (
        <div key={inv.inviteId} role="alertdialog" aria-label={`Invitación de ${inv.fromName}`} className="cozy-panel pointer-events-auto px-5 py-4">
          <p className="flex items-center gap-2.5 text-[15px]">
            <PixelIcon name="mail" size={16} color="var(--color-cozy-wood)" />
            <span>
              <strong>{inv.fromName}</strong> te invita {invitePlaceText(inv)}
            </span>
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => respondInvite(inv, true)} className="cozy-btn cozy-btn-primary">
              <PixelIcon name="steps" size={14} />
              Ir
            </button>
            <button onClick={() => respondInvite(inv, false)} className="cozy-btn">
              Ahora no
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Color del punto de cada aviso según su tono. */
const TONE: Record<string, string> = {
  info: "var(--color-cozy-sky)",
  success: "#5ea247",
  warning: "var(--color-cozy-wood-light)",
};

export function Notices() {
  const notices = useOfficeStore((s) => s.notices);
  const dismiss = useOfficeStore((s) => s.dismissNotice);
  if (notices.length === 0) return null;
  return (
    <div className="flex w-full flex-col gap-3" aria-live="polite">
      {notices.map((n) => (
        <div key={n.id} className="cozy-panel pointer-events-auto flex items-center gap-2.5 px-4 py-3 text-[14px]">
          <span className="h-2.5 w-2.5 shrink-0 border-2 border-cozy-frame" style={{ background: TONE[n.tone] ?? TONE.info }} />
          <span className="flex-1">{n.text}</span>
          {n.action && (
            <button
              onClick={() => {
                n.action!.run();
                dismiss(n.id);
              }}
              className="cozy-btn shrink-0 px-2.5 py-1 text-[13px]"
            >
              {n.action.label}
            </button>
          )}
          <button onClick={() => dismiss(n.id)} aria-label="Cerrar aviso" className="shrink-0 p-1 text-cozy-ink-soft hover:text-cozy-ink">
            <PixelIcon name="close" size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Ayuda de la tecla E junto a un asiento libre o estando sentado. Frente a un computador,
 * además el botón para prenderlo (este sí también en el celular).
 */
export function SeatPrompt() {
  const prompt = useOfficeStore((s) => s.seatPrompt);
  const doorPrompt = useOfficeStore((s) => s.doorPrompt);
  const atComputer = useOfficeStore((s) => s.atComputer);
  const atSwivel = useOfficeStore((s) => s.atSwivel);
  const atPhone = useOfficeStore((s) => s.atPhone);
  const openPanel = useOfficeStore((s) => s.openPanel);
  const pcOn = useOfficeStore((s) => s.pcOn);
  const setPcOn = useOfficeStore((s) => s.setPcOn);
  // En la mesa de blackjack, la tira del modo mesa ya tiene "Levantarse".
  const atTable = useOfficeStore((s) => s.panel?.kind === "blackjack");
  if (!prompt || doorPrompt || pcOn || atTable) return null;
  const pcButton = atComputer && prompt === "stand";
  const spinButton = atSwivel && prompt === "stand";
  // Sentado junto al teléfono: E levanta, así que el teléfono va en su propio botón.
  const phoneButton = atPhone && prompt === "stand";

  return (
    <div
      className={`flex items-center gap-2.5 ${pcButton || spinButton || phoneButton ? "pointer-events-auto" : "pointer-events-none max-md:hidden"}`}
    >
      {pcButton && (
        <button type="button" onClick={() => setPcOn(true)} className="cozy-btn cozy-btn-primary">
          <PixelIcon name="power" size={14} />
          Encender PC
        </button>
      )}
      {phoneButton && (
        <button type="button" onClick={() => openPanel("phone", true)} title="Llamar a una oficina (o clic en el teléfono)" className="cozy-btn">
          <PixelIcon name="phone" size={14} />
          Teléfono
        </button>
      )}
      {/* La silla de oficina gira: R, el botón o clic en tu personaje. */}
      {spinButton && (
        <button type="button" onClick={() => sendSwivel()} title="Girar en la silla (R, o clic en tu personaje)" className="cozy-btn">
          <kbd className="cozy-kbd max-md:hidden">R</kbd>
          Girar
        </button>
      )}
      <div className="cozy-chip flex items-center gap-2 px-3 py-1.5 text-[13px] max-md:hidden">
        <kbd className="cozy-kbd">E</kbd>
        {prompt === "sit" ? "sentarte" : "levantarte (o muévete)"}
      </div>
    </div>
  );
}
