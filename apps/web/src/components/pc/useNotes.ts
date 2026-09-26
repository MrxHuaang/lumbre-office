"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteDTO } from "@/lib/notes";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 600;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Error de red");
  return res.json() as Promise<T>;
}

/**
 * Notas del usuario (activas y en la papelera). Los cambios de texto se ven al instante y se
 * guardan solos poco después; `flush()` espera a que no quede nada pendiente (al apagar el PC).
 */
export function useNotes() {
  const [notes, setNotes] = useState<NoteDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  /** Cambios de texto que aún no se enviaron, por nota. */
  const pending = useRef(new Map<string, { title?: string; body?: string }>());
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
        if (patch) void fetch(`/api/notes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch), keepalive: true });
      }
    };
  }, []);

  const replace = (note: NoteDTO) => setNotes((list) => (list ?? []).map((n) => (n.id === note.id ? note : n)));

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

  /** Editar título o texto (se guarda solo). */
  const edit = useCallback(
    (id: string, patch: { title?: string; body?: string }) => {
      setNotes((list) =>
        (list ?? []).map((n) => (n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)),
      );
      pending.current.set(id, { ...pending.current.get(id), ...patch });
      setStatus("saving");
      clearTimeout(timers.current.get(id));
      timers.current.set(id, setTimeout(() => send(id), SAVE_DELAY_MS));
    },
    [send],
  );

  const create = useCallback(async () => {
    const { note } = await track(api<{ note: NoteDTO }>("/api/notes", { method: "POST", body: "{}" }));
    setNotes((list) => [note, ...(list ?? [])]);
    return note;
  }, []);

  const setTrashed = useCallback(
    async (id: string, trashed: boolean) => {
      // Primero lo que se estaba escribiendo, para que no se pierda al mandarla a la papelera.
      if (timers.current.has(id)) {
        clearTimeout(timers.current.get(id));
        send(id);
      }
      const { note } = await track(
        api<{ note: NoteDTO }>(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify({ trashed }) }),
      );
      replace(note);
    },
    [send],
  );

  const destroy = useCallback(async (id: string) => {
    await track(api(`/api/notes/${id}`, { method: "DELETE" }));
    setNotes((list) => (list ?? []).filter((n) => n.id !== id));
  }, []);

  const emptyTrash = useCallback(async () => {
    await track(api("/api/notes/trash", { method: "DELETE" }));
    setNotes((list) => (list ?? []).filter((n) => !n.deletedAt));
  }, []);

  /** Envía lo pendiente y espera a que termine (para apagar sin perder nada). */
  const flush = useCallback(async () => {
    for (const id of [...timers.current.keys()]) {
      clearTimeout(timers.current.get(id));
      send(id);
    }
    await Promise.allSettled([...inflight.current]);
  }, [send]);

  return {
    notes,
    active: (notes ?? []).filter((n) => !n.deletedAt),
    trashed: (notes ?? []).filter((n) => n.deletedAt),
    loading: notes === null && !error,
    error,
    status,
    edit,
    create,
    trash: (id: string) => setTrashed(id, true),
    restore: (id: string) => setTrashed(id, false),
    destroy,
    emptyTrash,
    flush,
  };
}

export type NotesStore = ReturnType<typeof useNotes>;
