"use client";

// El perfil de una persona: su personaje en grande, el título que le ganaron sus manías, datos curiosos
// sacados de las estadísticas y la grilla de logros (bloqueados en silueta, los secretos como "???").
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_CATEGORY,
  ACHIEVEMENT_RARITIES,
  ACHIEVEMENT_RARITY,
  ACHIEVEMENT_SCORE,
  ACHIEVEMENTS,
  MAX_ACHIEVEMENT_SCORE,
  achievementScore,
  nearestAchievements,
  type AchievementCategory,
  fishById,
  STAT_KEYS,
  type Achievement,
  type BadgeIcon,
  type PresenceStatus,
  type ProfileAchievementDTO,
  type ProfileDTO,
} from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { STATUS_HEX } from "@/lib/cozy";
import { CharacterSprite } from "../CharacterSprite";
import { PixelIcon } from "../Cozy";
import { Badge, BadgeGlyph } from "./Badge";

const STATUS_LABEL: Record<PresenceStatus, string> = { available: "Disponible", busy: "Ocupado", dnd: "No molestar", away: "Ausente", meeting: "En reunión" };

const n = (v: number) => Math.round(v).toLocaleString("es-CO");
const plural = (v: number, one: string, many: string) => `${n(v)} ${Math.round(v) === 1 ? one : many}`;
const since = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
const day = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

/**
 * `onBadgeChanged`: se eligió otra insignia destacada (dentro de la cabaña se avisa a la sala para que
 * todos la vean junto al nombre).
 */
export function ProfileView({ profile, onBadgeChanged }: { profile: ProfileDTO; onBadgeChanged?: () => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <Identity profile={profile} />
      <div className="flex min-w-0 flex-col gap-4">
        <Facts profile={profile} />
        <Achievements profile={profile} onBadgeChanged={onBadgeChanged} />
      </div>
    </div>
  );
}

// ---------- Quién es ----------

function Identity({ profile: p }: { profile: ProfileDTO }) {
  const status = (p.status in STATUS_LABEL ? p.status : "available") as PresenceStatus;
  return (
    // En pantallas anchas la columna de la persona queda fija y solo corre la de los datos y los logros.
    <aside className="flex flex-col items-center gap-3 text-center md:sticky md:top-0 md:items-stretch md:self-start md:text-left">
      {/* Un trocito de pasto del jardín, con el personaje caminando en su lugar. */}
      <div className="relative grid w-full max-w-[15rem] place-items-center self-center border-2 border-cozy-frame bg-[#5d9c46] py-3 shadow-[inset_0_0_0_2px_#4f8a3c,inset_0_-10px_0_#4f8a3c]">
        <CharacterSprite avatar={p.avatar} look={p.look} walking className="w-36" />
      </div>
      <div className="min-w-0">
        <h3 className="text-[24px] leading-tight font-semibold break-words">{p.name}</h3>
        <p className="mt-1.5 inline-flex items-center gap-1.5 border-2 border-cozy-frame bg-cozy-gold px-2 py-0.5 text-[13px] font-semibold text-cozy-paper-light shadow-[2px_2px_0_rgb(20_10_24/0.35)]">
          <PixelIcon name="star" size={11} />
          {p.title}
        </p>
      </div>
      <dl className="grid w-full grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-left text-[13px]">
        <dt className="text-cozy-ink-soft">Estado</dt>
        <dd className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 border-2 border-cozy-frame" style={{ background: STATUS_HEX[status] }} />
          {STATUS_LABEL[status]}
        </dd>
        <dt className="text-cozy-ink-soft">Oficina</dt>
        <dd className="min-w-0 truncate">{p.officeName ?? "Sin oficina (todavía)"}</dd>
        <dt className="text-cozy-ink-soft">Llegó en</dt>
        <dd>{since(p.memberSince)}</dd>
      </dl>
      <div className="grid w-full grid-cols-2 gap-2">
        <div className="cozy-chip flex flex-col items-center px-2 py-1.5">
          <span className="flex items-center gap-1 text-[18px] font-semibold tabular-nums">
            <PixelIcon name="coin" size={14} color="var(--color-cozy-gold)" />
            {n(p.points)}
          </span>
          <span className="text-[12px] text-cozy-ink-soft">puntos</span>
        </div>
        <div className="cozy-chip flex flex-col items-center px-2 py-1.5">
          <span className="flex items-center gap-1 text-[18px] font-semibold tabular-nums">
            <BadgeGlyph icon="flame" scale={1} />
            {n(p.streak)}
          </span>
          <span className="text-[12px] text-cozy-ink-soft">{p.streak === 1 ? "día de racha" : "días de racha"}</span>
        </div>
      </div>
    </aside>
  );
}

