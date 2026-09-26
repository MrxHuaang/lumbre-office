"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NOTE_BODY_MAX, NOTE_TITLE_MAX, type NoteDTO } from "@/lib/notes";
import { NoteEditor, textToDoc } from "./editor/NoteEditor";
import { NotesIcon, TrashIcon } from "./icons";
import { subtree, type NotesStore } from "./useNotes";

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
      className={`border-[1.5px] border-cozy-frame bg-cozy-paper-light text-xs font-semibold hover:bg-cozy-paper-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-cozy-paper-light ${
        label ? "px-1 py-0.5" : "px-2.5 py-1"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBar({ children }: { children: React.ReactNode }) {
  return (
    <footer className="flex shrink-0 items-center justify-between gap-3 border-t-2 border-cozy-frame bg-cozy-paper-light px-3 py-1 text-[11px] text-cozy-ink-soft">
      {children}
    </footer>
  );
}

// ---------- Notas ----------

/** Hijas activas de cada página, en orden de creación. */
function childrenIndex(active: NoteDTO[]) {
  const byParent = new Map<string | null, NoteDTO[]>();
  const ids = new Set(active.map((n) => n.id));
  for (const n of [...active].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    // Si la madre no está activa (p. ej. se restauró solo la hija), la página cuelga de la raíz.
    const parent = n.parentId && ids.has(n.parentId) ? n.parentId : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), n]);
  }
  return byParent;
}

function ancestorsOf(note: NoteDTO, byId: Map<string, NoteDTO>): NoteDTO[] {
  const out: NoteDTO[] = [];
  let cur = note.parentId ? byId.get(note.parentId) : undefined;
  while (cur && out.length < 50) {
    out.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return out;
}

export function NotesApp({ notes }: { notes: NotesStore }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const editorRef = useRef<Editor | null>(null);

  const byId = useMemo(() => new Map(notes.active.map((n) => [n.id, n])), [notes.active]);
  const tree = useMemo(() => childrenIndex(notes.active), [notes.active]);
  const lastEdited = useMemo(() => [...notes.active].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0], [notes.active]);
  const selected = (selectedId ? byId.get(selectedId) : undefined) ?? lastEdited ?? null;
  const ancestors = selected ? ancestorsOf(selected, byId) : [];

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return notes.active.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
  }, [notes.active, query]);

  /** Abrir una página y desplegar sus madres en el árbol. */
  const open = (id: string) => {
    setSelectedId(id);
    const note = byId.get(id);
    if (!note) return;
    setExpanded((s) => new Set([...s, ...ancestorsOf(note, byId).map((a) => a.id)]));
  };

  const create = async (parentId: string | null = null, openIt = true) => {
    setQuery("");
    const note = await notes.create(parentId);
    if (parentId) setExpanded((s) => new Set([...s, parentId]));
    if (openIt) setSelectedId(note.id);
    return note;
  };

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const favorites = notes.active.filter((n) => n.favorite);
  const saveLabel = { idle: "", saving: "Guardando…", saved: "Guardado", error: "No se pudo guardar" }[notes.status];

  const row = (n: NoteDTO, depth: number, showTree: boolean): React.ReactNode => {
    const kids = showTree ? (tree.get(n.id) ?? []) : [];
    const isOpen = expanded.has(n.id);
    return (
      <li key={`${showTree ? "t" : "f"}-${n.id}`}>
        <div
          className={`group flex items-center gap-1 pr-1 ${n.id === selected?.id ? "bg-cozy-paper-dark" : "hover:bg-cozy-paper"}`}
          style={{ paddingLeft: 4 + depth * 12 }}
        >
          <button
            type="button"
            aria-label={isOpen ? "Contraer" : "Desplegar"}
            onClick={() => toggle(n.id)}
            className={`grid h-5 w-4 shrink-0 place-items-center text-[10px] text-cozy-ink-soft ${kids.length ? "" : "invisible"}`}
          >
            <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
          </button>
          <button type="button" onClick={() => open(n.id)} className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left">
            <NotesIcon size={14} />
            <span className="truncate text-[12.5px] font-semibold">{titleOf(n)}</span>
          </button>
          {showTree && (
            <button
              type="button"
              title="Agregar una subpágina"
              aria-label={`Agregar una subpágina a ${titleOf(n)}`}
              onClick={() => void create(n.id)}
              className="invisible grid h-5 w-5 shrink-0 place-items-center text-sm font-semibold text-cozy-ink-soft group-hover:visible hover:bg-cozy-paper-light hover:text-cozy-ink"
            >
              +
            </button>
          )}
        </div>
        {showTree && isOpen && kids.length > 0 && <ul>{kids.map((k) => row(k, depth + 1, true))}</ul>}
      </li>
    );
  };

  const pages = {
    titleOf: (id: string) => byId.get(id)?.title ?? null,
    open,
  };

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,210px)_minmax(0,1fr)] max-sm:grid-cols-[minmax(0,130px)_minmax(0,1fr)]">
        {/* Barra lateral: búsqueda, favoritos y árbol de páginas. */}
        <aside className="flex min-h-0 flex-col border-r-2 border-cozy-frame bg-cozy-paper-light">
          <div className="flex flex-col gap-1.5 border-b-2 border-cozy-frame p-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              aria-label="Buscar notas"
              className="cozy-input w-full px-2 py-1 text-xs shadow-none"
            />
            <ToolButton onClick={() => void create()}>+ Nueva página</ToolButton>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto py-1">
            {notes.loading && <p className="p-3 text-xs text-cozy-ink-soft">Cargando…</p>}
            {results ? (
              <>
                <SideLabel>Resultados</SideLabel>
                {results.length === 0 && <p className="px-3 text-xs text-cozy-ink-soft">Nada coincide.</p>}
                <ul>{results.map((n) => row(n, 0, false))}</ul>
              </>
            ) : (
              <>
                {favorites.length > 0 && (
                  <>
                    <SideLabel>Favoritos</SideLabel>
                    <ul className="mb-2">{favorites.map((n) => row(n, 0, false))}</ul>
                  </>
                )}
                <SideLabel>Páginas</SideLabel>
                {!notes.loading && notes.active.length === 0 && <p className="px-3 text-xs text-cozy-ink-soft">Aún no tienes páginas.</p>}
                <ul>{(tree.get(null) ?? []).map((n) => row(n, 0, true))}</ul>
              </>
            )}
          </nav>
        </aside>

        {selected ? (
          <div className="flex min-h-0 flex-col bg-cozy-paper-light">
            {/* Ruta de la página (madres) y acciones. */}
            <div className="flex shrink-0 items-center gap-2 border-b border-dashed border-cozy-frame/30 px-3 py-1.5">
              <nav aria-label="Ruta" className="flex min-w-0 flex-1 items-center gap-1 text-[11.5px] text-cozy-ink-soft">
                {ancestors.map((a) => (
                  <span key={a.id} className="flex min-w-0 items-center gap-1">
                    <button type="button" onClick={() => open(a.id)} className="truncate hover:text-cozy-ink hover:underline">
                      {titleOf(a)}
                    </button>
                    <span aria-hidden>/</span>
                  </span>
                ))}
                <span className="truncate font-semibold text-cozy-ink">{titleOf(selected)}</span>
              </nav>
              <button
                type="button"
                aria-pressed={selected.favorite}
                title={selected.favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                aria-label={selected.favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                onClick={() => void notes.setFavorite(selected.id, !selected.favorite)}
                className={`grid h-6 w-6 place-items-center text-base ${selected.favorite ? "text-cozy-red-deep" : "text-cozy-ink-soft hover:text-cozy-ink"}`}
              >
                {selected.favorite ? "★" : "☆"}
              </button>
              <ToolButton onClick={() => void notes.trash(selected.id)} label="Mandar a la papelera">
                <TrashIcon size={18} full={false} />
              </ToolButton>
            </div>

            <input
              key={`t-${selected.id}`}
              value={selected.title}
              maxLength={NOTE_TITLE_MAX}
              onChange={(e) => notes.edit(selected.id, { title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  editorRef.current?.commands.focus("start");
                }
              }}
              placeholder="Sin título"
              aria-label="Título"
              className="font-semibold shrink-0 bg-transparent pt-4 pr-4 pb-2 pl-9 text-2xl outline-none placeholder:text-cozy-placeholder"
            />
            <NoteEditor
              key={selected.id}
              initial={selected.content ?? textToDoc(selected.body)}
              onChange={(doc, text) => notes.edit(selected.id, { content: doc, body: text.slice(0, NOTE_BODY_MAX) })}
              pages={pages}
              onCreateSubpage={async () => (await create(selected.id, false)).id}
              editorRef={editorRef}
            />
          </div>
        ) : (
          <div className="grid place-items-center bg-cozy-paper-light p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <NotesIcon size={48} />
              <p className="max-w-xs text-[13px]">Tus notas son privadas: solo tú las ves, desde cualquier PC.</p>
              <ToolButton onClick={() => void create()}>+ Crear la primera página</ToolButton>
            </div>
          </div>
        )}
      </div>

      <StatusBar>
        <span>
          {notes.active.length} {notes.active.length === 1 ? "página" : "páginas"} · escribe &quot;/&quot; para insertar bloques
        </span>
        <span className={notes.status === "error" ? "font-semibold text-cozy-red-deep" : ""}>{saveLabel}</span>
      </StatusBar>
    </>
  );
}

function SideLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold tracking-[0.12em] text-cozy-ink-soft uppercase">{children}</p>;
}

// ---------- Papelera ----------

export function TrashApp({ notes, confirm }: { notes: NotesStore; confirm: Confirm }) {
  // Solo la página de arriba de cada rama borrada: sus subpáginas van (y vuelven) con ella.
  const trashedIds = new Set(notes.trashed.map((n) => n.id));
  const items = notes.trashed
    .filter((n) => !n.parentId || !trashedIds.has(n.parentId))
    .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
  const subpagesOf = (n: NoteDTO) => subtree(n.id, notes.trashed).size - 1;

  const empty = async () => {
    const ok = await confirm({
      title: "Vaciar la papelera",
      message: `Se borrarán para siempre ${notes.trashed.length} ${notes.trashed.length === 1 ? "página" : "páginas"}. No se puede deshacer.`,
      confirmLabel: "Vaciar",
    });
    if (ok) await notes.emptyTrash();
  };
  const destroy = async (n: NoteDTO) => {
    const ok = await confirm({
      title: "Eliminar para siempre",
      message: `"${titleOf(n)}"${subpagesOf(n) ? ` y sus ${subpagesOf(n)} subpáginas` : ""} se borrará para siempre. No se puede deshacer.`,
      confirmLabel: "Eliminar",
    });
    if (ok) await notes.destroy(n.id);
  };

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b-2 border-cozy-frame bg-cozy-paper-light px-2 py-1.5">
        <ToolButton onClick={() => void empty()} disabled={items.length === 0}>
          Vaciar papelera
        </ToolButton>
        <span className="ml-auto text-[11px] text-cozy-ink-soft">Las notas se quedan aquí hasta que vacíes la papelera.</span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto bg-cozy-paper-light">
        {items.length === 0 && <li className="p-4 text-[13px] text-cozy-ink-soft">La papelera está vacía.</li>}
        {items.map((n) => (
          <li key={n.id} className="flex items-center gap-3 border-b border-dashed border-cozy-frame/30 px-3 py-2">
            <NotesIcon size={24} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{titleOf(n)}</span>
              <span className="block text-[11px] text-cozy-ink-soft">
                Eliminada el {formatDate(n.deletedAt!)}
                {subpagesOf(n) > 0 && ` · con ${subpagesOf(n)} ${subpagesOf(n) === 1 ? "subpágina" : "subpáginas"}`}
              </span>
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
    <div className="flex min-h-0 flex-1 flex-col bg-cozy-paper-light">
      <div className="border-b-2 border-cozy-frame px-4 py-3">
        <p className="font-semibold text-3xl leading-none">{timeFmt.format(now)}</p>
        <p className="mt-1 text-xs first-letter:uppercase">{longDateFmt.format(now)}</p>
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <ToolButton onClick={() => setOffset((o) => o - 1)}>‹</ToolButton>
        <button type="button" onClick={() => setOffset(0)} className="font-semibold text-sm first-letter:uppercase" title="Volver a hoy">
          {monthFmt.format(first)}
        </button>
        <ToolButton onClick={() => setOffset((o) => o + 1)}>›</ToolButton>
      </div>
      <div className="grid grid-cols-7 gap-1 px-3 pb-3 text-center text-xs">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1 font-semibold text-cozy-ink-soft">
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
              isToday(d) ? "rounded-full border-2 border-cozy-frame bg-cozy-red font-semibold" : ""
            }`}
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}
