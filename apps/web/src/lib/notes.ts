import { z } from "zod";

/** Nota tal como la ve el cliente (fechas en ISO). */
export interface NoteDTO {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  /** En la papelera desde esta fecha; null = activa. */
  deletedAt: string | null;
}

export const NOTE_TITLE_MAX = 120;
export const NOTE_BODY_MAX = 100_000;

export const NoteCreate = z.object({
  title: z.string().max(NOTE_TITLE_MAX).default(""),
  body: z.string().max(NOTE_BODY_MAX).default(""),
});

export const NoteUpdate = z.object({
  title: z.string().max(NOTE_TITLE_MAX).optional(),
  body: z.string().max(NOTE_BODY_MAX).optional(),
  /** true = mandar a la papelera, false = restaurar. */
  trashed: z.boolean().optional(),
});
export type NoteUpdate = z.infer<typeof NoteUpdate>;

export const NOTE_SELECT = { id: true, title: true, body: true, createdAt: true, updatedAt: true, deletedAt: true } as const;

export function toNoteDTO(n: { id: string; title: string; body: string; createdAt: Date; updatedAt: Date; deletedAt: Date | null }): NoteDTO {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    deletedAt: n.deletedAt?.toISOString() ?? null,
  };
}
