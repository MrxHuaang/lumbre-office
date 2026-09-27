"use client";

// Lo de la sala donde estoy (va en el panel lateral, SideDock): la pizarra y las paredes altas en
// cualquier oficina o en la sala de reuniones; y en tu oficina, además, decorar, el candado, la nota de
// la placa y la radio. La radio de una oficina ajena se ve (y se le baja el volumen) desde aquí también.
import { OFFICE_NOTE_MAX, parseYoutubeId, type OfficeRadioState } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { sendOfficeLock, sendOfficeNote, sendOfficeRadio } from "@/game/network";
import { useRadioStore } from "@/game/radio";
import { selectMyUserId, useOfficeStore, type OfficeView } from "@/game/store";
import { tapVideos } from "@/game/youtube";
import { PixelIcon } from "./Cozy";

/** ¿Hay sala (oficina o de reuniones) donde estoy? El panel lateral la muestra si sí. */
export const inRoom = (zoneType: string | undefined) => zoneType === "office" || zoneType === "meeting";

/** Título de la sección: tu oficina, la de otro o el nombre de la sala. */
export function useRoomTitle(): string {
  const zone = useOfficeStore((s) => s.zone);
  const office = useOfficeStore((s) => (s.zone?.type === "office" ? s.offices[s.zone.id] : undefined));
  const me = useOfficeStore(selectMyUserId);
  if (!zone) return "Esta sala";
  const mine = Boolean(office?.ownerId && office.ownerId === me);
  return zone.type === "meeting" ? zone.name : mine ? "Tu oficina" : office?.ownerName ? `Oficina de ${office.ownerName}` : zone.name;
}

export function RoomSection() {
  const zone = useOfficeStore((s) => s.zone);
  const office = useOfficeStore((s) => (s.zone?.type === "office" ? s.offices[s.zone.id] : undefined));
  const me = useOfficeStore(selectMyUserId);
  const indoors = useOfficeStore((s) => s.indoors);
  // Fuera de una oficina o la sala de reuniones (en cualquier sala de adentro) solo están las paredes.
  if (!zone || !inRoom(zone.type)) return indoors ? <WallsRow /> : null;
  const mine = Boolean(office?.ownerId && office.ownerId === me);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        {mine && office ? <p className="min-w-0 flex-1 truncate text-[16px] font-semibold">{office.name}</p> : <span className="flex-1" />}
        <RoomTools />
      </div>
      {mine && office && <OwnerRow office={office} />}
      {office && (mine || office.radio) && <RadioRow radio={office.radio} mine={mine} />}
    </div>
  );
}

/** "Activar sonido" de la radio: va en la pila de avisos (se ve aunque el panel lateral esté cerrado). */
export function RadioTapPrompt() {
  const needsTap = useRadioStore((s) => s.needsTap);
  const hasRadio = useOfficeStore((s) => Boolean(s.zone?.type === "office" && s.offices[s.zone.id]?.radio));
  if (!needsTap || !hasRadio) return null;
  return (
    <button type="button" onClick={() => tapVideos()} className="cozy-btn cozy-btn-primary pointer-events-auto px-3 py-1.5 text-[13px]">
      ▶ Activar el sonido de la radio
    </button>
  );
}

/** En una sala sin pizarra: solo el botón de las paredes altas. */
function WallsRow() {
  const walls = useOfficeStore((s) => s.privateWalls);
  return (
    <button
      type="button"
      onClick={() => useOfficeStore.getState().setPrivateWalls(!walls)}
      aria-pressed={walls}
      className="cozy-btn h-[32px] self-start px-2"
      title={walls ? "Bajar las paredes (ver toda la casa)" : "Subir las paredes: solo se ve la sala donde estás"}
    >
      <PixelIcon name="walls" size={14} />
      {walls ? "Paredes altas" : "Paredes bajas"}
    </button>
  );
}

/** Pizarra y paredes altas: para cualquiera en la sala. */
function RoomTools() {
  const walls = useOfficeStore((s) => s.privateWalls);
  const { openPanel, setPrivateWalls } = useOfficeStore.getState();
  return (
    <div className="flex shrink-0 gap-1.5">
      <button type="button" onClick={() => openPanel("whiteboard", true)} className="cozy-btn h-[32px] px-2" title="Pizarra de la sala: dibujar con los que están aquí">
        <PixelIcon name="board" size={14} />
        Pizarra
      </button>
      <button
        type="button"
        onClick={() => setPrivateWalls(!walls)}
        aria-pressed={walls}
        className="cozy-btn h-[32px] w-[32px] p-0"
        title={walls ? "Bajar las paredes (ver toda la casa)" : "Subir las paredes: más privacidad, solo se ve esta sala"}
        aria-label={walls ? "Bajar las paredes" : "Subir las paredes"}
      >
        <PixelIcon name="walls" size={14} />
      </button>
    </div>
  );
}

