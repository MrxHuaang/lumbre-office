"use client";

// El menú del Man del Sombrero: un diálogo en susurros y su "tienda" de contrabando (todo ficticio, con
// efectos cómicos). Cozy pero turbio: luz tenue de bombillo, papel manchado y letra de susurro. Lo que se
// compra queda en la mano como lo de la cafetería y se usa con F; el servidor valida que esté, que uno esté
// junto a él y el saldo.
import { drawMenuItem } from "@hyvento/map/art";
import {
  consumeActionOf,
  SOMBRERO_FAREWELL,
  SOMBRERO_GREETING,
  SOMBRERO_LINES,
  SOMBRERO_LOOK,
  SOMBRERO_MENU,
  SOMBRERO_NAME,
  usesOf,
  type SombreroItem,
  type SombreroItemId,
} from "@hyvento/shared";
import { useEffect, useRef, useState } from "react";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { sendSombreroBuy } from "@/game/network";
import { useSombreroStore } from "@/game/npcs/store";
import { useOfficeStore } from "@/game/store";
import { CharacterSprite } from "./CharacterSprite";
import { PixelIcon } from "./Cozy";
import { useMyPoints } from "./PointsPanels";

/** Si no llega respuesta del servidor en este tiempo, el botón vuelve a estar disponible. */
const PENDING_MS = 3000;
/** Cada cuánto cambia lo que dice mientras uno mira la carta. */
const LINE_MS = 6000;

const USE_WORD = { smoke: "pitadas", sip: "tragos", bite: "mordiscos", spoon: "cucharadas", sniff: "esnifadas" } as const;

const usesText = (item: SombreroItem) => item.holds.map((art) => `${usesOf(art)} ${USE_WORD[consumeActionOf(art)]}`).join(" y ");

export function SombreroPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const points = useMyPoints();
  const present = useSombreroStore((s) => s.man.present);
  const lastResult = useSombreroStore((s) => s.lastResult);
  const [pending, setPending] = useState<string | null>(null);
  const [line, setLine] = useState(SOMBRERO_GREETING);
  const said = useRef(false);

  // Al abrir, el saludo también en su burbuja; al cerrar, la despedida.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const { setTyping } = useOfficeStore.getState();
    setTyping(true);
    if (!said.current) {
      said.current = true;
      useSombreroStore.getState().speak(SOMBRERO_GREETING);
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && leave();
    window.addEventListener("keydown", onKey);
    return () => {
      setTyping(false);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Las frases van rotando, en susurro.
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => setLine(SOMBRERO_LINES[i++ % SOMBRERO_LINES.length]!), LINE_MS);
    return () => clearInterval(id);
  }, []);

  // Si se va mientras uno mira (se acabó su hora, escampó), el menú se cierra solo.
  useEffect(() => {
    if (present) return;
    useOfficeStore.getState().notify("El Man del Sombrero se esfumó entre el humo…", "info");
    close.current();
  }, [present]);

  // La respuesta del servidor suelta el botón (si salió bien, cambia la frase).
  useEffect(() => {
    if (!lastResult) return;
    setPending(null);
    if (lastResult.ok) setLine("Eso es lo suyo. Pilas pues.");
  }, [lastResult]);
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(id);
  }, [pending]);

  function leave() {
    useSombreroStore.getState().speak(SOMBRERO_FAREWELL);
    useOfficeStore.getState().notify(`«${SOMBRERO_FAREWELL}»`, "info");
    close.current();
  }

  const buy = (id: SombreroItemId) => {
    setPending(id);
    sendSombreroBuy(id);
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgb(14_10_18/0.72)] p-3" onClick={(e) => e.target === e.currentTarget && leave()}>
      <section
        role="dialog"
        aria-modal
        aria-label={SOMBRERO_NAME}
        className="flex max-h-full w-full max-w-2xl flex-col border-4 border-[#1a1418] bg-[#2a2226] p-1.5 text-[#e8dcc4] shadow-[6px_6px_0_#0d0a0e]"
      >
        <header className="flex items-center gap-2 bg-[#3a3a40] px-4 py-2 text-[#d8d0c0]">
          <PixelIcon name="coin" size={14} color="var(--color-cozy-gold)" />
          <h2 className="flex-1 text-[17px] tracking-wide">{SOMBRERO_NAME}</h2>
          <span className="text-[13px] text-[#b8b0a0]">{points} pts</span>
          <button type="button" onClick={leave} className="p-1" aria-label="Irse disimulando">
            <PixelIcon name="close" size={12} />
          </button>
        </header>

        <div className="cozy-scroll min-h-0 overflow-y-auto">
          {/* El rincón: un bombillo que apenas alumbra, él en la sombra y lo que susurra. */}
          <div className="relative flex items-end gap-3 overflow-hidden bg-[radial-gradient(ellipse_at_22%_10%,rgba(255,196,110,0.28),transparent_60%)] px-4 pt-4 pb-3">
            <CharacterSprite avatar="ada" look={SOMBRERO_LOOK} className="h-24 w-24 shrink-0 [filter:brightness(0.8)_contrast(1.1)]" />
            <div className="relative mb-3 flex-1 border-2 border-[#5a4a3e] bg-[#1e181c] px-3 py-2">
              <p aria-live="polite" className="text-[15px] leading-snug text-[#f0e4c8] italic">
                {line}
              </p>
              <p className="mt-1 text-[12px] text-[#9a8e80]">
                Lo que compre lo lleva en la mano y se usa con <kbd className="cozy-kbd">F</kbd>. Todo es de mentiras: los efectos son de broma y se pasan solos.
                {!atObject && " Arrímese más para comprar."}
              </p>
            </div>
          </div>

          <ul className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
            {SOMBRERO_MENU.map((item) => {
              const short = points < item.price;
              return (
                <li key={item.id} className="flex items-center gap-3 border-2 border-[#4a3c34] bg-[#231c20] px-3 py-2.5 shadow-[inset_0_0_0_1px_#171216]">
                  <ItemArt id={item.id} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-tight font-semibold text-[#f4e6c8]">{item.name}</p>
                    <p className="text-[12px] leading-snug text-[#b8ab98]">{item.blurb}</p>
                    <p className="text-[11px] leading-snug text-[#9fcf7a]">
                      {item.effect} · {usesText(item)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => buy(item.id)}
                    disabled={!atObject || short || pending !== null}
                    title={short ? "No le alcanza" : !atObject ? "Arrímese más" : `Comprar ${item.name}`}
                    aria-label={`Comprar ${item.name} por ${item.price} puntos`}
                    className="cozy-btn cozy-btn-primary flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[14px]"
                  >
                    <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
                    {pending === item.id ? "…" : item.price}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-4 pb-3 text-center text-[12px] text-[#8a7e70] italic">«{SOMBRERO_FAREWELL}»</p>
        </div>
      </section>
    </div>
  );
}

const artCache = new Map<string, string>();

/** La mercancía en pixel-art, ampliada sin suavizar. */
function ItemArt({ id }: { id: string }) {
  const [src, setSrc] = useState(() => artCache.get(id) ?? null);
  useEffect(() => {
    if (artCache.has(id)) return setSrc(artCache.get(id)!);
    const url = toHtmlCanvas(drawMenuItem(id)).toDataURL();
    artCache.set(id, url);
    setSrc(url);
  }, [id]);
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center border-2 border-[#5a4a3e] bg-[#15101a]">
      {src && <img src={src} alt="" className="h-9 w-10 object-contain [image-rendering:pixelated]" />}
    </span>
  );
}
