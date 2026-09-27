"use client";

import { HUMAN_AVATARS, randomLook, type HumanAvatar, type Look } from "@hyvento/shared";
import { useRef, useState } from "react";
import { presetLook } from "@/lib/look-palette";
import { MiniIcon } from "./character/icons";
import { LookEditor } from "./character/LookEditor";
import { CharacterSprite } from "./CharacterSprite";

/** Personaje de alguien: uno fijo (`avatar`) o uno personalizado (`look`). */
export interface Appearance {
  avatar: HumanAvatar;
  look: Look | null;
}

/** Cambios del mismo color más seguidos que esto (arrastrar el selector) se deshacen de una vez. */
const MERGE_MS = 900;
const HISTORY_MAX = 60;

interface Past {
  value: Appearance;
  merge?: string;
  at: number;
}

/**
 * Editor de personaje: uno de los seis fijos o uno propio, muy personalizable (todo gratis). Lo usan el
 * primer ingreso, "Mi personaje"/"Editar perfil" y el probador de la tienda. Trae "Al azar" y "Deshacer"
 * (también con Ctrl+Z).
 */
export function CharacterEditor({ value, onChange }: { value: Appearance; onChange: (v: Appearance) => void }) {
  const custom = value.look !== null;
  // Al volver a "Personajes" y regresar, se recupera lo que ya se había armado.
  const lastLook = useRef<Look | null>(value.look);
  const history = useRef<Past[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const change = (next: Appearance, merge?: string) => {
    const now = Date.now();
    const top = history.current.at(-1);
    if (merge && top?.merge === merge && now - top.at < MERGE_MS) top.at = now;
    else {
      history.current.push({ value, merge, at: now });
      if (history.current.length > HISTORY_MAX) history.current.shift();
    }
    setCanUndo(true);
    if (next.look) lastLook.current = next.look;
    onChange(next);
  };

  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    setCanUndo(history.current.length > 0);
    if (prev.value.look) lastLook.current = prev.value.look;
    onChange(prev.value);
  };

  const setLook = (look: Look, merge?: string) => change({ avatar: value.avatar, look }, merge);

  return (
    <div
      className="@container flex min-w-0 flex-col gap-4"
      onKeyDown={(e) => {
        // Ctrl+Z / Cmd+Z deshace, salvo mientras se escribe en un campo de texto.
        const typing = e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLInputElement && e.target.type !== "color");
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !typing) {
          e.preventDefault();
          undo();
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Tipo de personaje" className="flex flex-wrap gap-2">
          <Tab selected={!custom} onClick={() => custom && change({ avatar: value.avatar, look: null })}>
            Personajes
          </Tab>
          <Tab selected={custom} onClick={() => !custom && setLook(lastLook.current ?? presetLook(value.avatar))}>
            Crea el tuyo
          </Tab>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setLook(randomLook())} className="cozy-btn px-3 py-2" title="Un personaje al azar">
            <MiniIcon name="dice" />
            Al azar
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="cozy-btn px-3 py-2"
            title="Deshacer el último cambio (Ctrl+Z)"
          >
            <MiniIcon name="undo" />
            Deshacer
          </button>
        </div>
      </div>

      {custom ? (
        <LookEditor look={value.look!} onChange={setLook} onPreset={(avatar) => change({ avatar, look: presetLook(avatar) })} />
      ) : (
        <PresetGrid selected={value.avatar} onSelect={(avatar) => avatar !== value.avatar && change({ avatar, look: null })} />
      )}
    </div>
  );
}

function Tab({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={selected} onClick={onClick} className="cozy-btn px-4 py-2">
      {children}
    </button>
  );
}

/** Los seis personajes fijos, parados sobre un tile de pasto. */
function PresetGrid({ selected, onSelect }: { selected: HumanAvatar; onSelect: (a: HumanAvatar) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3 @lg:gap-[18px]">
      {HUMAN_AVATARS.map((a) => {
        const isSelected = a === selected;
        return (
          <button
            key={a}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(a)}
            className="cozy-btn flex aspect-[1/1.1] flex-col gap-0 overflow-hidden p-1"
          >
            <span className="relative grid w-full flex-1 place-items-center bg-[#5d9c46]">
              <span className="absolute bottom-[18%] h-[10%] w-[40%] rounded-[50%] bg-[#2f6036]" />
              <CharacterSprite avatar={a} dir="right" className="relative w-[62%]" />
            </span>
            <span className="w-full px-2 py-1.5 text-center text-[14px] capitalize">{a}</span>
          </button>
        );
      })}
    </div>
  );
}
