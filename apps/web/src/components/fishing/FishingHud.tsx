"use client";

// Lo de la pesca sobre la cabaña: la ayuda de las teclas mientras se pesca y la tarjeta del pez atrapado.
import { drawFish } from "@hyvento/map/art";
import { fishById, RARITY } from "@hyvento/shared";
import { useEffect } from "react";
import { cancelFishing, hookFish } from "@/game/fishing/net";
import { useFishingStore } from "@/game/fishing/store";
import { useOfficeStore } from "@/game/store";
import { ArtImage } from "../casino/PixelArt";
import { PixelIcon } from "../Cozy";

const CARD_MS = 6500;

export function FishingHud() {
  return (
    <>
      <FishingHint />
      <CatchCard />
    </>
  );
}

/** La ayuda de abajo según el momento: esperando, ¡pica! o el minijuego. */
function FishingHint() {
  const phase = useFishingStore((s) => s.phase);
  if (phase === "waiting")
    return (
      <Hint>
        <span className="text-cozy-ink-soft">Esperando que pique…</span>
        <button type="button" onClick={cancelFishing} className="flex items-center gap-1.5">
          <kbd className="cozy-kbd">E</kbd>
          Recoger
        </button>
      </Hint>
    );
  if (phase === "bite")
    return (
      <Hint strong>
        <button type="button" onClick={hookFish} className="flex items-center gap-2 font-semibold">
          ¡Pica!
          <kbd className="cozy-kbd">E</kbd>
          <kbd className="cozy-kbd">Espacio</kbd>
          <span className="text-cozy-ink-soft">o clic</span>
        </button>
      </Hint>
    );
  if (phase === "reeling")
    return (
      <Hint>
        Mantén <kbd className="cozy-kbd">Espacio</kbd> o el clic para subir la barra
        <span className="text-cozy-ink-soft">·</span>
        <kbd className="cozy-kbd">Esc</kbd> soltar
      </Hint>
    );
  return null;
}

function Hint({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <div
      className={`cozy-chip pointer-events-auto absolute bottom-28 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 px-3 py-1.5 text-[14px] ${strong ? "animate-[cozy-pop_0.4s_steps(3)_infinite] bg-cozy-paper-dark" : ""}`}
    >
      {children}
    </div>
  );
}

/** Tarjeta del pez atrapado: el dibujo, el tamaño, si es nuevo o récord y los puntos. */
function CatchCard() {
  const card = useFishingStore((s) => s.card);
  const dismiss = useFishingStore((s) => s.dismissCard);
  const openPanel = useOfficeStore((s) => s.openPanel);
  useEffect(() => {
    if (!card) return;
    const id = setTimeout(dismiss, CARD_MS);
    return () => clearTimeout(id);
  }, [card, dismiss]);
  if (!card) return null;
  const fish = fishById(card.species);
  if (!fish) return null;
  const rarity = RARITY[fish.rarity];
  const trash = fish.rarity === "basura";
  return (
    <section
      key={card.id}
      role="status"
      className="cozy-panel pointer-events-auto absolute top-20 left-1/2 z-20 w-[min(300px,calc(100%-1.5rem))] -translate-x-1/2 animate-[cozy-pop_0.35s_steps(3)] p-1.5"
    >
      <header className="flex items-center justify-between gap-2 bg-cozy-wood px-3 py-1.5 text-cozy-paper-light">
        <span className="text-[15px] font-semibold">{trash ? "Sacaste algo…" : card.first ? "¡Especie nueva!" : card.record ? "¡Nuevo récord!" : "¡Lo sacaste!"}</span>
        <button type="button" onClick={dismiss} aria-label="Cerrar" className="p-1">
          <PixelIcon name="close" size={12} />
        </button>
      </header>
      <div className="flex items-center gap-3 px-3 py-3">
        <span className="grid size-[92px] shrink-0 place-items-center border-2 border-cozy-wood bg-cozy-paper-dark">
          <ArtImage id={`pez-${fish.id}`} make={() => drawFish(fish.id, fish.rarity)} scale={3} alt={fish.name} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[18px] leading-tight font-semibold">{fish.name}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px]">
            <RarityChip rarity={fish.rarity} />
            <span className="tabular-nums">{card.size} cm</span>
          </p>
          <p className="mt-1.5 text-[13px] leading-snug text-cozy-ink-soft">{fish.description}</p>
        </div>
      </div>
      <footer className="flex items-center justify-between gap-2 border-t-2 border-cozy-paper-dark px-3 py-2 text-[13px]">
        <span className="font-semibold" style={{ color: card.points > 0 ? "var(--color-cozy-green)" : undefined }}>
          {card.points > 0 ? `+${card.points} puntos` : trash ? "Sin puntos, pero el lago quedó más limpio." : "Hoy ya llegaste al tope de puntos de ocio."}
          {card.treasure && " · ¡con cofre!"}
        </span>
        <button
          type="button"
          onClick={() => {
            dismiss();
            openPanel("fishAlbum", false);
          }}
          className="cozy-btn px-2.5 py-1 text-[13px]"
        >
          Álbum
        </button>
      </footer>
      <span className="sr-only">{rarity.label}</span>
    </section>
  );
}

export function RarityChip({ rarity }: { rarity: keyof typeof RARITY }) {
  const r = RARITY[rarity];
  return (
    <span className="inline-flex items-center gap-1 border-2 border-cozy-frame bg-cozy-paper-light px-1.5 py-px text-[12px] leading-none">
      <span className="size-2 shrink-0" style={{ background: r.color }} />
      {r.label}
    </span>
  );
}
