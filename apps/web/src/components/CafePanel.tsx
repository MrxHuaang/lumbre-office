"use client";

// Fase 3a: la carta de la barra de la cafetería y, con el rediseño, la del bar del club (sótano). Se paga
// con puntos, lo pedido va a la mochila (y a la mano) y se usa con F (pitadas, sorbos, mordiscos, cucharadas).
// La cafetería tiene carta colombiana larga: va por pestañas (bebidas, panadería, fritos, postres…).
import { drawMenuItem } from "@hyvento/map/art";
import {
  BAR_MENU,
  CAFE,
  CINEMA_MENU,
  CAFE_CATEGORIES,
  cafeItemsIn,
  consumeActionOf,
  heldParts,
  usesOf,
  type BarItemId,
  type CinemaMenuItemId,
  type CafeCategory,
  type CafeItemId,
  type MenuItem,
} from "@hyvento/shared";
import { useEffect, useState } from "react";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { sendBarOrder, sendCafeOrder, sendCinemaOrder } from "@/game/network";
import { PixelIcon } from "./Cozy";
import { PanelShell, useMyPoints } from "./PointsPanels";

/** Si no llega respuesta del servidor en este tiempo, el botón vuelve a estar disponible. */
const PENDING_MS = 3000;

const USE_WORD = { smoke: "pitadas", sip: "sorbos", bite: "mordiscos", spoon: "cucharadas" } as const;

/** "4 sorbos", "5 pitadas y 3 sorbos": cuánto rinde lo que se pide. */
function usesText(item: MenuItem) {
  return heldParts(item.id)
    .map((art) => `${usesOf(art)} ${USE_WORD[consumeActionOf(art)]}`)
    .join(" y ");
}

/** Una pestaña de la carta: su nombre, el dibujo que la representa y lo que trae. */
interface MenuSection {
  id: string;
  label: string;
  icon: string;
  items: readonly MenuItem[];
}

/** El dibujo de cada pestaña de la cafetería (un producto típico de la sección). */
const CAFE_TAB_ICON: Record<CafeCategory, string> = {
  calientes: "tinto",
  frias: "jugo-mora",
  panaderia: "pandebono",
  fritos: "empanada",
  desayunos: "calentado",
  postres: "torta",
  combos: "onces",
  otros: "cigarro",
};

const CAFE_SECTIONS: MenuSection[] = CAFE_CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: CAFE_TAB_ICON[c.id], items: cafeItemsIn(c.id) })).filter(
  (s) => s.items.length > 0,
);

const BAR_SECTIONS: MenuSection[] = [{ id: "bar", label: "Carta", icon: "coctel", items: BAR_MENU }];
const CINEMA_SECTIONS: MenuSection[] = [{ id: "cine", label: "Confitería", icon: "crispetas", items: CINEMA_MENU }];

/** Última pestaña abierta en cada carta: al volver a la barra sigue donde la dejaste. */
const lastTab = new Map<string, string>();

export function CafePanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  return (
    <MenuPanel
      title="Cafetería"
      sections={CAFE_SECTIONS}
      atObject={atObject}
      onClose={onClose}
      order={(id) => sendCafeOrder(id as CafeItemId)}
      farHint="Para pedir, acércate a la barra de la cafetería (planta baja)."
    />
  );
}

/** La carta del bar del club: la misma mecánica, con la luz de neón del sótano. */
export function BarPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  return (
    <MenuPanel
      title="Bar del club"
      sections={BAR_SECTIONS}
      atObject={atObject}
      onClose={onClose}
      order={(id) => sendBarOrder(id as BarItemId)}
      farHint="Para pedir, acércate a la barra del club (sótano)."
      night
    />
  );
}

/** La confitería del cine: crispetas y gaseosa para la función, junto a la máquina de crispetas. */
export function SnacksPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  return (
    <MenuPanel
      title="Confitería del cine"
      sections={CINEMA_SECTIONS}
      atObject={atObject}
      onClose={onClose}
      order={(id) => sendCinemaOrder(id as CinemaMenuItemId)}
      farHint="Para pedir, acércate a la máquina de crispetas del cine (sótano)."
      night
    />
  );
}

