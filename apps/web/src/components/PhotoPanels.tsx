"use client";

// Fotos: la tecla P (o el botón "Foto" de la barra) pide una foto al servidor; al disparar, la pantalla
// hace flash y aparece la polaroid para escribirle un pie y pincharla en el tablón de la cafetería. El
// tablón (E al lado) abre la galería con las fotos grandes.
import { getWorld } from "@hyvento/map";
import { PHOTO, peopleText, photoDateText, type PhotoDTO } from "@hyvento/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { composePolaroid, encodePolaroid } from "@/game/photos/capture";
import { photoErrorText, photoImageUrl, usePhotoStore, type PendingPhoto } from "@/game/photos/store";
import { sendPhotoTake } from "@/game/network";
import { useOfficeStore } from "@/game/store";
import { focusOwnsKey } from "@/lib/keyboardFocus";
import { PanelShell } from "./PointsPanels";

const areaName = (id: string) => getWorld().areas.get(id)?.def.name ?? id;

/** ¿Se puede sacar una foto ahora? (no mientras cuenta, hay una sin subir, se escribe o está el PC). */
function canShoot() {
  const { typing, pcOn, panel } = useOfficeStore.getState();
  const { countingUntil, pending } = usePhotoStore.getState();
  return !typing && !pcOn && !panel && !pending && countingUntil < Date.now();
}

/** Pedir una foto (la pausa entre fotos la aplica el servidor). */
export function takePhoto() {
  if (canShoot()) sendPhotoTake();
}

/** La tecla P saca una foto (no mientras se escribe, con el PC prendido o un panel abierto). */
export function usePhotoKey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "p" || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (focusOwnsKey(e.key) || !canShoot()) return;
      e.preventDefault();
      sendPhotoTake();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Mientras cuenta mi foto (o hay una sin subir), el botón queda esperando. */
export function usePhotoCounting(): { counting: boolean; busy: boolean } {
  const until = usePhotoStore((s) => s.countingUntil);
  const pending = usePhotoStore((s) => s.pending);
  const [, force] = useState(0);
  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setTimeout(() => force((n) => n + 1), until - Date.now() + 20);
    return () => clearTimeout(t);
  }, [until]);
  const counting = until > Date.now();
  return { counting, busy: counting || pending !== null };
}

/** El flash de mi cámara: la pantalla en blanco un instante (el canvas ya se recortó). */
export function PhotoFlash() {
  const flashAt = usePhotoStore((s) => s.flashAt);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!flashAt) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 30);
    return () => clearTimeout(t);
  }, [flashAt]);
  if (!flashAt) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-50 bg-white"
      style={{ opacity: on ? 0.95 : 0, transition: on ? "none" : "opacity 420ms ease-out" }}
    />
  );
}

/** Polaroid como imagen (data URL) para la vista previa, con el pie que se está escribiendo. */
function usePolaroidUrl(p: PendingPhoto, caption: string) {
  return useMemo(
    () => composePolaroid(p.shot, { takenAt: p.takenAt, areaName: areaName(p.area), people: p.people, caption }, 2).toDataURL("image/png"),
    [p, caption],
  );
}

/** La foto recién sacada: escribirle un pie (opcional) y pincharla en el tablón, o descartarla. */
export function PhotoPreview() {
  const pending = usePhotoStore((s) => s.pending);
  if (!pending) return null;
  return <PreviewDialog key={pending.id} pending={pending} />;
}

function PreviewDialog({ pending }: { pending: PendingPhoto }) {
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = usePolaroidUrl(pending, caption.trim());
  const close = useCallback(() => usePhotoStore.getState().setPending(null), []);

  const pin = async () => {
    setSaving(true);
    setError(null);
    try {
      const info = { takenAt: pending.takenAt, areaName: areaName(pending.area), people: pending.people, caption: caption.trim() };
      const blob = await encodePolaroid((scale) => composePolaroid(pending.shot, info, scale));
      if (!blob) throw new Error("La foto pesa demasiado.");
      const form = new FormData();
      form.set("ticket", pending.ticket);
      form.set("caption", info.caption);
      form.set("image", blob, blob.type === "image/webp" ? "foto.webp" : "foto.png");
      const res = await fetch("/api/photos", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
      if (!res.ok) throw new Error(photoErrorText(body));
      useOfficeStore.getState().notify("Tu foto quedó pinchada en el tablón de la cafetería.", "success");
      void usePhotoStore.getState().refresh();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <PanelShell title="¡Foto!" icon="camera" onClose={close} wide>
      <div className="flex flex-col gap-4">
        <img src={url} alt="La foto que acabas de sacar" className="mx-auto w-full max-w-[672px] border-2 border-cozy-frame [image-rendering:pixelated]" />
        <label className="flex flex-col gap-1.5 text-[14px]">
          Pie de foto (opcional)
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, PHOTO.captionMax))}
            onKeyDown={(e) => e.key === "Enter" && !saving && void pin()}
            maxLength={PHOTO.captionMax}
            placeholder="¿Qué pasó acá?"
            className="cozy-input"
            autoFocus
          />
        </label>
        {error && <p className="text-[14px] text-cozy-red">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={close} disabled={saving} className="cozy-btn">
            Descartar
          </button>
          <button type="button" onClick={() => void pin()} disabled={saving} className="cozy-btn cozy-btn-primary">
            {saving ? "Pinchando…" : "Pinchar en el tablón"}
          </button>
        </div>
      </div>
    </PanelShell>
  );
}

