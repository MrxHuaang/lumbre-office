"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorDoc, NoteDTO } from "@/lib/notes";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type ContentPatch = { title?: string; body?: string; content?: EditorDoc };

const SAVE_DELAY_MS = 700;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Error de red");
  return res.json() as Promise<T>;
}

/** Ids de una nota y todas sus subpáginas. */
export function subtree(id: string, list: NoteDTO[]): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of list) {
      if (n.parentId && out.has(n.parentId) && !out.has(n.id)) {
        out.add(n.id);
        grew = true;
      }
    }
  }
  return out;
}

/**
 * Notas del usuario (activas y en la papelera), con subpáginas y favoritos. Los cambios de texto
 * se ven al instante y se guardan solos poco después; `flush()` espera a que no quede nada
 * pendiente (al apagar el PC).
 */
export function useNotes() {
  const [notes, setNotes] = useState<NoteDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  /** Cambios de contenido que aún no se enviaron, por nota. */
  const pending = useRef(new Map<string, ContentPatch>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inflight = useRef(new Set<Promise<unknown>>());

  useEffect(() => {
    api<{ notes: NoteDTO[] }>("/api/notes")
      .then((r) => setNotes(r.notes))
      .catch((e: Error) => setError(e.message));
  }, []);

  // Si el PC se cierra de golpe (p. ej. te levantaste), enviar lo que quedaba por guardar.
  useEffect(() => {
    const t = timers.current;
    const p = pending.current;
    return () => {
      for (const [id, timer] of t) {
        clearTimeout(timer);
        const patch = p.get(id);
        if (patch) {
          void fetch(`/api/notes/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
            keepalive: true,
          });
        }
      }
    };
  }, []);

  const merge = (changed: NoteDTO[]) =>
    setNotes((list) => {
      const byId = new Map(changed.map((n) => [n.id, n]));
      return (list ?? []).map((n) => byId.get(n.id) ?? n);
    });

  const track = <T,>(p: Promise<T>) => {
    inflight.current.add(p);
    p.finally(() => inflight.current.delete(p)).catch(() => undefined);
    return p;
  };

  const send = useCallback((id: string) => {
    const patch = pending.current.get(id);
    timers.current.delete(id);
    if (!patch) return;
    pending.current.delete(id);
    setStatus("saving");
    track(api<{ note: NoteDTO }>(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify(patch) }))
      .then(() => setStatus(pending.current.size ? "saving" : "saved"))
      .catch(() => setStatus("error"));
  }, []);

  /** Enviar ya lo pendiente de una nota (antes de moverla a la papelera, por ejemplo). */
  const sendNow = useCallback(
    (id: string) => {
      if (!timers.current.has(id)) return;
      clearTimeout(timers.current.get(id));
      send(id);
    },
    [send],
  );

  /** Editar título, texto o documento (se guarda solo). */
  const edit = useCallback(
    (id: string, patch: ContentPatch) => {
      setNotes((list) => (list ?? []).map((n) => (n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)));
      pending.current.set(id, { ...pending.current.get(id), ...patch });
      setStatus("saving");
      clearTimeout(timers.current.get(id));
      timers.current.set(id, setTimeout(() => send(id), SAVE_DELAY_MS));
    },
    [send],
  );

  /** Nueva página, en la raíz o dentro de otra. */
  const create = useCallback(async (parentId: string | null = null) => {
    const { note } = await track(api<{ note: NoteDTO }>("/api/notes", { method: "POST", body: JSON.stringify({ parentId }) }));
    setNotes((list) => [...(list ?? []), note]);
    return note;
  }, []);

  const setFavorite = useCallback(async (id: string, favorite: boolean) => {
    setNotes((list) => (list ?? []).map((n) => (n.id === id ? { ...n, favorite } : n)));
    const { note } = await track(api<{ note: NoteDTO }>(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify({ favorite }) }));
    merge([note]);
  }, []);

  const setTrashed = useCallback(
    async (id: string, trashed: boolean) => {
      // Primero lo que se estaba escribiendo en la rama, para que no se pierda.
      for (const sid of subtree(id, notes ?? [])) sendNow(sid);
      const { changed } = await track(
        api<{ note: NoteDTO; changed: NoteDTO[] }>(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify({ trashed }) }),
      );
      merge(changed);
    },
    [notes, sendNow],
  );

  const destroy = useCallback(async (id: string) => {
    await track(api(`/api/notes/${id}`, { method: "DELETE" }));
    setNotes((list) => {
      const gone = subtree(id, list ?? []);
      return (list ?? []).filter((n) => !gone.has(n.id));
    });
  }, []);

  const emptyTrash = useCallback(async () => {
    await track(api("/api/notes/trash", { method: "DELETE" }));
    setNotes((list) => (list ?? []).filter((n) => !n.deletedAt));
  }, []);

  /** Envía lo pendiente y espera a que termine (para apagar sin perder nada). */
  const flush = useCallback(async () => {
    for (const id of [...timers.current.keys()]) sendNow(id);
    await Promise.allSettled([...inflight.current]);
  }, [sendNow]);

  const all = notes ?? [];
  return {
    notes: all,
    active: all.filter((n) => !n.deletedAt),
    trashed: all.filter((n) => n.deletedAt),
    loading: notes === null && !error,
    error,
    status,
    edit,
    create,
    setFavorite,
    trash: (id: string) => setTrashed(id, true),
    restore: (id: string) => setTrashed(id, false),
    destroy,
    emptyTrash,
    flush,
  };
}

export type NotesStore = ReturnType<typeof useNotes>;