// ---------- Datos curiosos ----------

interface Fact {
  icon: BadgeIcon;
  value: string;
  label: string;
  /** El chiste o el dato de al lado. */
  note: string;
  tone?: "good" | "bad";
}

function facts(p: ProfileDTO): Fact[] {
  const s = (k: string) => p.stats[k] ?? 0;
  const hours = s(STAT_KEYS.secondsOnline) / 3600;
  const tiles = s(STAT_KEYS.tilesWalked);
  const best = p.bestFish && fishById(p.bestFish.species);
  const coffees = s(STAT_KEYS.coffees);
  return [
    {
      icon: "cup",
      value: n(coffees),
      label: coffees === 1 ? "taza de café" : "tazas de café",
      note: coffees ? `≈ ${(coffees * 0.12).toLocaleString("es-CO", { maximumFractionDigits: 1 })} litros de tinto en las venas` : "Vive sin cafeína. Un misterio.",
    },
    {
      icon: "glass",
      value: n(s(STAT_KEYS.sips)),
      label: "sorbos",
      note: `y ${plural(s(STAT_KEYS.bites), "mordisco", "mordiscos")}, ${plural(s(STAT_KEYS.puffs), "pitada", "pitadas")}`,
    },
    {
      icon: "bottle",
      value: n(s(STAT_KEYS.blackouts)),
      label: s(STAT_KEYS.blackouts) === 1 ? "vez desmayado" : "veces desmayado",
      note: s(STAT_KEYS.blackouts) ? `${plural(s(STAT_KEYS.sofaNaps), "siesta", "siestas")} en el sofá del piso 2` : "Sobrio como un juez.",
      tone: s(STAT_KEYS.blackouts) >= 3 ? "bad" : undefined,
    },
    {
      icon: "fish",
      value: n(s(STAT_KEYS.fishCaught)),
      label: s(STAT_KEYS.fishCaught) === 1 ? "pez" : "peces",
      note: best ? `El mejor: ${best.name} de ${p.bestFish!.size} cm` : "Ni una picada todavía.",
    },
    {
      icon: "chip",
      value: `${p.casinoNet > 0 ? "+" : ""}${n(p.casinoNet)}`,
      label: "neto en el casino",
      note: p.casinoNet < 0 ? "La casa te manda saludos." : p.casinoNet > 0 ? "La casa te tiene en la mira." : "Ni fu ni fa.",
      tone: p.casinoNet < 0 ? "bad" : p.casinoNet > 0 ? "good" : undefined,
    },
    {
      icon: "clock",
      value: hours < 10 ? hours.toLocaleString("es-CO", { maximumFractionDigits: 1 }) : n(hours),
      label: "horas en la cabaña",
      note: p.favoriteZone ? `Casi siempre en: ${p.favoriteZone}${p.favoriteArea && p.favoriteArea !== p.favoriteZone ? ` (${p.favoriteArea})` : ""}` : "Recién desempacando.",
    },
    {
      icon: "shoe",
      value: n(tiles),
      label: "baldosas caminadas",
      note: `≈ ${(tiles * 0.5 / 1000).toLocaleString("es-CO", { maximumFractionDigits: 2 })} km en pantuflas`,
    },
    {
      icon: "cat",
      value: n(s(STAT_KEYS.catPets)),
      label: s(STAT_KEYS.catPets) === 1 ? "caricia al gato" : "caricias al gato",
      note: `y ${plural(s(STAT_KEYS.pianoPlays), "vez", "veces")} al piano`,
    },
    {
      icon: "map",
      value: `${n(s(STAT_KEYS.areasVisited))}`,
      label: "niveles visitados",
      note: `${plural(s(STAT_KEYS.chatMessages), "mensaje", "mensajes")} y ${plural(s(STAT_KEYS.emotes), "emote", "emotes")}`,
    },
  ];
}

