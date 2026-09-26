"use client";

// Fase 3b: el probador de la tienda (planta baja), un vestidor. Te cambias de pies a cabeza mirando la
// vista previa y guardas el look: todos lo ven al instante. La ropa es gratis (igual que en "Mi personaje").
import { useState } from "react";
import { sendProfileChanged } from "@/game/network";
import { useOfficeStore, type Profile } from "@/game/store";
import { presetLook } from "@/lib/look-palette";
import { saveProfile } from "@/lib/profile";
import { CharacterEditor, type Appearance } from "./CharacterEditor";
import { PanelShell } from "./PointsPanels";

export function FittingPanel({
  profile,
  atObject,
  onClose,
  onSaved,
}: {
  profile: Profile;
  atObject: boolean;
  onClose: () => void;
  onSaved: (p: Profile) => void;
}) {
  const notify = useOfficeStore((s) => s.notify);
  // La ropa se pone sobre un personaje propio: si usabas uno fijo, se parte de sus colores.
  const [appearance, setAppearance] = useState<Appearance>(() => ({
    avatar: profile.avatar,
    look: profile.look ?? presetLook(profile.avatar),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = { name: profile.name, ...appearance };
      await saveProfile(next);
      sendProfileChanged();
      onSaved(next);
      notify("¡Estrenas look!", "success");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      setSaving(false);
    }
  };

  if (!atObject)
    return (
      <PanelShell title="Probador" icon="star" onClose={onClose}>
        <p className="text-[14px] leading-snug text-cozy-ink-soft">
          Para cambiarte de ropa, ve al probador de la tienda (planta baja): acércate a la cabina o al perchero y toca E.
        </p>
      </PanelShell>
    );

  return (
    <PanelShell title="Probador" icon="star" onClose={onClose} wide>
      {/* El -1rem deja la vista previa pegada arriba del todo al desplazar (compensa el relleno del panel). */}
      <div className="flex flex-col gap-4 [--editor-sticky-top:-1rem]">
        <p className="text-[14px] leading-snug text-cozy-ink-soft">
          Pruébate peinados, ropa y accesorios: mira cómo te quedan en la vista previa (arrástrala para girarte) y guarda el look que más te guste.
        </p>
        <CharacterEditor value={appearance} onChange={setAppearance} />
      </div>

      {/* Acciones siempre a la vista, aunque el editor sea largo. */}
      <div className="sticky -bottom-4 -mx-4 mt-4 -mb-4 flex flex-wrap items-center gap-3 border-t-2 border-cozy-paper-dark bg-cozy-paper px-4 py-3">
        <button type="button" onClick={() => void save()} disabled={saving} className="cozy-btn cozy-btn-primary px-5 py-2.5 text-[15px]">
          {saving ? "Guardando…" : "Guardar look"}
        </button>
        <button type="button" onClick={onClose} className="cozy-btn px-5 py-2.5 text-[15px]">
          Salir
        </button>
        {error && (
          <p role="alert" className="min-w-40 flex-1 text-[14px] leading-snug font-semibold text-cozy-red-deep">
            {error}
          </p>
        )}
      </div>
    </PanelShell>
  );
}
