"use client";

import { useEffect, useMemo, useState } from "react";
import { NOTE_BODY_MAX, NOTE_TITLE_MAX, type NoteDTO } from "@/lib/notes";
import { NotesIcon, TrashIcon } from "./icons";
import type { NotesStore } from "./useNotes";

/** Pregunta de confirmación del sistema (la muestra el escritorio). */
export type Confirm = (opts: { title: string; message: string; confirmLabel: string }) => Promise<boolean>;

const dateFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const formatDate = (iso: string) => dateFmt.format(new Date(iso));
const titleOf = (n: NoteDTO) => n.title.trim() || "Sin título";

/** Hora actual, refrescada cada `ms`. */
export function useNow(ms = 15_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Botón de la barra de herramientas; con `label` es un botón de solo ícono (el texto va en el tooltip). */
function ToolButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`border-[1.5px] border-riso-navy bg-riso-cream text-xs font-semibold hover:bg-riso-yellow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-riso-cream ${
        label ? "px-1 py-0.5" : "px-2.5 py-1"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBar({ children }: { children: React.ReactNode }) {
  return (
    <footer className="flex shrink-0 items-center justify-between gap-3 border-t-2 border-riso-navy bg-riso-cream px-3 py-1 text-[11px] text-riso-muted">
      {children}
    </footer>
  );
}

// ---------- Notas ----------

export function NotesApp({ notes }: { notes: NotesStore }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...notes.active]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
  }, [notes.active, query]);
  const selected = notes.active.find((n) => n.id === selectedId) ?? list[0] ?? null;

  const create = async () => {
    setQuery("");
    const note = await notes.create();
    setSelectedId(note.id);
  };

  const saveLabel = { idle: "", saving: "Guardando…", saved: "Guardado", error: "No se pudo guardar" }[notes.status];

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b-2 border-riso-navy bg-riso-cream px-2 py-1.5">
        <ToolButton onClick={() => void create()}>+ Nueva nota</ToolButton>
        <ToolButton onClick={() => selected && void notes.trash(selected.id)} disabled={!selected} label="Mandar a la papelera">
          <TrashIcon size={20} full={false} />
        </ToolButton>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar…"
          aria-label="Buscar notas"
          className="riso-input ml-auto w-40 px-2 py-1 text-xs shadow-none"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,190px)_minmax(0,1fr)] max-sm:grid-cols-[minmax(0,120px)_minmax(0,1fr)]">
        <ul className="min-h-0 overflow-y-auto border-r-2 border-riso-navy bg-riso-cream">
          {notes.loading && <li className="p-3 text-xs text-riso-muted">Cargando…</li>}
          {!notes.loading && list.length === 0 && (
            <li className="p-3 text-xs text-riso-muted">{query ? "Nada coincide." : "Aún no tienes notas."}</li>
          )}
          {list.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => setSelectedId(n.id)}
                className={`block w-full border-b border-dashed border-riso-navy/30 px-3 py-2 text-left ${
                  n.id === selected?.id ? "bg-riso-yellow" : "hover:bg-riso-paper"
                }`}
              >
                <span className="block truncate text-[13px] font-semibold">{titleOf(n)}</span>
                <span className="block truncate text-[11px] text-riso-muted">
                  {formatDate(n.updatedAt)} · {n.body.slice(0, 40) || "vacía"}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {selected ? (
          <div className="flex min-h-0 flex-col bg-riso-cream">
            <input
              key={`t-${selected.id}`}
              value={selected.title}
              maxLength={NOTE_TITLE_MAX}
              onChange={(e) => notes.edit(selected.id, { title: e.target.value })}
              placeholder="Sin título"
              aria-label="Título"
              className="font-display border-b-2 border-dashed border-riso-navy/30 bg-transparent px-4 py-3 text-lg outline-none placeholder:text-riso-placeholder"
            />
            <textarea
              key={`b-${selected.id}`}
              value={selected.body}
              maxLength={NOTE_BODY_MAX}
              onChange={(e) => notes.edit(selected.id, { body: e.target.value })}
              placeholder="Escribe aquí…"
              aria-label="Texto de la nota"
              className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 font-plex text-[13px] leading-relaxed outline-none placeholder:text-riso-placeholder"
            />
          </div>
        ) : (
          <div className="grid place-items-center bg-riso-cream p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <NotesIcon size={48} />
              <p className="text-[13px]">Tus notas son privadas: solo tú las ves, desde cualquier PC.</p>
              <ToolButton onClick={() => void create()}>+ Crear la primera</ToolButton>
            </div>
          </div>
        )}
      </div>

      <StatusBar>
        <span>
          {notes.active.length} {notes.active.length === 1 ? "nota" : "notas"}
        </span>
        <span className={notes.status === "error" ? "font-semibold text-riso-pink-deep" : ""}>{saveLabel}</span>
      </StatusBar>
    </>
  );
}

// ---------- Papelera ----------

export function TrashApp({ notes, confirm }: { notes: NotesStore; confirm: Confirm }) {
  const items = [...notes.trashed].sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));

  const empty = async () => {
    const ok = await confirm({
      title: "Vaciar la papelera",
      message: `Se borrarán para siempre ${items.length} ${items.length === 1 ? "nota" : "notas"}. No se puede deshacer.`,
      confirmLabel: "Vaciar",
    });
    if (ok) await notes.emptyTrash();
  };
  const destroy = async (n: NoteDTO) => {
    const ok = await confirm({
      title: "Eliminar para siempre",
      message: `"${titleOf(n)}" se borrará para siempre. No se puede deshacer.`,
      confirmLabel: "Eliminar",
    });
    if (ok) await notes.destroy(n.id);
  };

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b-2 border-riso-navy bg-riso-cream px-2 py-1.5">
        <ToolButton onClick={() => void empty()} disabled={items.length === 0}>
          Vaciar papelera
        </ToolButton>
        <span className="ml-auto text-[11px] text-riso-muted">Las notas se quedan aquí hasta que vacíes la papelera.</span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto bg-riso-cream">
        {items.length === 0 && <li className="p-4 text-[13px] text-riso-muted">La papelera está vacía.</li>}
        {items.map((n) => (
          <li key={n.id} className="flex items-center gap-3 border-b border-dashed border-riso-navy/30 px-3 py-2">
            <NotesIcon size={24} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{titleOf(n)}</span>
              <span className="block text-[11px] text-riso-muted">Eliminada el {formatDate(n.deletedAt!)}</span>
            </span>
            <ToolButton onClick={() => void notes.restore(n.id)}>Restaurar</ToolButton>
            <ToolButton onClick={() => void destroy(n)}>Eliminar</ToolButton>
          </li>
        ))}
      </ul>
      <StatusBar>
        <span>
          {items.length} {items.length === 1 ? "elemento" : "elementos"}
        </span>
      </StatusBar>
    </>
  );
}

// ---------- Calendario ----------

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const monthFmt = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });
const longDateFmt = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });
const timeFmt = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" });

export function CalendarApp() {
  const now = useNow();
  const [offset, setOffset] = useState(0); // meses desde el actual
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // la semana empieza el lunes
  const isToday = (d: number) => offset === 0 && d === now.getDate();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-riso-cream">
      <div className="border-b-2 border-riso-navy px-4 py-3">
        <p className="font-display text-3xl leading-none">{timeFmt.format(now)}</p>
        <p className="mt-1 text-xs first-letter:uppercase">{longDateFmt.format(now)}</p>
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <ToolButton onClick={() => setOffset((o) => o - 1)}>‹</ToolButton>
        <button type="button" onClick={() => setOffset(0)} className="font-display text-sm first-letter:uppercase" title="Volver a hoy">
          {monthFmt.format(first)}
        </button>
        <ToolButton onClick={() => setOffset((o) => o + 1)}>›</ToolButton>
      </div>
      <div className="grid grid-cols-7 gap-1 px-3 pb-3 text-center text-xs">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1 font-semibold text-riso-muted">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
          <span
            key={d}
            className={`grid aspect-square place-items-center ${
              isToday(d) ? "rounded-full border-2 border-riso-navy bg-riso-pink font-semibold" : ""
            }`}
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}