function Facts({ profile }: { profile: ProfileDTO }) {
  const list = useMemo(() => facts(profile), [profile]);
  return (
    <section aria-labelledby="perfil-datos">
      <h4 id="perfil-datos" className="mb-2 text-[15px] font-semibold">
        Datos curiosos
      </h4>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((f) => (
          <li key={f.label} className="flex min-w-0 gap-2 border-2 border-cozy-paper-dark bg-cozy-paper-light px-2.5 py-2">
            <BadgeGlyph icon={f.icon} scale={2} className="mt-0.5 shrink-0 self-start" />
            <div className="min-w-0">
              <p
                className="text-[20px] leading-none font-semibold tabular-nums"
                style={{ color: f.tone === "bad" ? "var(--color-cozy-red-deep)" : f.tone === "good" ? "var(--color-cozy-green)" : undefined }}
              >
                {f.value}
              </p>
              <p className="mt-0.5 text-[13px] leading-tight">{f.label}</p>
              <p className="mt-1 text-[12px] leading-snug text-cozy-ink-soft">{f.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Logros ----------

type Filter = "all" | "done" | "todo";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "done", label: "Conseguidos" },
  { id: "todo", label: "Pendientes" },
];

/** La insignia destacada propia: se lee y se cambia con /api/badge (solo en el perfil propio). */
function useFeaturedBadge(enabled: boolean, onChanged?: () => void) {
  const [featured, setFeatured] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch("/api/badge", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { achievementId: string | null } | null) => alive && b && setFeatured(b.achievementId))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [enabled]);
  const choose = async (achievementId: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/badge", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ achievementId }) });
      const body = (await res.json().catch(() => null)) as { achievementId?: string | null; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "No se pudo guardar la insignia.");
      setFeatured(body?.achievementId ?? null);
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { featured, choose, busy, error };
}

function Achievements({ profile, onBadgeChanged }: { profile: ProfileDTO; onBadgeChanged?: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [group, setGroup] = useState<AchievementCategory | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const badge = useFeaturedBadge(profile.isMe, onBadgeChanged);
  const byId = useMemo(() => new Map(profile.achievements.map((a) => [a.id, a])), [profile.achievements]);
  // Primero lo conseguido (lo más nuevo arriba), después lo que está más cerca de salir.
  const rows = useMemo(() => {
    const list = ACHIEVEMENTS.map((a, i) => ({ a, st: byId.get(a.id) ?? { id: a.id, unlockedAt: null, progress: 0, owners: 0 }, i }));
    list.sort((x, y) => {
      if (x.st.unlockedAt && y.st.unlockedAt) return y.st.unlockedAt.localeCompare(x.st.unlockedAt);
      if (x.st.unlockedAt || y.st.unlockedAt) return x.st.unlockedAt ? -1 : 1;
      return y.st.progress - x.st.progress || x.i - y.i;
    });
    return list;
  }, [byId]);
  const done = rows.filter((r) => r.st.unlockedAt).length;
  const unlockedIds = useMemo(() => new Set(rows.filter((r) => r.st.unlockedAt).map((r) => r.a.id)), [rows]);
  const score = achievementScore(unlockedIds);
  const next = useMemo(() => nearestAchievements(profile.stats, unlockedIds, 3), [profile.stats, unlockedIds]);
  const shown = rows.filter(
    (r) => (group === "all" || r.a.category === group) && (filter === "all" ? true : filter === "done" ? r.st.unlockedAt : !r.st.unlockedAt),
  );
  const pick = selected ? rows.find((r) => r.a.id === selected) : undefined;
  const countIn = (c: AchievementCategory) => {
    const inGroup = rows.filter((r) => r.a.category === c);
    return `${inGroup.filter((r) => r.st.unlockedAt).length}/${inGroup.length}`;
  };

  return (
    <section aria-labelledby="perfil-logros">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h4 id="perfil-logros" className="text-[15px] font-semibold">
          Logros
        </h4>
        <span className="text-[13px] text-cozy-ink-soft tabular-nums">
          {done} de {rows.length}
        </span>
        <Meter value={done / rows.length} className="min-w-16 flex-1" label={`${done} de ${rows.length} logros`} />
        <span
          className="inline-flex items-center gap-1 border-2 border-cozy-frame bg-cozy-paper-light px-1.5 py-0.5 text-[12px] tabular-nums"
          title={`Puntaje de logros: cada uno vale según su rareza (máximo ${n(MAX_ACHIEVEMENT_SCORE)})`}
        >
          <PixelIcon name="star" size={10} color="var(--color-cozy-gold)" />
          {n(score)}
        </span>
        <div role="group" aria-label="Filtrar logros" className="flex gap-1">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className="cozy-btn px-2 py-1 text-[12px]">
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <RarityRow rows={rows} />
      {next.length > 0 && (
        <div className="mb-2 border-2 border-dashed border-cozy-paper-dark px-2.5 py-2">
          <p className="mb-1.5 text-[12px] text-cozy-ink-soft">{profile.isMe ? "Te falta poco para:" : "Le falta poco para:"}</p>
          <ul className="flex flex-col gap-1.5">
            {next.map(({ achievement: a, progress, value }) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    setGroup("all");
                    setFilter("all");
                    setSelected(a.id);
                  }}
                  className="flex w-full items-center gap-2 text-left hover:bg-cozy-paper-light"
                >
                  <Badge achievement={a} locked scale={1} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{a.name}</span>
                  <span className="shrink-0 text-[12px] text-cozy-ink-soft tabular-nums">
                    {n(value)}/{n(a.min)}
                  </span>
                  <Meter value={progress} className="w-16 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div role="group" aria-label="Grupos de logros" className="cozy-scroll mb-2 flex gap-1 overflow-x-auto pb-1">
        <button type="button" aria-pressed={group === "all"} onClick={() => setGroup("all")} className="cozy-btn shrink-0 px-2 py-1 text-[12px]">
          Todo
        </button>
        {ACHIEVEMENT_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={group === c}
            onClick={() => setGroup(c)}
            title={ACHIEVEMENT_CATEGORY[c].label}
            className="cozy-btn shrink-0 gap-1 px-2 py-1 text-[12px]"
          >
            <BadgeGlyph icon={ACHIEVEMENT_CATEGORY[c].icon} scale={1} />
            <span className="max-sm:sr-only">{ACHIEVEMENT_CATEGORY[c].label}</span>
            <span className="text-cozy-ink-soft tabular-nums">{countIn(c)}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="border-2 border-dashed border-cozy-paper-dark px-3 py-4 text-center text-[13px] text-cozy-ink-soft">
          {filter === "done" ? (profile.isMe ? "Todavía ninguno. Pide un tinto para empezar." : "Todavía ninguno.") : "¡Los tiene todos! Leyenda de la cabaña."}
        </p>
      ) : (
        <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
          {shown.map(({ a, st }) => {
            const locked = !st.unlockedAt;
            const hidden = locked && a.secret;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  aria-pressed={selected === a.id}
                  onClick={() => setSelected(selected === a.id ? null : a.id)}
                  title={hidden ? "Logro secreto" : a.name}
                  className="flex w-full flex-col items-center gap-1 border-2 border-transparent px-0.5 pt-1 pb-1.5 hover:border-cozy-paper-dark aria-pressed:border-cozy-red aria-pressed:bg-cozy-paper-light"
                >
                  <span className="relative">
                    <Badge achievement={a} locked={locked} scale={2} />
                    {profile.isMe && badge.featured === a.id && (
                      <span className="absolute -top-1 -right-1" title="Junto a tu nombre">
                        <PixelIcon name="star" size={11} color="var(--color-cozy-gold)" />
                      </span>
                    )}
                  </span>
                  {locked && !hidden ? (
                    <Meter value={st.progress} className="w-10" />
                  ) : (
                    <span className="h-[6px]" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {pick && (
        <AchievementDetail a={pick.a} st={pick.st} teamSize={profile.teamSize} stats={profile.stats}>
          {profile.isMe && pick.st.unlockedAt && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={badge.busy}
                aria-pressed={badge.featured === pick.a.id}
                onClick={() => void badge.choose(badge.featured === pick.a.id ? null : pick.a.id)}
                className="cozy-btn px-2.5 py-1 text-[13px]"
              >
                {badge.featured === pick.a.id ? "Quitar de junto a mi nombre" : "Llevar junto a mi nombre"}
              </button>
              {badge.error && <span className="text-[12px] text-cozy-red-deep">{badge.error}</span>}
            </div>
          )}
        </AchievementDetail>
      )}
    </section>
  );
}

/** "12 de 50" (en horas para el tiempo en la cabaña, que se cuenta en segundos). */
function progressText(a: Achievement, stats: Readonly<Record<string, number>>): string {
  const v = Math.min(stats[a.stat] ?? 0, a.min);
  if (a.stat === STAT_KEYS.secondsOnline) return `${n(Math.floor(v / 3600))} de ${n(a.min / 3600)} horas`;
  return `${n(v)} de ${n(a.min)}`;
}

/** Cuántos de cada rareza tiene: una fila chiquita debajo del total. */
function RarityRow({ rows }: { rows: { a: Achievement; st: ProfileAchievementDTO }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-cozy-ink-soft">
      {ACHIEVEMENT_RARITIES.map((r) => {
        const all = rows.filter((x) => x.a.rarity === r);
        const got = all.filter((x) => x.st.unlockedAt).length;
        return (
          <li key={r} className="flex items-center gap-1 tabular-nums">
            <span className="size-2 shrink-0 border border-cozy-frame" style={{ background: ACHIEVEMENT_RARITY[r].color }} />
            {ACHIEVEMENT_RARITY[r].label} {got}/{all.length}
          </li>
        );
      })}
    </ul>
  );
}

function AchievementDetail({
  a,
  st,
  teamSize,
  stats,
  children,
}: {
  a: Achievement;
  st: ProfileAchievementDTO;
  teamSize: number;
  stats: Readonly<Record<string, number>>;
  children?: React.ReactNode;
}) {
  const locked = !st.unlockedAt;
  const hidden = locked && a.secret;
  const rarity = ACHIEVEMENT_RARITY[a.rarity];
  const pct = teamSize > 0 ? Math.round((st.owners / teamSize) * 100) : 0;
  return (
    <div className="mt-2 flex items-start gap-3 border-2 border-cozy-wood bg-cozy-paper-light px-3 py-2.5" aria-live="polite">
      <Badge achievement={a} locked={locked} scale={3} className="shrink-0" />
      <div className="min-w-0 flex-1 text-[13px]">
        <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold">
          {hidden ? "???" : a.name}
          <span className="inline-flex items-center gap-1 border-2 border-cozy-frame bg-cozy-paper px-1.5 py-px text-[12px] leading-none font-normal">
            <span className="size-2 shrink-0" style={{ background: rarity.color }} />
            {rarity.label}
          </span>
        </p>
        <p className="mt-1 leading-snug">{hidden ? "Es un secreto. Sigue explorando la cabaña…" : a.description}</p>
        {!hidden && <p className="mt-1 text-cozy-ink-soft">Cómo: {a.goal.charAt(0).toLowerCase() + a.goal.slice(1)}.</p>}
        <p className="mt-1.5 text-cozy-ink-soft">
          {locked ? (hidden ? "Bloqueado" : `Progreso: ${progressText(a, stats)}`) : `Desbloqueado el ${day(st.unlockedAt!)}`}
          {" · "}
          {st.owners === 0 ? "Nadie del equipo lo tiene todavía" : `${pct}% del equipo lo tiene`}
        </p>
        {locked && !hidden && <Meter value={st.progress} className="mt-1.5 max-w-60" />}
        {!hidden && (
          <p className="mt-1 text-[12px] text-cozy-ink-soft">
            {ACHIEVEMENT_CATEGORY[a.category].label} · vale {ACHIEVEMENT_SCORE[a.rarity]} de puntaje
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

/** Barra de progreso pixel (sin degradados): relleno dorado sobre papel. */
function Meter({ value, className = "", label }: { value: number; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label ?? `${pct}%`}
      className={`block h-[6px] border border-cozy-frame bg-cozy-paper-dark ${className}`}
    >
      <span className="block h-full bg-cozy-gold" style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Para los enlaces: la ruta pública del perfil. */
export const profileHref = (id: string) => `/perfil/${encodeURIComponent(id)}`;
export { Facts as ProfileFacts, Achievements as ProfileAchievements };