// ---------- Galería (el tablón de la cafetería) ----------

async function send(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => null)) as { error?: string; code?: string; photo?: PhotoDTO } | null;
  if (!res.ok) throw new Error(photoErrorText(body));
  return body;
}

export function PhotoGallery({ onClose }: { onClose: () => void }) {
  const photos = usePhotoStore((s) => s.photos);
  const loaded = usePhotoStore((s) => s.loaded);
  const error = usePhotoStore((s) => s.error);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = photos.find((p) => p.id === openId) ?? null;

  // Al abrir la galería, la lista fresca (el aviso del servidor la mantiene al día mientras está abierta).
  useEffect(() => {
    void usePhotoStore.getState().refresh();
  }, []);

  return (
    <PanelShell title="Tablón de fotos" icon="camera" onClose={open ? () => setOpenId(null) : onClose} wide>
      {open ? (
        <PhotoDetail photo={open} onBack={() => setOpenId(null)} />
      ) : !loaded ? (
        <p className="text-[14px] text-cozy-ink-soft">Mirando el tablón…</p>
      ) : photos.length === 0 ? (
        <p className="text-[14px] text-cozy-ink-soft">
          {error ?? (
            <>
              Todavía no hay fotos. Saca una con <kbd className="cozy-kbd">P</kbd> (o el botón Foto) y pínchala acá.
            </>
          )}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpenId(p.id)}
                className="group flex w-full flex-col gap-1 text-left"
                title={p.caption || `Sacada por ${p.takenBy.name}`}
              >
                <img
                  src={photoImageUrl(p.id)}
                  alt={p.caption || `Foto de ${p.takenBy.name}`}
                  loading="lazy"
                  className={`w-full border-2 border-cozy-frame [image-rendering:pixelated] group-hover:outline-2 group-hover:outline-cozy-red ${p.pinned ? "" : "opacity-60"}`}
                />
                <span className="truncate text-[12px] text-cozy-ink-soft">
                  {p.takenBy.name} · {photoDateText(Date.parse(p.createdAt)).split(" · ")[0]}
                  {!p.pinned && " · guardada"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function PhotoDetail({ photo, onBack }: { photo: PhotoDTO; onBack: () => void }) {
  const me = useOfficeStore((s) => (s.sessionId ? s.players[s.sessionId]?.userId : undefined));
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appears = photo.people.some((p) => p.id === me);

  const remove = async () => {
    if (!confirm) return setConfirm(true);
    setBusy(true);
    try {
      await send(`/api/photos/${encodeURIComponent(photo.id)}`, { method: "DELETE" });
      usePhotoStore.getState().drop(photo.id);
      onBack();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const togglePin = async () => {
    setBusy(true);
    try {
      const body = await send(`/api/photos/${encodeURIComponent(photo.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !photo.pinned }),
      });
      if (body?.photo) usePhotoStore.getState().replace(body.photo);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <img src={photoImageUrl(photo.id)} alt={photo.caption || `Foto de ${photo.takenBy.name}`} className="w-full border-2 border-cozy-frame [image-rendering:pixelated]" />
      {photo.caption && <p className="text-[16px] font-semibold">{photo.caption}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
        <dt className="text-cozy-ink-soft">La sacó</dt>
        <dd>{photo.mine ? "Tú" : photo.takenBy.name}</dd>
        <dt className="text-cozy-ink-soft">Salen</dt>
        <dd>{photo.people.length ? peopleText(photo.people, 12) : "Nadie (solo el paisaje)"}</dd>
        <dt className="text-cozy-ink-soft">Cuándo</dt>
        <dd>
          {photoDateText(Date.parse(photo.createdAt))} · {areaName(photo.area)}
        </dd>
      </dl>
      {error && <p className="text-[14px] text-cozy-red">{error}</p>}
      <div className="flex flex-wrap items-center gap-2.5">
        <button type="button" onClick={onBack} className="cozy-btn">
          Volver
        </button>
        <span className="flex-1" />
        {(photo.mine || appears) && (
          <a href={photoImageUrl(photo.id)} download={`hyvento-foto-${photo.createdAt.slice(0, 10)}.${photo.mime === "image/webp" ? "webp" : "png"}`} className="cozy-btn">
            Descargar
          </a>
        )}
        {photo.canManage && (
          <button type="button" onClick={() => void togglePin()} disabled={busy} className="cozy-btn">
            {photo.pinned ? "Sacar del corcho" : "Pinchar en el corcho"}
          </button>
        )}
        {photo.canManage && (
          <button type="button" onClick={() => void remove()} disabled={busy} className="cozy-btn cozy-btn-danger">
            {confirm ? "¿Seguro? Borrar" : "Borrar"}
          </button>
        )}
      </div>
    </div>
  );
}
