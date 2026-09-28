"use client";

// El panel del acuario del salón (E frente a él): los peces que nadan y quién los sacó, y el resto del
// álbum del equipo. Los datos salen de GET /api/aquarium (ver game/aquariumStore.ts).
import { drawFish } from "@hyvento/map/art";
import { aquariumEntries, FISH, fishById, RARITY, type TeamFishEntry } from "@hyvento/shared";
import { useEffect } from "react";
import { useAquariumStore } from "@/game/aquariumStore";
import { ArtImage } from "./casino/PixelArt";
import { RarityChip } from "./fishing/FishingHud";
import { PanelShell } from "./PointsPanels";

const catchersText = (e: TeamFishEntry) => {
  const shown = e.catchers.map((c) => (c.count > 1 ? `${c.name} ×${c.count}` : c.name)).join(", ");
  const more = e.people - e.catchers.length;
  return more > 0 ? `${shown} y ${more} más` : shown;
};

export function AquariumPanel({ onClose }: { onClose: () => void }) {
  const { entries, loaded, error, swimming, refresh } = useAquariumStore();
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const all = aquariumEntries(entries);
  const byId = new Map(all.map((e) => [e.species, e]));
  const inTank = swimming.map((id) => byId.get(id)).filter((e): e is TeamFishEntry => Boolean(e));
  const rest = all.filter((e) => !swimming.includes(e.species));
  const species = FISH.filter((f) => f.rarity !== "basura").length;

  return (
    <PanelShell title="El acuario" icon="fish" onClose={onClose} wide>
      {!loaded ? (
        <p className="text-[14px] text-cozy-ink-soft">{error ?? "Mirando el agua…"}</p>
      ) : all.length === 0 ? (
        <p className="text-[14px] leading-snug text-cozy-ink-soft">
          El acuario está esperando a sus primeros peces. Lo que saque el equipo del lago del jardín viene a nadar aquí.
        </p>
      ) : (
        <div className="cozy-scroll flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
            <p className="text-cozy-ink-soft">Nadan los más raros que ha sacado el equipo del lago (y, entre iguales, los más recientes).</p>
            <span className="cozy-chip shrink-0 px-2.5 py-1 tabular-nums">
              {all.length} de {species} especies
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {inTank.map((e) => (
              <FishCard key={e.species} entry={e} />
            ))}
          </ul>
          {rest.length > 0 && (
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-cozy-ink-soft">También en el álbum del equipo</p>
              <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {rest.map((e) => {
                  const f = fishById(e.species)!;
                  return (
                    <li key={e.species} className="flex items-center gap-2 border-2 border-cozy-paper-dark bg-cozy-paper-light px-2 py-1 text-[13px]" title={catchersText(e)}>
                      <ArtImage id={`pez-${f.id}`} make={() => drawFish(f.id, f.rarity)} scale={1} alt="" />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="text-cozy-ink-soft tabular-nums">×{e.count}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </PanelShell>
  );
}

function FishCard({ entry }: { entry: TeamFishEntry }) {
  const f = fishById(entry.species)!;
  return (
    <li className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-2.5 py-2">
      <span className="grid h-[44px] w-[60px] shrink-0 place-items-center" style={{ background: `${RARITY[f.rarity].color}22` }}>
        <ArtImage id={`pez-${f.id}`} make={() => drawFish(f.id, f.rarity)} scale={2} alt={f.name} />
      </span>
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold">
          {f.name}
          <RarityChip rarity={f.rarity} />
        </p>
        <p className="text-cozy-ink-soft">
          Lo sacó {catchersText(entry)}
        </p>
        <p className="text-cozy-ink-soft tabular-nums">
          {entry.count} {entry.count === 1 ? "vez" : "veces"} · el más grande, {entry.best} cm ({entry.bestBy})
        </p>
      </div>
    </li>
  );
}