/** Tu oficina: decorar, el candado y la nota de la placa de la puerta. */
function OwnerRow({ office }: { office: OfficeView }) {
  const setDecorating = useOfficeStore((s) => s.setDecorating);
  return (
    <div className="flex items-end gap-1.5">
      <button onClick={() => setDecorating(true)} className="cozy-btn h-[32px] shrink-0 px-2" title="Poner, mover y quitar muebles; elegir piso y papel tapiz">
        <PixelIcon name="home" size={14} />
        Decorar
      </button>
      <button
        onClick={() => sendOfficeLock(!office.locked)}
        data-on={office.locked}
        className="cozy-btn h-[32px] w-[32px] shrink-0 p-0"
        title={office.locked ? "Cerrada: nadie entra sin tocar la puerta" : "Abierta: cualquiera puede entrar"}
        aria-label={office.locked ? "Abrir la oficina" : "Cerrar la oficina"}
      >
        <PixelIcon name={office.locked ? "lock" : "unlock"} size={14} />
      </button>
      <DoorNote note={office.note} />
    </div>
  );
}

/** La nota de la placa: se escribe y se guarda con Enter o al salir del campo. */
function DoorNote({ note }: { note: string }) {
  const [draft, setDraft] = useState(note);
  const setTyping = useOfficeStore((s) => s.setTyping);
  useEffect(() => setDraft(note), [note]);
  const save = () => draft.trim() !== note && sendOfficeNote(draft);
  return (
    <input
      value={draft}
      maxLength={OFFICE_NOTE_MAX}
      placeholder="Nota en la puerta…"
      aria-label="Nota en la placa de la puerta"
      title="Se ve en la placa de tu puerta (Enter para guardar)"
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setTyping(true)}
      onBlur={() => {
        setTyping(false);
        save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(note);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="cozy-input h-[32px] min-w-0 flex-1 px-2 text-[13px]"
    />
  );
}

/** La radio: qué suena y mi volumen; al dueño, además, ponerla, pausarla y apagarla. */
function RadioRow({ radio, mine }: { radio: OfficeRadioState | null; mine: boolean }) {
  const { volume, muted, setVolume, setMuted } = useRadioStore();
  const setTyping = useOfficeStore((s) => s.setTyping);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState("");
  const [bad, setBad] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parseYoutubeId(url)) {
      setBad(true);
      return;
    }
    sendOfficeRadio({ action: "set", url });
    setUrl("");
    setEditing(false);
    setTyping(false);
  };

  return (
    <div className="flex flex-col gap-1.5 border-t-2 border-dashed border-cozy-ink-soft/30 pt-2 text-[12px]">
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-cozy-ink-soft">Radio</span>
        <span className="min-w-0 flex-1 truncate" title={radio?.title}>
          {radio ? `${radio.paused ? "En pausa · " : ""}${radio.title}` : "Apagada"}
        </span>
        {mine && (
          <button type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing} className="cozy-btn shrink-0 px-2 py-0.5 text-[12px]">
            {radio ? "Cambiar" : "Poner música"}
          </button>
        )}
      </div>
      {editing && (
        <form onSubmit={submit} className="flex gap-1.5">
          <input
            autoFocus
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setBad(false);
            }}
            onFocus={() => setTyping(true)}
            onBlur={() => setTyping(false)}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            placeholder="Link de YouTube (música, un lofi en vivo…)"
            aria-label="Link de YouTube para la radio"
            aria-invalid={bad}
            className="cozy-input min-w-0 flex-1 px-2 py-1 text-[12px]"
          />
          <button type="submit" className="cozy-btn cozy-btn-primary px-2 py-0.5 text-[12px]" disabled={!url.trim()}>
            Poner
          </button>
        </form>
      )}
      {bad && <p className="text-cozy-red">Eso no parece un link de YouTube.</p>}
      {radio && (
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setMuted(!muted)} aria-pressed={muted} className="cozy-btn px-2 py-0.5 text-[12px]">
            {muted ? "Sin sonido" : "Sonido"}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            aria-label="Volumen de la radio"
            disabled={muted}
            className="min-w-0 flex-1 accent-[#b3571a]"
          />
          {mine && (
            <>
              <button type="button" onClick={() => sendOfficeRadio({ action: radio.paused ? "resume" : "pause" })} className="cozy-btn px-2 py-0.5 text-[12px]">
                {radio.paused ? "Seguir" : "Pausar"}
              </button>
              <button type="button" onClick={() => sendOfficeRadio({ action: "stop" })} className="cozy-btn px-2 py-0.5 text-[12px]" aria-label="Apagar la radio">
                Apagar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
