"use client";

// El panel del editor de la casa (solo admins, a la derecha mientras se edita): todo el catálogo de
// muebles para agregar, el mueble elegido con sus botones y cómo se usa. Todo lo valida el servidor.
import { CATALOG, catalogItem, isWorldPlaceable } from "@hyvento/map";
import { useMemo, useState } from "react";
import { sendWorldEdit } from "@/game/network";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";
import { FurnitureArt } from "./DecorPanel";

/** Sin tildes y en minúscula, para buscar "lampara" y encontrar "Lámpara". */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const TYPES = Object.keys(CATALOG)
  .filter(isWorldPlaceable)
  .sort((a, b) => catalogItem(a).name.localeCompare(catalogItem(b).name, "es"));

export function WorldEditPanel() {
  const pick = useOfficeStore((s) => s.decorPick);
  const area = useOfficeStore((s) => s.area);
  const { setWorldEditing, pickDecor, rotateDecor } = useOfficeStore.getState();
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const q = fold(query.trim());
    return q ? TYPES.filter((t) => fold(catalogItem(t).name).includes(q) || t.includes(q)) : TYPES;
  }, [query]);

  const remove = () => {
    if (!pick?.itemId || !area) return;
    sendWorldEdit({ area, op: { action: "remove", key: pick.itemId } });
    pickDecor(null);
  };

  return (
    <section aria-label="Editar la casa" className="cozy-panel pointer-events-auto flex max-h-[calc(100dvh-9rem)] w-full flex-col p-1.5">
      <header className="flex items-center gap-2 bg-cozy-wood px-3 py-2 text-cozy-paper-light">
        <PixelIcon name="home" size={14} />
        <h2 className="flex-1 text-[16px] font-semibold">Editar la casa</h2>
        <button type="button" onClick={() => setWorldEditing(false)} className="cozy-btn cozy-btn-primary px-2.5 py-1 text-[13px]">
          Listo
        </button>
      </header>

      <div className="cozy-scroll flex min-h-0 flex-col gap-3 overflow-y-auto px-2.5 py-3">
        {pick ? (
          <div className="flex flex-col gap-2 border-2 border-cozy-wood bg-cozy-paper-light px-2.5 py-2">
            <p className="text-[14px] leading-tight">
              {pick.itemId ? "Moviendo" : "Poniendo"}: <span className="font-semibold">{catalogItem(pick.type).name}</span>
            </p>
            <p className="text-[12px] leading-snug text-cozy-ink-soft">Clic en el nivel para dejarlo. Verde: se puede; rojo: no.</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={rotateDecor} className="cozy-btn px-2 py-1 text-[13px]">
                Girar <kbd className="cozy-kbd">R</kbd>
              </button>
              {pick.itemId && (
                <button type="button" onClick={remove} className="cozy-btn cozy-btn-danger px-2 py-1 text-[13px]">
                  Quitar <kbd className="cozy-kbd">Supr</kbd>
                </button>
              )}
              <button type="button" onClick={() => pickDecor(null)} className="cozy-btn px-2 py-1 text-[13px]">
                Soltar <kbd className="cozy-kbd">Esc</kbd>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] leading-snug text-cozy-ink-soft">
            Haz clic en un mueble del nivel para moverlo, girarlo o quitarlo, o elige uno de la lista para agregarlo. Los cambios
            los ven todos al instante. Las oficinas las decoran sus dueños. Lo que el juego usa desde un lugar fijo (escaleras, mesas del casino, barras, mostradores, buzón…) no se mueve.
          </p>
        )}

        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold">Agregar un mueble</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => useOfficeStore.getState().setTyping(true)}
            onBlur={() => useOfficeStore.getState().setTyping(false)}
            placeholder="Buscar: lámpara, sofá, planta…"
            className="cozy-input px-2 py-1.5 text-[14px]"
          />
        </label>
        <ul className="grid grid-cols-3 gap-1.5">
          {list.map((t) => (
            <li key={t}>
              <button
                type="button"
                onClick={() => pickDecor(pick?.type === t && !pick.itemId ? null : { type: t })}
                aria-pressed={pick?.type === t && !pick.itemId}
                title={catalogItem(t).name}
                className="cozy-btn flex h-full w-full flex-col gap-1 px-1 py-1.5"
              >
                <FurnitureArt type={t} />
                <span className="w-full truncate text-center text-[11px] leading-tight">{catalogItem(t).name}</span>
              </button>
            </li>
          ))}
        </ul>
        {list.length === 0 && <p className="text-[13px] text-cozy-ink-soft">No hay muebles con ese nombre.</p>}
      </div>
    </section>
  );
}
