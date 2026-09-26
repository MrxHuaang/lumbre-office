"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { createContext, useContext } from "react";
import { NotesIcon } from "../icons";

/** Lo que el bloque de subpágina necesita saber de las demás notas. */
export interface PagesApi {
  /** Título de una página, o null si ya no existe o está en la papelera. */
  titleOf: (id: string) => string | null;
  open: (id: string) => void;
}

export const PagesContext = createContext<PagesApi>({ titleOf: () => null, open: () => undefined });

function PageLinkView({ node }: ReactNodeViewProps) {
  const pages = useContext(PagesContext);
  const id = node.attrs.id as string | null;
  const title = id ? pages.titleOf(id) : null;
  return (
    <NodeViewWrapper className="note-page-link" data-drag-handle>
      <button
        type="button"
        contentEditable={false}
        disabled={title === null}
        onClick={() => id && pages.open(id)}
        className="flex w-full items-center gap-2 px-1.5 py-1 text-left hover:bg-riso-yellow/60 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
      >
        <NotesIcon size={18} />
        <span className="border-b-[1.5px] border-riso-navy/30 font-semibold">
          {title === null ? "Página eliminada" : title.trim() || "Sin título"}
        </span>
      </button>
    </NodeViewWrapper>
  );
}

/** Bloque que enlaza a una subpágina (se crea con "/Subpágina"). */
export const PageLink = Node.create({
  name: "pageLink",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return { id: { default: null } };
  },

  parseHTML() {
    return [{ tag: "div[data-page-link]", getAttrs: (el) => ({ id: (el as HTMLElement).dataset.pageLink || null }) }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-page-link": node.attrs.id ?? "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageLinkView);
  },
});