function MenuPanel({
  title,
  sections,
  atObject,
  onClose,
  order,
  farHint,
  night = false,
}: {
  title: string;
  sections: readonly MenuSection[];
  atObject: boolean;
  onClose: () => void;
  order: (id: string) => void;
  farHint: string;
  night?: boolean;
}) {
  const points = useMyPoints();
  const [pending, setPending] = useState<string | null>(null);
  const [tab, setTab] = useState(() => {
    const saved = lastTab.get(title);
    return sections.some((s) => s.id === saved) ? saved! : sections[0]!.id;
  });
  const section = sections.find((s) => s.id === tab) ?? sections[0]!;

  // Si sale bien, el panel se cierra solo (ver network.ts); si no, se puede volver a intentar.
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(id);
  }, [pending]);

  const ask = (id: string) => {
    setPending(id);
    order(id);
  };

  const pick = (id: string, focus = false) => {
    setTab(id);
    lastTab.set(title, id);
    // En el celular las pestañas van en una fila que se desliza: la elegida queda a la vista.
    const el = document.getElementById(`carta-tab-${id}`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (focus) el?.focus();
  };

  // Flechas del teclado para pasar de pestaña (como en cualquier lista de pestañas).
  const onTabKey = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = sections.findIndex((s) => s.id === section.id);
    pick(sections[(i + step + sections.length) % sections.length]!.id, true);
  };

  const intro = (
    <p className={`text-[14px] ${night ? "text-[#e9d8ff]" : "text-cozy-ink-soft"}`}>
      Lo que pidas va a tu mochila (los combos, cada cosa por su lado); elígelo en la barra de abajo y todos te lo ven en la mano. Con{" "}
      <kbd className="cozy-kbd">F</kbd> lo usas.
      {!atObject && ` ${farHint}`}
    </p>
  );

  // Pestañas pegadas arriba mientras se baja por la lista. En pantallas anchas se envuelven; en el
  // celular van en una sola fila que se desliza de lado (si no, se comían media carta).
  const tabs = sections.length > 1 && (
    <div className="sticky -top-4 z-10 -mx-4 border-b-2 border-cozy-paper-dark bg-cozy-paper px-4 pt-1 pb-2">
      <div
        role="tablist"
        aria-label="Secciones de la carta"
        onKeyDown={onTabKey}
        className="cozy-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 sm:flex-wrap sm:overflow-visible"
      >
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            id={`carta-tab-${s.id}`}
            aria-selected={s.id === section.id}
            aria-controls="carta-lista"
            tabIndex={s.id === section.id ? 0 : -1}
            onClick={() => pick(s.id)}
            className="cozy-btn shrink-0 gap-1.5 px-2 py-1 text-[13px] whitespace-nowrap"
          >
            <ItemArt id={s.icon} night={false} small />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );

  const list = (
    <ul
      id="carta-lista"
      role={sections.length > 1 ? "tabpanel" : undefined}
      aria-labelledby={sections.length > 1 ? `carta-tab-${section.id}` : undefined}
      className="grid gap-2 sm:grid-cols-2"
    >
      {section.items.map((item) => {
        const short = points < item.price;
        return (
          <li
            key={item.id}
            className={
              night
                ? "flex items-center gap-3 border-2 border-[#6e3a96] bg-[#241238] px-3 py-2.5 shadow-[inset_0_0_0_1px_#34194f]"
                : "flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2.5"
            }
          >
            <ItemArt id={item.id} night={night} />
            <div className="min-w-0 flex-1">
              <p className={`text-[15px] leading-tight font-semibold ${night ? "text-[#ffe0f6]" : ""}`}>{item.name}</p>
              <p className={`text-[12px] leading-snug ${night ? "text-[#c9b2e6]" : "text-cozy-ink-soft"}`}>{item.blurb}</p>
              <p className={`text-[11px] leading-snug ${night ? "text-[#8ef0f0]" : "text-cozy-green"}`}>{usesText(item)}</p>
            </div>
            <button
              type="button"
              onClick={() => ask(item.id)}
              disabled={!atObject || short || pending !== null}
              title={short ? "No te alcanzan los puntos" : !atObject ? "Acércate a la barra" : `Pedir ${item.name}`}
              aria-label={`Pedir ${item.name} por ${item.price} puntos`}
              className="cozy-btn cozy-btn-primary flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[14px]"
            >
              <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
              {pending === item.id ? "…" : item.price}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <PanelShell title={title} icon="cup" onClose={onClose} wide>
      {night ? (
        // De noche en el club: pizarra violeta con un letrero de neón.
        <div className="-mx-4 -my-4 flex flex-col gap-3 bg-[#1e1030] px-4 py-4">
          <p
            aria-hidden
            className="self-center border-2 border-[#ff5fd2] px-3 py-0.5 text-[20px] tracking-[0.25em] text-[#ffe0f6] shadow-[0_0_0_2px_#5a0f4a,0_0_12px_#ff5fd2] [text-shadow:0_0_6px_#ff5fd2]"
          >
            BAR
          </p>
          {intro}
          {list}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {intro}
          {tabs}
          {list}
        </div>
      )}
    </PanelShell>
  );
}

const artCache = new Map<string, string>();

/**
 * El producto en pixel-art (en los combos, las dos cosas), ampliado sin suavizar. Se dibuja en el
 * navegador. `small`: el iconito de las pestañas.
 */
function ItemArt({ id, night, small = false }: { id: string; night: boolean; small?: boolean }) {
  const [src, setSrc] = useState(() => artCache.get(id) ?? null);
  useEffect(() => {
    if (artCache.has(id)) return setSrc(artCache.get(id)!);
    const url = toHtmlCanvas(drawMenuItem(id)).toDataURL();
    artCache.set(id, url);
    setSrc(url);
  }, [id]);
  if (small) return <span className="grid h-5 w-6 shrink-0 place-items-center">{src && <img src={src} alt="" className="h-4 w-5 object-contain [image-rendering:pixelated]" />}</span>;
  return (
    <span className={`grid h-12 w-12 shrink-0 place-items-center border-2 ${night ? "border-[#ff5fd2] bg-[#34194f]" : "border-cozy-wood bg-cozy-paper-dark"}`}>
      {src && <img src={src} alt="" className="h-9 w-10 object-contain [image-rendering:pixelated]" />}
    </span>
  );
}
