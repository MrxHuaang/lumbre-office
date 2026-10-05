"use client";

// El menú del jugador (tecla I o la mochila del HUD), como el inventario de Stardew: la mochila entera (3
// filas de 12; se arrastra para reordenar e intercambiar con la barra), los encargos, los oficios, el diario
// de la historia, tus estadísticas y logros, y tu personaje en grande con lo que llevas en la mano. Todo lo
// que cambia la mochila lo valida el servidor.
import { isPlaceable } from "@hyvento/map";
import { BAG, BAG_KEYS, BAG_KIND_LABEL, bagItemInfo, bagItemName, bagRow, type ItemStack, type ProfileDTO } from "@hyvento/shared";
import { useEffect, useId, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAchievementStore } from "@/game/achievements";
import { dropItem, moveItem, selectSlot, useBagStore } from "@/game/bag";
import { clearQuestLogRequest, questLogRequested } from "@/game/encargos";
import { sendProfileChanged } from "@/game/network";
import { selectMyOffice, useOfficeStore, type Profile } from "@/game/store";
import { focusOwnsKey } from "@/lib/keyboardFocus";
import { presetLook } from "@/lib/look-palette";
import { LookPreview } from "../character/LookPreview";
import { PixelIcon } from "../Cozy";
import { OfficeDialog } from "../OfficeDialog";
import { api } from "../PointsPanels";
import { BadgeGlyph } from "../profile/Badge";
import { QuestLog } from "../encargos/QuestLog";
import { HistoriaDiario } from "../historia/HistoriaDiario";
import { OficiosTab } from "../oficios/OficiosTab";
import { ProfileAchievements, ProfileFacts } from "../profile/ProfileView";
import { useMyHand } from "./Hotbar";
import { ItemIcon } from "./ItemIcon";

type Tab = "mochila" | "encargos" | "oficios" | "historia" | "stats" | "personaje";
const TABS: { id: Tab; label: string; wideHidden?: true }[] = [
  { id: "mochila", label: "Mochila" },
  { id: "encargos", label: "Encargos" },
  { id: "oficios", label: "Oficios" },
  { id: "historia", label: "Historia" },
  { id: "stats", label: "Estadísticas" },
  // En pantallas anchas el personaje va siempre a la derecha: la pestaña sobra.
  { id: "personaje", label: "Personaje", wideHidden: true },
];


