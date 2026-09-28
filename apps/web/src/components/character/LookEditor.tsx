"use client";

import { normalizeLook, type FullLook, type HumanAvatar, type Look } from "@hyvento/shared";
import { useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { lookFromFull } from "@/lib/look-palette";
import { MiniIcon, type MiniIconName } from "./icons";
import { LookPanel, type LookActions, type TabId } from "./LookPanel";
import { LookPreview } from "./LookPreview";
import { clearEditorSprites } from "./sprites";

const TABS: { id: TabId; label: string; icon: MiniIconName }[] = [
  { id: "body", label: "Cuerpo", icon: "face" },
  { id: "hair", label: "Pelo", icon: "comb" },
  { id: "costume", label: "Trajes", icon: "suit" },
  { id: "clothes", label: "Ropa", icon: "shirt" },
  { id: "gear", label: "Accesorios", icon: "hat" },
];

/** Lo de la pestaña Ropa: elegirlo quita el traje (si no, no se vería). */
const CLOTHES: ReadonlySet<keyof FullLook> = new Set(["top", "bottom", "outfit", "shoes", "pattern", "shirt", "top2", "pants", "shoeColor"]);
/** Lo de Accesorios: elegirlo con el traje puesto deja el traje pero con los accesorios propios. */
const GEAR: ReadonlySet<keyof FullLook> = new Set(["head", "face", "neck", "back"]);

/**
 * Editor de un look personalizado, estilo Terraria: vista previa que camina y gira, y cinco pestañas
 * (cuerpo, pelo, trajes completos, ropa, accesorios) con miniaturas de cada opción y color por parte. Lee cualquier look
 * (también los del formato viejo, vía `normalizeLook`) y escribe siempre el formato nuevo.
 */
export function LookEditor({
  look,
  onChange,
  onPreset,
}: {
  look: Look;
  /** `merge`: cambios seguidos del mismo color cuentan como uno para "Deshacer". */
  onChange: (look: Look, merge?: string) => void;
  /** "Partir de un personaje": empezar de nuevo desde uno fijo. */
  onPreset: (avatar: HumanAvatar) => void;
}) {
  const uid = useId();
  const [tab, setTab] = useState<TabId>("body");
  const full = useMemo(() => normalizeLook(look), [look]);
  // Las pestañas (decenas de miniaturas) se redibujan con prioridad baja: la vista previa responde primero.
  const base = useDeferredValue(full);
  // Los dibujos cacheados no hacen falta con el editor cerrado (y la cabaña sigue corriendo al lado).
  useEffect(() => clearEditorSprites, []);

  // Las acciones leen siempre lo último, así son estables y el panel no se redibuja de más.
  const latest = useRef({ full, onChange, onPreset });
  useLayoutEffect(() => {
    latest.current = { full, onChange, onPreset };
  });
  const act = useMemo<LookActions>(() => {
    const put = (patch: Partial<FullLook>, merge?: string) => {
      const cur = latest.current.full;
      const keys = Object.keys(patch) as (keyof FullLook)[];
      // Con un traje puesto, lo que se elige en Ropa lo quita y lo de Accesorios cambia a los propios.
      const off: Partial<FullLook> = !cur.costume
        ? {}
        : keys.some((k) => CLOTHES.has(k))
          ? { costume: null, costumeColor: null }
          : keys.some((k) => GEAR.has(k))
            ? { costumeGear: false }
            : {};
      latest.current.onChange(lookFromFull({ ...cur, ...patch, ...off }), merge);
    };
    return {
      set: (key, v) => put({ [key]: v }),
      toggle: (key) => put({ [key]: !latest.current.full[key] }),
      color: (key) => (hex) => put({ [key]: hex }, key),
      preset: (avatar) => latest.current.onPreset(avatar),
      wear: (costume) => latest.current.onChange(lookFromFull({ ...latest.current.full, costume, costumeColor: null })),
    };
  }, []);

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(i + step + TABS.length) % TABS.length]!;
    setTab(next.id);
    document.getElementById(`${uid}-tab-${next.id}`)?.focus();
  };

  return (
    <div className="grid gap-4 @xl:grid-cols-[auto_minmax(0,1fr)] @xl:gap-6">
      {/* Si la pantalla es alta, la vista previa queda a la vista mientras se recorren las opciones (en
          una baja no: taparía lo que se está eligiendo). Angosta va arriba de las opciones y tapa lo que
          pasa por debajo; `--editor-sticky-top` compensa el relleno de la ventana que la contiene. */}
      <div className="z-10 self-start bg-cozy-paper py-1 @xl:[@media(min-height:560px)]:sticky @xl:[@media(min-height:560px)]:top-0 @max-xl:[@media(min-height:760px)]:sticky @max-xl:[@media(min-height:760px)]:top-[var(--editor-sticky-top,0px)]">
        <LookPreview look={look} />
      </div>

      {/* Las pestañas se acomodan al ancho de su columna (no al del editor): muy angosta, 2 x 2 con el ícono
          al lado; mediana, 4 con el ícono arriba; ancha, 4 con el ícono al lado. Así ninguna se corta. */}
      <div className="@container/tabs flex min-w-0 flex-col gap-4">
        <div role="tablist" aria-label="Partes del personaje" className="grid grid-cols-3 gap-1.5 @[26rem]/tabs:grid-cols-5">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              id={`${uid}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={t.id === tab}
              aria-controls={`${uid}-panel`}
              tabIndex={t.id === tab ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
              className="cozy-btn min-w-0 gap-1 px-1 py-1.5 text-[12px] @[26rem]/tabs:flex-col @xl/tabs:flex-row @xl/tabs:text-[14px]"
            >
              <MiniIcon name={t.icon} size={14} className="shrink-0" />
              <span className="min-w-0 text-center leading-tight break-words">{t.label}</span>
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tab}`} className="flex flex-col gap-4">
          <LookPanel tab={tab} full={base} act={act} />
        </div>
      </div>
    </div>
  );
}
