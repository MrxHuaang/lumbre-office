"use client";

// Standup diario en el tablón del jardín: qué hará cada persona hoy. Se escribe (y edita) el propio y se
// leen los de todos; el primero del día da un bono chico. Las reglas están en standup.ts de @hyvento/shared.
import { STANDUP, type StandupBoard } from "@hyvento/shared";
import { useCallback, useEffect, useState } from "react";
import { useOfficeStore } from "@/game/store";
import { CharacterSprite } from "./CharacterSprite";
import { PixelIcon } from "./Cozy";

async function request<T>(init?: RequestInit): Promise<T> {
  const res = await fetch("/api/standup", { cache: "no-store", ...init, headers: { "Content-Type": "application/json" } });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? "Algo salió mal. Intenta de nuevo.");
  return body;
}

const hour = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

export function StandupPanel() {
  const [data, setData] = useState<StandupBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const notify = useOfficeStore((s) => s.notify);

  const load = useCallback(() => {
    request<StandupBoard>().then((b) => {
      setData(b);
      const mine = b.standups.find((s) => s.mine);
      setText(mine?.text ?? "");
      setEditing(!mine);
    }, (e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await request<{ created: boolean; awarded: number }>({ method: "PUT", body: JSON.stringify({ text }) });
      notify(r.awarded > 0 ? `Standup publicado · +${r.awarded} puntos` : r.created ? "Standup publicado" : "Standup actualizado", "success");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <p className="text-[14px] text-cozy-ink-soft">{error ?? "Leyendo los standups…"}</p>;
  const mine = data.standups.find((s) => s.mine);
  const others = data.standups.filter((s) => !s.mine);

  return (
    <div className="flex flex-col gap-5">
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-2 border-2 border-cozy-wood bg-cozy-paper-light p-3.5">
          <label className="flex flex-col gap-1 text-[14px] font-semibold">
            ¿Qué harás hoy?
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={STANDUP.maxLength}
              rows={3}
              placeholder="Terminar el login, revisar el PR de Ana y a las 3 la reunión de diseño."
              className="cozy-input resize-none px-3 py-2 text-[14px] font-normal"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={saving || !text.trim()} className="cozy-btn cozy-btn-primary">
              {!mine && <PixelIcon name="coin" size={13} />}
              {saving ? "Guardando…" : mine ? "Guardar cambios" : `Publicar +${data.bonus}`}
            </button>
            {mine && (
              <button type="button" onClick={() => {
                  setText(mine.text);
                  setEditing(false);
                }} className="cozy-btn">
                Cancelar
              </button>
            )}
            <span className="ml-auto text-[12px] text-cozy-ink-soft">
              {text.length}/{STANDUP.maxLength}
            </span>
          </div>
          {!mine && <p className="text-[12px] text-cozy-ink-soft">Uno por día; lo puedes editar hasta la medianoche (editarlo no da más puntos).</p>}
        </form>
      ) : (
        mine && <StandupCard s={mine} onEdit={() => setEditing(true)} />
      )}
      {error && <p className="text-[14px] font-semibold text-cozy-red-deep">{error}</p>}

      <section className="flex flex-col gap-2">
        <p className="text-[15px] font-semibold text-cozy-ink-soft">El equipo hoy</p>
        {others.length === 0 ? (
          <p className="text-[14px] text-cozy-ink-soft">Nadie más escribió todavía.</p>
        ) : (
          others.map((s) => <StandupCard key={s.userId} s={s} />)
        )}
      </section>
    </div>
  );
}

function StandupCard({ s, onEdit }: { s: StandupBoard["standups"][number]; onEdit?: () => void }) {
  return (
    <article className="flex items-start gap-3 border-2 border-cozy-wood bg-cozy-paper-light px-3.5 py-3 shadow-[inset_0_-2px_0_var(--color-cozy-paper-dark)]">
      <CharacterSprite avatar={s.avatar} look={s.look} dir="right" className="w-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-[15px] font-semibold">
          <span className="truncate">{s.mine ? "Tú" : s.name}</span>
          <span className="text-[12px] font-normal text-cozy-ink-soft">
            {hour(s.createdAt)}
            {s.edited && " · editado"}
          </span>
        </p>
        <p className="mt-1 text-[14px] leading-snug break-words whitespace-pre-line">{s.text}</p>
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} className="cozy-btn shrink-0 px-2.5 py-1 text-[13px]">
          Editar
        </button>
      )}
    </article>
  );
}
