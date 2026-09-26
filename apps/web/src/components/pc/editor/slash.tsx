"use client";

import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { Extension, type Editor, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

/** Un bloque del menú "/". */
export interface SlashItem {
  title: string;
  description: string;
  /** Ícono corto (texto) del bloque. */
  icon: string;
  keywords: string[];
  run: (editor: Editor, range: Range) => void;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Filtra por título y palabras clave. Primero los que empiezan con lo escrito en el título, luego
 * por palabra clave y al final los que solo lo contienen (así "/sub" elige Subpágina, no Título 2).
 */
export function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  const q = fold(query.trim());
  if (!q) return items;
  const score = (i: SlashItem) => {
    const title = fold(i.title);
    const words = i.keywords.map(fold);
    if (title.startsWith(q)) return 0;
    if (title.split(" ").some((w) => w.startsWith(q))) return 1;
    if (words.some((w) => w.startsWith(q))) return 2;
    if ([title, ...words].some((w) => w.includes(q))) return 3;
    return -1;
  };
  return items
    .map((item, index) => ({ item, index, s: score(item) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.index - b.index)
    .map((x) => x.item);
}

/** Bloques que se pueden insertar escribiendo "/" (la subpágina la agrega el editor). */
export const BASIC_BLOCKS: SlashItem[] = [
  { title: "Texto", description: "Un párrafo normal", icon: "¶", keywords: ["parrafo", "text", "p"], run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
  { title: "Título 1", description: "Encabezado grande", icon: "H1", keywords: ["h1", "titulo", "heading"], run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
  { title: "Título 2", description: "Encabezado mediano", icon: "H2", keywords: ["h2", "subtitulo"], run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
  { title: "Título 3", description: "Encabezado pequeño", icon: "H3", keywords: ["h3"], run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
  { title: "Lista", description: "Lista con viñetas", icon: "•", keywords: ["vinetas", "bullet", "ul"], run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: "Lista numerada", description: "Lista con números", icon: "1.", keywords: ["numeros", "ordered", "ol"], run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: "Pendientes", description: "Lista de tareas con casillas", icon: "☑", keywords: ["tareas", "todo", "checkbox", "casillas"], run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { title: "Desplegable", description: "Contenido que se abre y se cierra", icon: "▸", keywords: ["toggle", "details", "acordeon"], run: (e, r) => e.chain().focus().deleteRange(r).setDetails().run() },
  { title: "Cita", description: "Texto destacado a un lado", icon: "❝", keywords: ["quote", "blockquote"], run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: "Código", description: "Bloque de código", icon: "</>", keywords: ["code", "codigo"], run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { title: "Separador", description: "Una línea para dividir", icon: "—", keywords: ["divider", "hr", "linea"], run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
  { title: "Tabla", description: "Tabla de 3 × 3 con encabezado", icon: "▦", keywords: ["table", "tabla"], run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
];

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/** Lista flotante del menú "/", navegable con flechas y Enter. */
const SlashMenu = forwardRef<SlashMenuHandle, SuggestionProps<SlashItem, SlashItem>>(function SlashMenu({ items, command }, ref) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => setIndex(0), [items]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (!items.length) return false;
      if (event.key === "ArrowDown") {
        setIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[index];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  return (
    <div ref={listRef} className="riso-panel max-h-72 w-64 overflow-y-auto py-1 font-plex text-riso-navy">
      <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.12em] text-riso-muted uppercase">Bloques</p>
      {items.length === 0 && <p className="px-3 pb-2 text-xs text-riso-muted">Sin resultados</p>}
      {items.map((item, i) => (
        <button
          key={item.title}
          type="button"
          data-index={i}
          onMouseEnter={() => setIndex(i)}
          onMouseDown={(e) => {
            e.preventDefault(); // no perder la selección del editor
            command(item);
          }}
          className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left ${i === index ? "bg-riso-yellow" : ""}`}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center border-[1.5px] border-riso-navy bg-riso-cream text-[12px] font-semibold">
            {item.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold">{item.title}</span>
            <span className="block truncate text-[11px] text-riso-muted">{item.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
});

/**
 * Menú "/" de Notion: al escribir "/" aparece la lista de bloques, filtrada por lo que se escriba
 * después. `getItems` se lee en cada apertura (así puede incluir acciones que dependen de la nota).
 */
export const SlashCommand = Extension.create<{ getItems: () => SlashItem[] }>({
  name: "slashCommand",

  addOptions() {
    return { getItems: () => BASIC_BLOCKS };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: "/",
        // No dentro de código (ahí "/" es un carácter normal).
        allow: ({ editor }) => !editor.isActive("codeBlock"),
        items: ({ query }) => filterSlashItems(this.options.getItems(), query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: ReactRenderer<SlashMenuHandle, SuggestionProps<SlashItem, SlashItem>> | null = null;

          const place = (props: SuggestionProps<SlashItem, SlashItem>) => {
            const el = renderer?.element as HTMLElement | undefined;
            const rect = props.clientRect?.();
            if (!el || !rect) return;
            void computePosition({ getBoundingClientRect: () => rect }, el, {
              strategy: "fixed",
              placement: "bottom-start",
              middleware: [offset(6), flip(), shift({ padding: 8 })],
            }).then(({ x, y }) => Object.assign(el.style, { left: `${x}px`, top: `${y}px` }));
          };

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, { props, editor: props.editor });
              const el = renderer.element as HTMLElement;
              Object.assign(el.style, { position: "fixed", zIndex: "2000", left: "0px", top: "0px" });
              document.body.appendChild(el);
              place(props);
            },
            onUpdate: (props) => {
              renderer?.updateProps(props);
              place(props);
            },
            onKeyDown: ({ event }) => {
              if (event.key === "Escape") {
                renderer?.element.remove();
                return true;
              }
              return renderer?.ref?.onKeyDown(event) ?? false;
            },
            onExit: () => {
              renderer?.element.remove();
              renderer?.destroy();
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});
