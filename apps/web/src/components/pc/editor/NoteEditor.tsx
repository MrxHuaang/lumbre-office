"use client";

import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import DragHandle from "@tiptap/extension-drag-handle-react";
import Highlight from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import type { JSONContent } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import type { EditorDoc } from "@/lib/notes";
import { PageLink, PagesContext, type PagesApi } from "./PageLink";
import { BASIC_BLOCKS, SlashCommand, type SlashItem } from "./slash";

/** Notas antiguas (texto plano): cada línea pasa a ser un párrafo. */
export function textToDoc(text: string): EditorDoc {
  const lines = text.split("\n");
  return {
    type: "doc",
    content: lines.map((line) => (line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" })),
  };
}

interface NoteEditorProps {
  initial: EditorDoc;
  onChange: (doc: EditorDoc, text: string) => void;
  pages: PagesApi;
  /** Crea una subpágina de esta nota (sin abrirla) y devuelve su id (para "/Subpágina"). */
  onCreateSubpage: () => Promise<string | null>;
  /** Para poder enfocar el editor desde el título (Enter). */
  editorRef?: React.MutableRefObject<Editor | null>;
}

/** Editor de bloques estilo Notion: "/" para insertar, atajos Markdown, formato al seleccionar, arrastrar bloques y tablas. */
export function NoteEditor({ initial, onChange, pages, onCreateSubpage, editorRef }: NoteEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const createRef = useRef(onCreateSubpage);
  createRef.current = onCreateSubpage;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  const subpage: SlashItem = {
    title: "Subpágina",
    description: "Una página dentro de esta",
    icon: "▤",
    keywords: ["pagina", "page", "subpagina"],
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      // Primero el enlace en esta página (para que quede guardado) y después se abre la nueva, como en Notion.
      void createRef.current().then((id) => {
        if (!id) return;
        editor.chain().focus().insertContent({ type: "pageLink", attrs: { id } }).run();
        pagesRef.current.open(id);
      });
    },
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
        dropcursor: { color: "#ff48b0", width: 3 },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      TableKit.configure({ table: { resizable: false } }),
      Details.configure({ persist: true }),
      DetailsSummary,
      DetailsContent,
      PageLink,
      Placeholder.configure({
        includeChildren: true,
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return `Título ${node.attrs.level}`;
          if (node.type.name === "detailsSummary") return "Título del desplegable";
          return "Escribe \"/\" para ver los bloques…";
        },
      }),
      SlashCommand.configure({ getItems: () => [...BASIC_BLOCKS, subpage] }),
    ],
    content: initial as JSONContent,
    editorProps: { attributes: { class: "note-editor", spellcheck: "true" } },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getJSON() as EditorDoc, editor.getText({ blockSeparator: "\n" })),
  });

  useEffect(() => {
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  if (!editor) return null;

  return (
    <PagesContext.Provider value={pages}>
      <div className="relative min-h-0 flex-1 overflow-y-auto pr-4 pb-10 pl-9">
        <DragHandle editor={editor}>
          <div className="note-drag-handle" title="Arrastra para mover el bloque">
            ⋮⋮
          </div>
        </DragHandle>
        <FormatMenu editor={editor} />
        <TableMenu editor={editor} />
        <EditorContent editor={editor} />
      </div>
    </PagesContext.Provider>
  );
}

// ---------- Menú de formato (al seleccionar texto) ----------

function FormatMenu({ editor }: { editor: Editor }) {
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("");
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      highlight: e.isActive("highlight"),
      link: e.isActive("link"),
    }),
  });

  const applyLink = () => {
    const href = url.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href) chain.setLink({ href }).run();
    else chain.unsetLink().run();
    setLinking(false);
  };

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="formatMenu"
      appendTo={() => document.body}
      options={{ strategy: "fixed", placement: "top", offset: 8, onHide: () => setLinking(false) }}
      shouldShow={({ editor: e, state: s }) =>
        !s.selection.empty && !(s.selection instanceof NodeSelection) && !e.isActive("codeBlock") && e.isEditable
      }
      className="z-[2000] flex items-center border-2 border-riso-navy bg-riso-navy font-plex shadow-[3px_3px_0_var(--color-riso-pink)]"
    >
      {linking ? (
        <form
          className="flex items-center"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Pega un enlace…"
            className="w-52 bg-riso-cream px-2 py-1 text-xs text-riso-navy outline-none"
          />
          <MenuButton label="Aplicar enlace" onClick={applyLink}>
            ↵
          </MenuButton>
        </form>
      ) : (
        <>
          <MenuButton label="Negrita" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
            <b>B</b>
          </MenuButton>
          <MenuButton label="Cursiva" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <i>I</i>
          </MenuButton>
          <MenuButton label="Tachado" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <s>S</s>
          </MenuButton>
          <MenuButton label="Código" active={state.code} onClick={() => editor.chain().focus().toggleCode().run()}>
            {"</>"}
          </MenuButton>
          <MenuButton label="Resaltar" active={state.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()}>
            <span className="bg-riso-yellow px-0.5 text-riso-navy">A</span>
          </MenuButton>
          <MenuButton
            label="Enlace"
            active={state.link}
            onClick={() => {
              setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
              setLinking(true);
            }}
          >
            ↗
          </MenuButton>
        </>
      )}
    </BubbleMenu>
  );
}

function MenuButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-7 min-w-7 place-items-center px-1.5 text-[13px] ${
        active ? "bg-riso-pink text-riso-navy" : "text-riso-paper hover:bg-riso-blue"
      }`}
    >
      {children}
    </button>
  );
}

// ---------- Menú de tabla (con el cursor dentro de una tabla) ----------

function TableMenu({ editor }: { editor: Editor }) {
  const run = (fn: (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => fn(editor.chain().focus()).run();
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableMenu"
      appendTo={() => document.body}
      options={{ strategy: "fixed", placement: "bottom", offset: 8 }}
      shouldShow={({ editor: e, state: s }) => e.isActive("table") && s.selection.empty}
      className="z-[2000] flex flex-wrap items-center gap-px border-2 border-riso-navy bg-riso-navy font-plex text-[11px] font-semibold shadow-[3px_3px_0_var(--color-riso-blue)]"
    >
      {(
        [
          ["+ Fila", (c) => c.addRowAfter()],
          ["+ Columna", (c) => c.addColumnAfter()],
          ["− Fila", (c) => c.deleteRow()],
          ["− Columna", (c) => c.deleteColumn()],
          ["Borrar tabla", (c) => c.deleteTable()],
        ] as [string, (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>][]
      ).map(([label, fn]) => (
        <button
          key={label}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run(fn)}
          className="bg-riso-cream px-2 py-1 text-riso-navy hover:bg-riso-yellow"
        >
          {label}
        </button>
      ))}
    </BubbleMenu>
  );
}
