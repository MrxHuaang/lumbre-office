"use client";

import { birthdayKey, MONTH_NAMES, parseBirthday } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { sendProfileChanged } from "@/game/network";
import type { Profile } from "@/game/store";
import { getArriveByBus, setArriveByBus } from "@/lib/arriveByBus";
import { loadBirthdays, saveBirthday } from "@/lib/birthdays";
import { saveProfile } from "@/lib/profile";
import { CharacterEditor, type Appearance } from "./CharacterEditor";
import { OfficeDialog } from "./OfficeDialog";

/**
 * Editar el perfil (nombre y personaje) o solo el personaje, sin salir de la cabaña: se guarda y
 * todos ven el cambio al instante. Es el mismo editor que el probador de la tienda (`FittingPanel`).
 */
export function ProfileDialog({
  profile,
  withName,
  onClose,
  onSaved,
}: {
  profile: Profile;
  /** true = "Editar perfil" (con el nombre); false = "Mi personaje". */
  withName: boolean;
  onClose: () => void;
  onSaved: (p: Profile) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [appearance, setAppearance] = useState<Appearance>({ avatar: profile.avatar, look: profile.look });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  // Cumpleaños (solo en "Editar perfil"): día y mes; "" = sin poner. `saved` es lo que había al abrir.
  const [birthday, setBirthday] = useState<{ month: string; day: string; saved: string | null } | null>(null);
  useEffect(() => {
    if (!withName) return;
    let alive = true;
    loadBirthdays().then(
      (b) => {
        const parsed = parseBirthday(b.me);
        if (alive) setBirthday({ month: parsed ? String(parsed.month) : "", day: parsed ? String(parsed.day) : "", saved: b.me });
      },
      () => alive && setBirthday({ month: "", day: "", saved: null }),
    );
    return () => {
      alive = false;
    };
  }, [withName]);
  const birthdayValue = birthday?.month && birthday.day ? birthdayKey(Number(birthday.month), Number(birthday.day)) : null;
  const birthdayInvalid = Boolean(birthday && (birthday.month || birthday.day) && !parseBirthday(birthdayValue));

  const save = async () => {
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const next = { name: trimmed, ...appearance };
      await saveProfile(next);
      if (birthday && !birthdayInvalid && birthdayValue !== birthday.saved) await saveBirthday(birthdayValue);
      sendProfileChanged();
      onSaved(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      setSaving(false);
    }
  };

  return (
    <OfficeDialog
      title={withName ? "Editar perfil" : "Tu personaje"}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !trimmed || birthdayInvalid}
            className="cozy-btn cozy-btn-primary px-5 py-2.5 text-[15px]"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={onClose} className="cozy-btn px-5 py-2.5 text-[15px]">
            Cancelar
          </button>
          {error && (
            <p role="alert" className="text-[14px] font-semibold text-cozy-red-deep">
              {error}
            </p>
          )}
        </>
      }
    >
      {/* El -1rem deja la vista previa pegada arriba del todo al desplazar (compensa el py-4). */}
      <div className="cozy-scroll min-h-0 overflow-y-auto px-4 py-4 [--editor-sticky-top:-1rem]">
        {withName && (
          <label className="mb-5 flex max-w-sm flex-col gap-2 text-[14px] font-semibold">
            Tu nombre
            <input
              autoFocus
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void save()}
              placeholder="¿Cómo te llaman?"
              className="cozy-input px-3.5 py-2.5 text-[16px] font-normal"
            />
          </label>
        )}
        {withName && birthday && (
          <fieldset className="mb-5 flex max-w-sm flex-col gap-2 text-[14px] font-semibold">
            <legend className="mb-2">Tu cumpleaños</legend>
            <div className="flex gap-2 font-normal">
              <select
                aria-label="Día"
                value={birthday.day}
                onChange={(e) => setBirthday({ ...birthday, day: e.target.value })}
                className="cozy-input px-2.5 py-2 text-[15px]"
              >
                <option value="">Día</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i} value={String(i + 1)}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <select
                aria-label="Mes"
                value={birthday.month}
                onChange={(e) => setBirthday({ ...birthday, month: e.target.value })}
                className="cozy-input flex-1 px-2.5 py-2 text-[15px]"
              >
                <option value="">Mes</option>
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </select>
              {(birthday.day || birthday.month) && (
                <button type="button" onClick={() => setBirthday({ ...birthday, day: "", month: "" })} className="cozy-btn px-3 text-[13px]">
                  Quitar
                </button>
              )}
            </div>
            <p className={`text-[12px] font-normal ${birthdayInvalid ? "text-cozy-red-deep" : "text-cozy-ink-soft"}`}>
              {birthdayInvalid ? (birthdayValue ? "Esa fecha no existe." : "Elige el día y el mes.") : "Sin año. Ese día llevas gorrito, hay pastel en la cafetería y te pueden felicitar."}
            </p>
          </fieldset>
        )}
        {!withName && <ArriveByBusToggle />}
        <CharacterEditor value={appearance} onChange={setAppearance} />
      </div>
    </OfficeDialog>
  );
}

/** "Llegar en bus": se guarda al tocarla (es de este navegador) y vale desde la próxima vez que entres. */
function ArriveByBusToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(getArriveByBus()), []);
  return (
    <label className="mb-5 flex max-w-md cursor-pointer items-start gap-3 text-[14px]">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setOn(e.target.checked);
          setArriveByBus(e.target.checked);
        }}
        className="mt-1 h-4 w-4 accent-[#62982a]"
      />
      <span>
        <span className="block font-semibold">Llegar en bus</span>
        <span className="block text-[12px] text-cozy-ink-soft">Al entrar a la cabaña, apareces en el Megabús y te bajas en la Estación Hyvento, afuera del portón.</span>
      </span>
    </label>
  );
}
