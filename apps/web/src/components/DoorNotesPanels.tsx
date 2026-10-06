"use client";

// Notas en la puerta: el botón frente a una oficina ajena, el panel para escribir la nota, el aviso
// "Tienes N notas" para el dueño y el panel donde las lee y las borra (GET/POST /api/door-notes).
import { cleanDoorNote, DOOR_NOTES, type DoorNoteDTO } from "@hyvento/shared";
import { useEffect, useRef, useState } from "react";
import { useDoorNotesStore } from "@/game/doorNotes";
import { sendDoorNote } from "@/game/network";
import { selectMyOffice, useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";
import { api, PanelShell } from "./PointsPanels";

const openNotes = () => useOfficeStore.getState().openPanel("doorNotes", false);
const plural = (n: number) => (n === 1 ? "1 nota" : `${n} notas`);

function when(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

/** Frente a la puerta de una oficina ajena (abierta): el botón para dejarle una nota. */
export function DoorNotePrompt() {
  const door = useDoorNotesStore((s) => s.door);
  const owner = useOfficeStore((s) => (door ? s.offices[door]?.ownerName : undefined));
  const locked = useOfficeStore((s) => s.doorPrompt);
  const panel = useOfficeStore((s) => s.panel);
  const decorating = useOfficeStore((s) => s.decorating);
  // Con la puerta cerrada, el aviso de tocar ya trae este botón.
  if (!door || !owner || locked === door || panel || decorating) return null;
  return (
    <button
      type="button"
      onClick={() => useDoorNotesStore.getState().write(door)}
      className="cozy-chip pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-[14px]"
    >
      <PixelIcon name="mail" size={14} color="var(--color-cozy-wood)" />
      Dejarle una nota a {owner}
    </button>
  );
}

/**
 * Para el dueño: "Tienes N notas" mientras haya sin leer, y un aviso al entrar o cuando le pegan una
 * nueva estando conectado.
 */
export function DoorNotesChip() {
  const unread = useOfficeStore((s) => selectMyOffice(s)?.notes ?? null);
  const panel = useOfficeStore((s) => s.panel?.kind);
  const seen = useRef<number | null>(null);
  useEffect(() => {
    const before = seen.current;
    seen.current = unread;
    if (!unread || (before !== null && unread <= before)) return;
    const text = before === null ? `Tienes ${plural(unread)} en la puerta de tu oficina.` : "Te dejaron una nota en la puerta de tu oficina.";
    useOfficeStore.getState().notify(text, "info", { label: "Leer", run: openNotes });
  }, [unread]);
  if (!unread || panel === "doorNotes") return null;
  return (
    <button type="button" onClick={openNotes} className="cozy-chip pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-[14px]">
      <PixelIcon name="mail" size={14} color="var(--color-cozy-red)" />
      Tienes {plural(unread)}
    </button>
  );
}

/** Escribir una nota para la dueña o dueño de la oficina de la puerta (el servidor la pega). */
export function DoorNoteWritePanel({ onClose }: { onClose: () => void }) {
  const target = useDoorNotesStore((s) => s.target);
  const sending = useDoorNotesStore((s) => s.sending);
  const error = useDoorNotesStore((s) => s.error);
  const owner = useOfficeStore((s) => (target ? s.offices[target]?.ownerName : undefined));
  const [text, setText] = useState("");
  const clean = cleanDoorNote(text);
  const send = () => {
    if (target && clean && !sending) sendDoorNote(target, clean);
  };

  return (
    <PanelShell title={owner ? `Nota para ${owner}` : "Dejar una nota"} icon="mail" onClose={onClose}>
      {!target || !owner ? (
        <p className="text-[14px] text-cozy-ink-soft">Esta oficina ya no tiene dueño.</p>
      ) : (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <p className="text-[14px] leading-snug text-cozy-ink-soft">La pegas en su puerta y la lee cuando vuelva. Solo la ve {owner}.</p>
          <textarea
            autoFocus
            value={text}
            maxLength={DOOR_NOTES.maxLength}
            rows={5}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Pasé a saludarte. Te dejé el libro en el escritorio…"
            aria-label="Texto de la nota"
            className="cozy-input min-h-28 resize-none bg-[#fbf1b6] leading-snug"
          />
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className={`tabular-nums ${text.length >= DOOR_NOTES.maxLength ? "text-cozy-red" : "text-cozy-ink-soft"}`}>
              {text.length}/{DOOR_NOTES.maxLength}
            </span>
            {error && (
              <span role="alert" className="flex-1 text-right text-cozy-red">
                {error}
              </span>
            )}
          </div>
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={onClose} className="cozy-btn">
              Cancelar
            </button>
            <button type="submit" disabled={!clean || sending} className="cozy-btn cozy-btn-primary">
              {sending ? "Pegando…" : "Pegar la nota"}
            </button>
          </div>
        </form>
      )}
    </PanelShell>
  );
}

/** Las notas de mi puerta: al abrir se marcan como leídas (los post-its se despegan) y se pueden borrar. */
export function DoorNotesPanel({ onClose }: { onClose: () => void }) {
  const [notes, setNotes] = useState<DoorNoteDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ notes: DoorNoteDTO[] }>("/api/door-notes").then(
      (r) => {
        if (!alive) return;
        setNotes(r.notes);
        // Se ven como "nueva" mientras el panel está abierto; en la base quedan leídas ya.
        if (r.notes.some((n) => !n.read)) void api("/api/door-notes", { method: "POST" }).catch(() => undefined);
      },
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, []);

  const remove = async (id: string) => {
    setBusy(id);
    try {
      await api(`/api/door-notes/${encodeURIComponent(id)}`, { method: "DELETE" });
      setNotes((list) => list?.filter((n) => n.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo borrar.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <PanelShell title="Notas en tu puerta" icon="mail" onClose={onClose}>
      {!notes ? (
        <p className="text-[14px] text-cozy-ink-soft">{error ?? "Despegando las notas…"}</p>
      ) : notes.length === 0 ? (
        <p className="text-[14px] leading-snug text-cozy-ink-soft">No tienes notas. Si alguien pasa por tu oficina y no estás, te puede dejar una pegada en la puerta.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="text-[13px] text-cozy-red">
              {error}
            </p>
          )}
          <ul className="cozy-scroll flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
            {notes.map((n) => (
              <li key={n.id} className="border-2 border-cozy-frame bg-[#fbf1b6] px-3 py-2.5 shadow-[3px_3px_0_rgb(42_32_51/0.25)]">
                <div className="flex items-center gap-2 text-[13px]">
                  <strong className="text-[14px]">{n.fromName}</strong>
                  <span className="text-cozy-ink-soft">{when(n.createdAt)}</span>
                  {!n.read && <span className="cozy-chip px-1.5 py-px text-[12px] leading-none text-cozy-red">Nueva</span>}
                  <button
                    type="button"
                    onClick={() => void remove(n.id)}
                    disabled={busy === n.id}
                    aria-label={`Borrar la nota de ${n.fromName}`}
                    title="Borrar"
                    className="ml-auto p-1 text-cozy-ink-soft hover:text-cozy-red disabled:opacity-50"
                  >
                    <PixelIcon name="close" size={10} />
                  </button>
                </div>
                <p className="mt-1 text-[14px] leading-snug break-words whitespace-pre-line">{n.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PanelShell>
  );
}
