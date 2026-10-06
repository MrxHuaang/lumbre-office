"use client";

// Álbum de pesca: todas las especies del lago agrupadas por rareza, con silueta las que todavía no
// sacaste, cuántas veces, el más grande y cuándo pican. Los datos salen de GET /api/fishing (solo tus capturas).
import { drawFish } from "@hyvento/map/art";
import { FISH, FISH_RARITIES, RARITY, type FishAlbumEntry, type FishSpecies, type FishTime, type FishWeather } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { useFishingStore } from "@/game/fishing/store";
import { ArtImage } from "../casino/PixelArt";
import { api, PanelShell } from "../PointsPanels";
import { RarityChip } from "./FishingHud";

const TIME_LABEL: Record<FishTime, string> = {
  dia: "De día",
  noche: "De noche",
  siempre: "Día y noche",
  atardecer: "Al atardecer",
  madrugada: "De madrugada",
};
const WEATHER_LABEL: Record<FishWeather, string> = { lluvia: "con lluvia", tormenta: "con tormenta", niebla: "con niebla" };

/** Cuándo pica, corto: "De noche con lluvia". */
const whenLabel = (f: FishSpecies) => (f.weather ? `${TIME_LABEL[f.time]} ${WEATHER_LABEL[f.weather]}` : TIME_LABEL[f.time]);

export function FishAlbum({ onClose }: { onClose: () => void }) {
  const version = useFishingStore((s) => s.albumVersion);
  const [entries, setEntries] = useState<Map<string, FishAlbumEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api<{ entries: FishAlbumEntry[] }>("/api/fishing").then(
      (r) => setEntries(new Map(r.entries.map((e) => [e.species, e]))),
      (e: Error) => setError(e.message),
    );
  }, [version]);

  const fish = FISH.filter((f) => f.rarity !== "basura");
  const trash = FISH.filter((f) => f.rarity === "basura");
  const caught = entries ? fish.filter((f) => entries.has(f.id)).length : 0;
  const pick = selected ? FISH.find((f) => f.id === selected) : undefined;

  return (
    <PanelShell title="Álbum de pesca" icon="fish" onClose={onClose} wide>
      {!entries ? (
        <p className="text-[14px] text-cozy-ink-soft">{error ?? "Abriendo el álbum…"}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
            <p className="text-cozy-ink-soft">
              Se pesca en la punta del muelle y en la piedra plana del lago. Cada pez tiene su hora (de Bogotá) y algunos solo pican
              con lluvia, tormenta o niebla.
            </p>
            <span className="cozy-chip shrink-0 px-2.5 py-1 tabular-nums">
              {caught} de {fish.length} especies
            </span>
          </div>
          {pick && <Detail fish={pick} entry={entries.get(pick.id)} />}
          {FISH_RARITIES.filter((r) => r !== "basura").map((r) => {
            const group = fish.filter((f) => f.rarity === r);
            const have = group.filter((f) => entries.has(f.id)).length;
            return (
              <div key={r}>
                <p className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-cozy-ink-soft">
                  <RarityChip rarity={r} />
                  <span className="tabular-nums">
                    {have} de {group.length}
                  </span>
                </p>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {group.map((f) => (
                    <AlbumCell key={f.id} fish={f} entry={entries.get(f.id)} selected={selected === f.id} onSelect={() => setSelected(selected === f.id ? null : f.id)} />
                  ))}
                </ul>
              </div>
            );
          })}
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-cozy-ink-soft">Basura sacada del lago</p>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {trash.map((f) => (
                <AlbumCell key={f.id} fish={f} entry={entries.get(f.id)} selected={selected === f.id} onSelect={() => setSelected(selected === f.id ? null : f.id)} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </PanelShell>
  );
}

function AlbumCell({ fish, entry, selected, onSelect }: { fish: FishSpecies; entry?: FishAlbumEntry; selected: boolean; onSelect: () => void }) {
  const known = Boolean(entry);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex w-full flex-col items-center gap-1 border-2 border-cozy-paper-dark bg-cozy-paper-light px-1.5 py-2 text-center hover:border-cozy-wood aria-pressed:border-cozy-red"
        title={known ? fish.name : "Todavía no lo has sacado"}
      >
        <span className="grid h-[54px] w-full place-items-center" style={{ background: known ? `${RARITY[fish.rarity].color}22` : undefined }}>
          <ArtImage
            id={`${known ? "pez" : "silueta"}-${fish.id}`}
            make={() => drawFish(fish.id, fish.rarity, { silhouette: !known })}
            scale={2}
            alt={known ? fish.name : "Especie desconocida"}
          />
        </span>
        <span className="w-full truncate text-[13px] leading-tight font-semibold">{known ? fish.name : "???"}</span>
        <span className="text-[12px] leading-none text-cozy-ink-soft tabular-nums">{entry ? `× ${entry.count} · ${entry.best} cm` : whenLabel(fish)}</span>
      </button>
    </li>
  );
}

function Detail({ fish, entry }: { fish: FishSpecies; entry?: FishAlbumEntry }) {
  return (
    <div className="flex items-center gap-3 border-2 border-cozy-wood bg-cozy-paper-light px-3 py-2.5">
      <ArtImage
        id={`${entry ? "pez" : "silueta"}-${fish.id}`}
        make={() => drawFish(fish.id, fish.rarity, { silhouette: !entry })}
        scale={3}
        alt=""
      />
      <div className="min-w-0 flex-1 text-[13px]">
        <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold">
          {entry ? fish.name : "???"}
          <RarityChip rarity={fish.rarity} />
        </p>
        <p className="mt-1 leading-snug text-cozy-ink-soft">{entry ? fish.description : "Todavía no lo has sacado. Sigue intentando."}</p>
        <p className="mt-1 text-cozy-ink-soft">
          {whenLabel(fish)} · de {fish.size[0]} a {fish.size[1]} cm
          {entry && ` · sacado ${entry.count} ${entry.count === 1 ? "vez" : "veces"}, el más grande de ${entry.best} cm`}
        </p>
      </div>
    </div>
  );
}
