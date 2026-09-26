import { z } from "zod";

/** Nota tal como la ve el cliente (fechas en ISO). */
export interface NoteDTO {
  id: string;
  title: string;
  /** Texto plano (búsqueda y vista previa). */
  body: string;
  /** Documento del editor (JSON de TipTap); null = nota antigua, se arma desde `body`. */
  content: EditorDoc | null;
  /** Nota madre (null = en la raíz). */
  parentId: string | null;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  /** En la papelera desde esta fecha; null = activa. */
  deletedAt: string | null;
}

export const NOTE_TITLE_MAX = 120;
export const NOTE_BODY_MAX = 100_000;
/** Tamaño máximo del documento del editor, serializado. */
export const NOTE_CONTENT_MAX = 500_000;

/** Documento de TipTap: se valida la forma de arriba y el tamaño, no cada nodo. */
export const EditorDoc = z
  .object({ type: z.literal("doc"), content: z.array(z.unknown()).optional() })
  .passthrough()
  .refine((d) => JSON.stringify(d).length <= NOTE_CONTENT_MAX, "La nota es demasiado grande");
export type EditorDoc = z.infer<typeof EditorDoc>;

export const NoteCreate = z.object({
  title: z.string().max(NOTE_TITLE_MAX).default(""),
  body: z.string().max(NOTE_BODY_MAX).default(""),
  parentId: z.string().min(1).nullable().default(null),
});

export const NoteUpdate = z.object({
  title: z.string().max(NOTE_TITLE_MAX).optional(),
  body: z.string().max(NOTE_BODY_MAX).optional(),
  content: EditorDoc.optional(),
  favorite: z.boolean().optional(),
  /** true = mandar a la papelera (con sus subpáginas), false = restaurar. */
  trashed: z.boolean().optional(),
});
export type NoteUpdate = z.infer<typeof NoteUpdate>;

export const NOTE_SELECT = {
  id: true,
  title: true,
  body: true,
  content: true,
  parentId: true,
  favorite: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

export function toNoteDTO(n: {
  id: string;
  title: string;
  body: string;
  content: unknown;
  parentId: string | null;
  favorite: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): NoteDTO {
  const content = EditorDoc.safeParse(n.content);
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    content: content.success ? content.data : null,
    parentId: n.parentId,
    favorite: n.favorite,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    deletedAt: n.deletedAt?.toISOString() ?? null,
  };
}

/** Ids de una nota y todas sus subpáginas (a cualquier profundidad). */
export function subtreeIds(rootId: string, notes: { id: string; parentId: string | null }[]): string[] {
  const children = new Map<string, string[]>();
  for (const n of notes) if (n.parentId) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n.id]);
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}