/** Mi perfil (puntos, racha, título, logros): se pide al abrir y cuando desbloqueo algo. */
function useMyProfile() {
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const version = useAchievementStore((s) => s.version);
  useEffect(() => {
    let alive = true;
    api<ProfileDTO>("/api/profile/me").then(
      (p) => alive && setProfile(p),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [version]);
  return { profile, error };
}

export function PlayerMenu({ profile, onClose, onEditCharacter }: { profile: Profile; onClose: () => void; onEditCharacter: () => void }) {
  const uid = useId();
  // El rastreador de encargos abre la mochila directo en la libreta.
  const [tab, setTab] = useState<Tab>(() => (questLogRequested() ? "encargos" : "mochila"));
  useEffect(clearQuestLogRequest, []);
  const me = useMyProfile();

  // La I también lo cierra (como la abre), salvo escribiendo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "i" || e.ctrlKey || e.metaKey || e.altKey || focusOwnsKey(e.key)) return;
      e.preventDefault();
      if (!e.repeat) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(i + step + TABS.length) % TABS.length]!;
    setTab(next.id);
    document.getElementById(`${uid}-${next.id}`)?.focus();
  };

  return (
    <OfficeDialog title="Tu mochila" onClose={onClose} className="max-w-5xl">
      <div role="tablist" aria-label="Menú del jugador" className="flex shrink-0 gap-1.5 border-b-2 border-cozy-paper-dark px-3 pt-3 pb-2">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            id={`${uid}-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            tabIndex={tab === t.id ? 0 : -1}
            onKeyDown={(e) => onTabKey(e, i)}
            onClick={() => setTab(t.id)}
            className={`cozy-btn px-3 py-1.5 text-[14px] ${t.wideHidden ? "lg:hidden" : ""}`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto hidden items-center gap-1.5 text-[12px] text-cozy-ink-soft sm:flex">
          <kbd className="cozy-kbd">I</kbd> o <kbd className="cozy-kbd">Esc</kbd> para cerrar
        </span>
      </div>
      <div className="cozy-scroll grid min-h-0 gap-4 overflow-y-auto p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div role="tabpanel" className="min-w-0">
          {tab === "stats" ? (
            <StatsTab data={me.profile} error={me.error} />
          ) : tab === "encargos" ? (
            <QuestLog />
          ) : tab === "oficios" ? (
            <OficiosTab />
          ) : tab === "historia" ? (
            <HistoriaDiario />
          ) : tab === "personaje" ? (
            <>
              <div className="lg:hidden">
                <CharacterCard profile={profile} me={me.profile} onEditCharacter={onEditCharacter} />
              </div>
              <div className="max-lg:hidden">
                <BagTab onClose={onClose} />
              </div>
            </>
          ) : (
            <BagTab onClose={onClose} />
          )}
        </div>
        <aside aria-label="Tu personaje" className="sticky top-0 self-start max-lg:hidden">
          <CharacterCard profile={profile} me={me.profile} onEditCharacter={onEditCharacter} />
        </aside>
      </div>
    </OfficeDialog>
  );
}

// ---------- Mochila ----------

function BagTab({ onClose }: { onClose: () => void }) {
  const { slots, overflow, selected, loaded, titles } = useBagStore(
    useShallow((s) => ({ slots: s.slots, overflow: s.overflow, selected: s.selected, loaded: s.loaded, titles: s.titles })),
  );
  /** Casilla elegida para ver o mover (-1 = ninguna) y la que está bajo el mouse (manda en el detalle). */
  const [picked, setPicked] = useState(-1);
  const [hover, setHover] = useState<ItemStack | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [dropOver, setDropOver] = useState(-1);
  const barRow = bagRow(selected);

  const place = (to: number) => {
    if (!moving) return false;
    moveItem(moving, to);
    setMoving(null);
    setPicked(to);
    return true;
  };
  const shown = hover ?? (picked >= 0 ? slots[picked] : null) ?? (moving ? (overflow.find((s) => s.itemId === moving) ?? null) : null);

  if (!loaded) return <p className="cozy-dots py-8 text-center text-[14px] text-cozy-ink-soft">Abriendo la mochila</p>;
  const used = slots.filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px] text-cozy-ink-soft">
        <span>
          Arrastra para ordenar. La fila marcada es la de la barra de abajo: <kbd className="cozy-kbd">Tab</kbd> cambia de fila y los números eligen la casilla.
        </span>
        <span className="tabular-nums">
          {used}/{BAG.slots} casillas
        </span>
      </p>

      <div className="flex flex-col gap-2" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: BAG.rows }, (_, row) => (
          <div key={row} className={`flex flex-col gap-1 border-2 p-1.5 ${row === barRow ? "border-cozy-red/70 bg-cozy-paper-light" : "border-transparent"}`}>
            <span className="flex items-center gap-1.5 text-[11px] text-cozy-ink-soft">
              Fila {row + 1}
              {row === barRow && <span className="font-semibold text-cozy-red-deep">· en la barra</span>}
            </span>
            <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
              {Array.from({ length: BAG.cols }, (_, col) => {
                const slot = row * BAG.cols + col;
                const stack = slots[slot] ?? null;
                const story = stack ? bagItemInfo(stack.itemId).story : false;
                return (
                  <button
                    key={slot}
                    type="button"
                    draggable={Boolean(stack)}
                    data-selected={slot === picked || (picked < 0 && slot === selected)}
                    data-drop={dropOver === slot}
                    aria-label={stack ? `${bagItemName(stack.itemId, titles)}${stack.quantity > 1 ? `, ${stack.quantity}` : ""}${story ? ", de la historia" : ""}` : `Casilla ${slot + 1}, vacía`}
                    onMouseEnter={() => setHover(stack)}
                    onFocus={() => setHover(stack)}
                    onClick={() => {
                      if (place(slot)) return;
                      setPicked(stack ? slot : -1);
                    }}
                    onDragStart={(e) => {
                      if (!stack) return;
                      e.dataTransfer.setData("text/plain", stack.itemId);
                      e.dataTransfer.effectAllowed = "move";
                      setPicked(slot);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dropOver !== slot) setDropOver(slot);
                    }}
                    onDragLeave={() => setDropOver((d) => (d === slot ? -1 : d))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDropOver(-1);
                      const itemId = e.dataTransfer.getData("text/plain");
                      if (itemId) {
                        moveItem(itemId, slot);
                        setPicked(slot);
                      }
                    }}
                    onDragEnd={() => setDropOver(-1)}
                    className={`bag-slot aspect-square w-full ${moving ? "cursor-copy" : stack ? "cursor-grab" : ""}`}
                  >
                    {row === barRow && <span className="bag-slot-n">{BAG_KEYS[col]}</span>}
                    {story && <StoryMark />}
                    {stack && <ItemIcon itemId={stack.itemId} />}
                    {stack && stack.quantity > 1 && <span className="bag-slot-q">{stack.quantity}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {overflow.length > 0 && (
        <section aria-label="No caben" className="flex flex-col gap-1.5 border-2 border-dashed border-cozy-wood px-2.5 py-2">
          <p className="text-[12px] text-cozy-ink-soft">No caben en la mochila (no se pierden): muévelos a una casilla que se libere.</p>
          <div className="flex flex-wrap gap-1">
            {overflow.map((s) => (
              <button
                key={s.itemId}
                type="button"
                draggable
                aria-label={`${bagItemName(s.itemId, titles)}: mover`}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", s.itemId)}
                onMouseEnter={() => setHover(s)}
                onClick={() => setMoving(s.itemId)}
                className="bag-slot size-11"
              >
                {bagItemInfo(s.itemId).story && <StoryMark />}
                <ItemIcon itemId={s.itemId} />
                {s.quantity > 1 && <span className="bag-slot-q">{s.quantity}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      <ItemDetail
        stack={shown}
        slot={shown ? slots.findIndex((s) => s?.itemId === shown.itemId) : -1}
        inHand={shown ? slots[selected]?.itemId === shown.itemId : false}
        moving={moving !== null && moving === shown?.itemId}
        onMove={(itemId) => setMoving((m) => (m === itemId ? null : itemId))}
        onClose={onClose}
      />
    </div>
  );
}

/** La marquita de un objeto de historia (arriba a la derecha de su casilla). */
function StoryMark() {
  return (
    <span aria-hidden className="pointer-events-none absolute top-0.5 right-0.5 z-[1] leading-none">
      <PixelIcon name="star" size={9} color="var(--color-cozy-gold)" />
    </span>
  );
}

/** El detalle de una cosa de la mochila (la que está bajo el mouse o la elegida) y lo que se puede hacer. */
function ItemDetail({
  stack,
  slot,
  inHand,
  moving,
  onMove,
  onClose,
}: {
  stack: ItemStack | null;
  slot: number;
  inHand: boolean;
  moving: boolean;
  onMove: (itemId: string) => void;
  onClose: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setConfirm(false), [stack?.itemId]);
  const name = useBagStore((s) => (stack ? bagItemName(stack.itemId, s.titles) : ""));
  const inMyOffice = useOfficeStore((s) => {
    const mine = selectMyOffice(s);
    return Boolean(mine && s.zone?.id === mine.zoneId);
  });
  if (!stack) {
    return (
      <div className="flex min-h-[5.5rem] items-center justify-center border-2 border-cozy-paper-dark px-3 py-2 text-center text-[13px] text-cozy-ink-soft">
        Pasa el mouse por una casilla (o tócala) para ver qué es.
      </div>
    );
  }
  const info = bagItemInfo(stack.itemId);
  const use = info.use === "consume" ? "Se usa con F (o con un clic en su casilla de la barra)." : info.use === "tool" ? "Se usa con E en el huerto." : null;
  return (
    <div className="flex min-h-[5.5rem] flex-wrap items-start gap-3 border-2 border-cozy-wood bg-cozy-paper-light px-3 py-2.5">
      <span className="bag-slot size-14 shrink-0">
        <ItemIcon itemId={stack.itemId} />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[16px] leading-tight font-semibold">
          {name}
          <span className="text-[12px] font-normal text-cozy-ink-soft">
            {info.story ? "De la historia" : BAG_KIND_LABEL[info.kind]} · {stack.quantity > 1 ? `${stack.quantity} unidades` : "1 unidad"}
            {inHand && " · en la mano"}
          </span>
        </p>
        {info.blurb && <p className="mt-0.5 text-[13px] leading-snug">{info.blurb}</p>}
        <p className="mt-0.5 text-[12px] leading-snug text-cozy-ink-soft">
          {info.story
            ? "Objeto de la historia: no se tira, no se regala ni se intercambia. Alguien lo va a pedir."
            : info.furniture
              ? "Mueble: se pone en tu oficina con Decorar (y al quitarlo vuelve aquí)."
              : (use ?? "Se lleva en la mano; todos lo ven.")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {slot >= 0 && !inHand && !info.furniture && (
          <button type="button" onClick={() => selectSlot(slot)} className="cozy-btn cozy-btn-primary px-2.5 py-1 text-[13px]">
            Llevar en la mano
          </button>
        )}
        {info.furniture && (
          <button
            type="button"
            disabled={!inMyOffice || !isPlaceable(info.art)}
            title={inMyOffice ? undefined : "Entra a tu oficina para poner muebles"}
            onClick={() => {
              onClose();
              const s = useOfficeStore.getState();
              s.setDecorating(true);
              s.pickDecor({ type: info.art });
            }}
            className="cozy-btn cozy-btn-primary px-2.5 py-1 text-[13px]"
          >
            Poner en mi oficina
          </button>
        )}
        <button type="button" aria-pressed={moving} onClick={() => onMove(stack.itemId)} className="cozy-btn px-2.5 py-1 text-[13px]">
          {moving ? "Elige la casilla…" : "Mover"}
        </button>
        {!info.furniture &&
          !info.story &&
          (confirm ? (
            <>
              <button
                type="button"
                onClick={() => {
                  dropItem(stack.itemId, stack.quantity);
                  setConfirm(false);
                }}
                className="cozy-btn cozy-btn-danger px-2.5 py-1 text-[13px]"
              >
                {stack.quantity > 1 ? `Tirar las ${stack.quantity}` : "Sí, tirarlo"}
              </button>
              {stack.quantity > 1 && (
                <button type="button" onClick={() => dropItem(stack.itemId, 1)} className="cozy-btn px-2.5 py-1 text-[13px]">
                  Tirar una
                </button>
              )}
              <button type="button" onClick={() => setConfirm(false)} className="cozy-btn px-2.5 py-1 text-[13px]">
                No
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="cozy-btn px-2.5 py-1 text-[13px]">
              Tirar
            </button>
          ))}
      </div>
    </div>
  );
}

// ---------- Estadísticas ----------

function StatsTab({ data, error }: { data: ProfileDTO | null; error: string | null }) {
  if (!data) return <p className={`py-8 text-center text-[14px] ${error ? "text-cozy-red-deep" : "cozy-dots text-cozy-ink-soft"}`}>{error ?? "Contando"}</p>;
  return (
    <div className="flex flex-col gap-4">
      <ProfileFacts profile={data} />
      <ProfileAchievements profile={data} onBadgeChanged={sendProfileChanged} />
    </div>
  );
}

// ---------- Personaje ----------

function CharacterCard({ profile, me, onEditCharacter }: { profile: Profile; me: ProfileDTO | null; onEditCharacter: () => void }) {
  const hand = useMyHand();
  const handName = useBagStore((s) => {
    const stack = s.slots[s.selected];
    return stack && hand.held ? bagItemName(stack.itemId, s.titles) : "";
  });
  const n = (v: number) => Math.round(v).toLocaleString("es-CO");
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="@container w-full">
        <LookPreview look={profile.look ?? presetLook(profile.avatar)} held={hand.held} heldLeft={hand.left || undefined} className="items-center" />
      </div>
      <div className="min-w-0">
        <p className="text-[20px] leading-tight font-semibold break-words">{profile.name}</p>
        {me && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 border-2 border-cozy-frame bg-cozy-gold px-2 py-0.5 text-[13px] font-semibold text-cozy-paper-light shadow-[2px_2px_0_rgb(20_10_24/0.35)]">
            <PixelIcon name="star" size={11} />
            {me.title}
          </p>
        )}
      </div>
      <p className="text-[13px] text-cozy-ink-soft">
        {handName ? (
          <>
            En la mano: <strong className="text-cozy-ink">{handName}</strong>
          </>
        ) : (
          "Manos libres"
        )}
      </p>
      {me && (
        <div className="grid w-full grid-cols-2 gap-2">
          <div className="cozy-chip flex flex-col items-center px-2 py-1.5">
            <span className="flex items-center gap-1 text-[18px] font-semibold tabular-nums">
              <PixelIcon name="coin" size={14} color="var(--color-cozy-gold)" />
              {n(me.points)}
            </span>
            <span className="text-[12px] text-cozy-ink-soft">puntos</span>
          </div>
          <div className="cozy-chip flex flex-col items-center px-2 py-1.5">
            <span className="flex items-center gap-1 text-[18px] font-semibold tabular-nums">
              <BadgeGlyph icon="flame" scale={1} />
              {n(me.streak)}
            </span>
            <span className="text-[12px] text-cozy-ink-soft">días de racha</span>
          </div>
        </div>
      )}
      <button type="button" onClick={onEditCharacter} className="cozy-btn cozy-btn-primary w-full px-3 py-2 text-[14px]">
        Mi personaje
      </button>
    </div>
  );
}
