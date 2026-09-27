"use client";

// Fase 2: el buzón (recompensa diaria y movimientos) y el tablón (misiones y ranking) del jardín.
import { barItem, cafeItem, POINTS, shopItem, type HumanAvatar, type Look, type MissionAction, type MissionDTO, type PointReason } from "@hyvento/shared";
import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { activateInteractable } from "@/game/network";
import { useOfficeStore, type Interactable } from "@/game/store";
import { CharacterSprite } from "./CharacterSprite";
import { PixelIcon, type PixelIconName } from "./Cozy";

const REASON_LABEL: Record<PointReason, string> = {
  PRESENCE: "Presencia",
  MEETING: "Reunión",
  DAILY: "Recompensa diaria",
  MISSION: "Misión",
  ADMIN: "Ajuste",
  PURCHASE: "Compra",
  CASINO: "Casino",
  GIFT: "Regalo",
  LEISURE: "Ocio",
};

/** Nombre de un movimiento: las compras dicen qué se compró ("Cafetería · Tinto", "Tienda · Planta"). */
function moveLabel(m: { reason: PointReason; refId: string | null }) {
  // Solo el primer ":" separa: los ids de la tienda también pueden llevarlo ("shop:acc:scarf").
  const ref = m.refId ?? "";
  const i = ref.indexOf(":");
  const kind = i < 0 ? ref : ref.slice(0, i);
  const id = i < 0 ? "" : ref.slice(i + 1);
  if (m.reason === "PURCHASE" && kind === "cafe") return `Cafetería · ${cafeItem(id)?.name ?? "pedido"}`;
  if (m.reason === "PURCHASE" && kind === "bar") return `Bar del club · ${barItem(id)?.name ?? "pedido"}`;
  if (m.reason === "PURCHASE" && kind === "shop") return `Tienda · ${shopItem(id)?.name ?? "compra"}`;
  if (m.reason === "CASINO") return kind === "blackjack" ? "Casino · Blackjack" : "Casino · Ruleta";
  return REASON_LABEL[m.reason];
}

const PROMPT: Record<Interactable, string> = {
  mailbox: "Abrir el buzón",
  board: "Ver el tablón",
  cafe: "Pedir en la barra",
  shop: "Ver la tienda",
  fitting: "Entrar al probador",
  pole: "Bailar en el tubo",
  roulette: "Jugar a la ruleta",
  cashier: "Ver la caja",
  blackjack: "Jugar blackjack",
  bar: "Pedir en la barra del club",
  fishing: "Pescar",
};

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? "Algo salió mal. Intenta de nuevo.");
  return body;
}

const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
};

/** Saldo del jugador local (lo lleva el servidor de juego). */
export const useMyPoints = () =>
  useOfficeStore(useShallow((s) => (s.sessionId ? (s.players[s.sessionId]?.points ?? 0) : 0)));

/** Contador de puntos del HUD, con casillas como el dinero de Stardew. Clic: ver tus movimientos. */
export function PointsCounter() {
  const points = useMyPoints();
  const openPanel = useOfficeStore((s) => s.openPanel);
  const award = useOfficeStore((s) => s.lastAward);
  const digits = String(Math.max(0, points)).padStart(5, "0").slice(-6);
  return (
    <button
      type="button"
      onClick={() => openPanel("mailbox", false)}
      title="Tus puntos (ver movimientos)"
      aria-label={`${points} puntos`}
      className="cozy-panel flex items-center gap-1.5 px-2.5 py-1.5"
    >
      <PixelIcon name="coin" size={18} color="var(--color-cozy-gold)" />
      {/* La key cambia con cada premio: reinicia el "salto" de los números. */}
      <span key={award?.id ?? 0} className={`flex gap-0.5 ${award ? "animate-[cozy-pop_0.35s_steps(3)]" : ""}`}>
        {[...digits].map((d, i) => (
          <span key={i} className="grid h-6 w-[17px] place-items-center border-2 border-cozy-wood bg-cozy-paper-dark text-[15px] leading-none text-[#7a2a0e]">
            {d}
          </span>
        ))}
      </span>
    </button>
  );
}

/** Ayuda junto al buzón, el tablón o la barra: tecla E o botón para abrirlo. */
export function InteractPrompt() {
  const near = useOfficeStore((s) => s.interact);
  const panel = useOfficeStore((s) => s.panel);
  const openPanel = useOfficeStore((s) => s.openPanel);
  if (!near || panel) return null;
  return (
    <button
      type="button"
      onClick={() => activateInteractable(near)}
      className="cozy-chip absolute bottom-28 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 px-3 py-1.5 text-[14px]"
    >
      <kbd className="cozy-kbd">E</kbd>
      {PROMPT[near]}
    </button>
  );
}

/** Ventana de panel (buzón, tablón, barra): se cierra con Esc; mientras está abierta el teclado no mueve al personaje. */
export function PanelShell({
  title,
  icon,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  icon: PixelIconName;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const { setTyping } = useOfficeStore.getState();
    setTyping(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      setTyping(false);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgb(42_32_51/0.55)] p-3" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal aria-label={title} className={`cozy-panel flex max-h-full w-full flex-col p-1.5 ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <header className="flex items-center gap-2 bg-cozy-wood px-4 py-2.5 text-cozy-paper-light">
          <PixelIcon name={icon} size={16} />
          <h2 className="flex-1 text-[18px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="p-1" aria-label="Cerrar">
            <PixelIcon name="close" size={12} />
          </button>
        </header>
        <div className="cozy-scroll min-h-0 overflow-y-auto px-4 py-4">{children}</div>
      </section>
    </div>
  );
}

// ---------- Buzón ----------

interface PointsState {
  balance: number;
  daily: { claimed: boolean; streak: number; reward: number };
  moves: { id: string; amount: number; reason: PointReason; refId: string | null; at: string }[];
}

export function MailboxPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const [data, setData] = useState<PointsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const notify = useOfficeStore((s) => s.notify);

  const load = useCallback(() => {
    api<PointsState>("/api/points").then(setData, (e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const claim = async () => {
    setClaiming(true);
    setError(null);
    try {
      const r = await api<{ reward: number; streak: number }>("/api/mailbox/claim", { method: "POST" });
      notify(`+${r.reward} puntos · racha de ${r.streak} ${r.streak === 1 ? "día" : "días"}`, "success");
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <PanelShell title="Buzón" icon="mail" onClose={onClose}>
      {!data ? (
        <p className="text-[14px] text-cozy-ink-soft">{error ?? "Abriendo el buzón…"}</p>
      ) : (
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <p className="text-[15px] font-semibold">Recompensa diaria</p>
            <StreakDays streak={data.daily.streak} claimed={data.daily.claimed} />
            {data.daily.claimed ? (
              <p className="text-[14px] text-cozy-ink-soft">Ya la reclamaste hoy. Vuelve mañana para seguir la racha.</p>
            ) : atObject ? (
              <button type="button" onClick={claim} disabled={claiming} className="cozy-btn cozy-btn-primary self-start px-5 py-2.5 text-[15px]">
                <PixelIcon name="coin" size={14} />
                {claiming ? "Abriendo…" : `Reclamar +${data.daily.reward}`}
              </button>
            ) : (
              <p className="text-[14px] text-cozy-ink-soft">Hay {data.daily.reward} puntos esperándote en el buzón del jardín.</p>
            )}
            {error && <p className="text-[14px] font-semibold text-cozy-red-deep">{error}</p>}
          </section>

          <section className="flex flex-col gap-2">
            <p className="flex items-center justify-between text-[15px] font-semibold">
              Movimientos
              <span className="flex items-center gap-1 text-[14px] font-normal">
                <PixelIcon name="coin" size={13} color="var(--color-cozy-gold)" />
                {data.balance}
              </span>
            </p>
            {data.moves.length === 0 ? (
              <p className="text-[14px] text-cozy-ink-soft">Todavía nada. Los puntos llegan solos mientras estás en la cabaña.</p>
            ) : (
              <ul>
                {data.moves.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 border-b-2 border-cozy-paper-dark py-1.5 text-[14px] last:border-b-0">
                    <span className="flex-1">{moveLabel(m)}</span>
                    <span className="text-[12px] text-cozy-ink-soft">{ago(m.at)}</span>
                    <span className={`w-12 text-right font-semibold ${m.amount >= 0 ? "text-cozy-green" : "text-cozy-red-deep"}`}>
                      {m.amount >= 0 ? "+" : ""}
                      {m.amount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </PanelShell>
  );
}

/** La racha como una fila de días (estrellas encendidas hasta el tope de la bonificación). */
function StreakDays({ streak, claimed }: { streak: number; claimed: boolean }) {
  const max = POINTS.dailyStreakMaxDays;
  const lit = Math.min(streak, max) - (claimed ? 0 : 1);
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          title={`Día ${i + 1}`}
          className={`grid h-8 w-8 place-items-center border-2 ${i < lit ? "border-cozy-wood bg-cozy-paper-dark" : i === lit && !claimed ? "border-cozy-red bg-cozy-paper-light" : "border-cozy-paper-dark bg-cozy-paper-light"}`}
        >
          <PixelIcon name="star" size={14} color={i < lit ? "var(--color-cozy-gold)" : "var(--color-cozy-paper-dark)"} />
        </span>
      ))}
      <span className="ml-2 text-[13px] text-cozy-ink-soft">
        {streak} {streak === 1 ? "día" : "días"}
      </span>
    </div>
  );
}

// ---------- Tablón ----------

interface MissionsState {
  missions: MissionDTO[];
  me: string;
  isAdmin: boolean;
}

interface RankingState {
  days: number;
  me: string;
  ranking: { userId: string; name: string; avatar: HumanAvatar; look: Look | null; earned: number }[];
}

export function BoardPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"missions" | "ranking">("missions");
  return (
    <PanelShell title="Tablón" icon="board" onClose={onClose} wide>
      <div role="tablist" className="mb-4 flex gap-2">
        <button type="button" role="tab" aria-selected={tab === "missions"} onClick={() => setTab("missions")} className="cozy-btn">
          Misiones
        </button>
        <button type="button" role="tab" aria-selected={tab === "ranking"} onClick={() => setTab("ranking")} className="cozy-btn">
          <PixelIcon name="trophy" size={13} />
          Ranking
        </button>
      </div>
      {tab === "missions" ? <Missions /> : <Ranking />}
    </PanelShell>
  );
}

function Missions() {
  const [data, setData] = useState<MissionsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const notify = useOfficeStore((s) => s.notify);

  const load = useCallback(() => {
    api<MissionsState>("/api/missions").then(setData, (e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const act = async (m: MissionDTO, action: MissionAction) => {
    setBusy(m.id);
    setError(null);
    try {
      await api(`/api/missions/${m.id}`, { method: "POST", body: JSON.stringify({ action }) });
      if (action === "approve") notify(`${m.assignee?.name ?? "Alguien"} ganó ${m.reward} puntos`, "success");
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <p className="text-[14px] text-cozy-ink-soft">{error ?? "Leyendo el tablón…"}</p>;
  const groups: { title: string; items: MissionDTO[] }[] = [
    { title: "Por revisar", items: data.missions.filter((m) => m.status === "REVIEW") },
    { title: "Abiertas", items: data.missions.filter((m) => m.status === "OPEN") },
    { title: "En curso", items: data.missions.filter((m) => m.status === "TAKEN") },
    { title: "Terminadas", items: data.missions.filter((m) => m.status === "DONE") },
  ];

  return (
    <div className="flex flex-col gap-5">
      {creating ? (
        <NewMission
          maxReward={data.isAdmin ? POINTS.missionMaxReward.ADMIN : POINTS.missionMaxReward.MEMBER}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      ) : (
        <button type="button" onClick={() => setCreating(true)} className="cozy-btn cozy-btn-primary self-start">
          + Publicar una misión
        </button>
      )}
      {error && <p className="text-[14px] font-semibold text-cozy-red-deep">{error}</p>}
      {groups.every((g) => g.items.length === 0) && (
        <p className="text-[14px] text-cozy-ink-soft">El tablón está vacío. Publica la primera misión: algo que el equipo necesite, con una recompensa.</p>
      )}
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.title} className="flex flex-col gap-2">
              <p className="text-[15px] font-semibold text-cozy-ink-soft">{g.title}</p>
              {g.items.map((m) => (
                <MissionCard key={m.id} m={m} me={data.me} isAdmin={data.isAdmin} busy={busy === m.id} onAct={(a) => void act(m, a)} />
              ))}
            </section>
          ),
      )}
    </div>
  );
}

function MissionCard({ m, me, isAdmin, busy, onAct }: { m: MissionDTO; me: string; isAdmin: boolean; busy: boolean; onAct: (a: MissionAction) => void }) {
  const mine = m.createdBy.id === me;
  const manager = mine || isAdmin;
  const assignee = m.assignee?.id === me;
  const btn = (action: MissionAction, label: string, kind = "") => (
    <button key={action} type="button" disabled={busy} onClick={() => onAct(action)} className={`cozy-btn px-2.5 py-1 text-[13px] ${kind}`}>
      {label}
    </button>
  );
  const actions: React.ReactNode[] = [];
  if (m.status === "OPEN" && !mine) actions.push(btn("take", "Tomar", "cozy-btn-primary"));
  if (m.status === "TAKEN" && assignee) actions.push(btn("submit", "Entregar", "cozy-btn-primary"), btn("release", "Soltar"));
  if (m.status === "REVIEW" && manager && !assignee) actions.push(btn("approve", `Aprobar y pagar`, "cozy-btn-primary"), btn("reject", "Falta algo"));
  if (["OPEN", "TAKEN", "REVIEW"].includes(m.status) && manager) actions.push(btn("cancel", "Cancelar", "cozy-btn-danger"));

  const who =
    m.status === "DONE"
      ? `La hizo ${m.assignee?.name ?? "alguien"}`
      : m.status === "REVIEW"
        ? `${m.assignee?.name ?? "Alguien"} la entregó · espera revisión`
        : m.status === "TAKEN"
          ? `La está haciendo ${assignee ? "tú" : (m.assignee?.name ?? "alguien")}`
          : `Publicada por ${mine ? "ti" : m.createdBy.name}`;

  return (
    <article className="border-2 border-cozy-wood bg-cozy-paper-light px-3.5 py-3 shadow-[inset_0_-2px_0_var(--color-cozy-paper-dark)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{m.title}</p>
          {m.description && <p className="mt-1 text-[14px] leading-snug whitespace-pre-line text-cozy-ink-soft">{m.description}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-1 border-2 border-cozy-wood bg-cozy-paper-dark px-2 py-0.5 text-[14px]">
          <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
          {m.reward}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="mr-auto text-[12px] text-cozy-ink-soft">{who}</span>
        {actions}
      </div>
    </article>
  );
}

function NewMission({ maxReward, onCancel, onCreated }: { maxReward: number; onCancel: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("/api/missions", { method: "POST", body: JSON.stringify({ title, description, reward }) });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-2 border-cozy-wood bg-cozy-paper-light p-3.5">
      <label className="flex flex-col gap-1 text-[14px] font-semibold">
        Qué hay que hacer
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Revisar el diseño del login" className="cozy-input px-3 py-2 text-[14px] font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-[14px] font-semibold">
        Detalles (opcional)
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} className="cozy-input resize-none px-3 py-2 text-[14px] font-normal" />
      </label>
      <label className="flex items-center gap-3 text-[14px] font-semibold">
        Recompensa
        <input
          type="number"
          min={POINTS.missionMinReward}
          max={maxReward}
          value={reward}
          onChange={(e) => setReward(Number(e.target.value))}
          className="cozy-input w-24 px-3 py-2 text-[14px] font-normal"
        />
        <span className="text-[13px] font-normal text-cozy-ink-soft">
          puntos (de {POINTS.missionMinReward} a {maxReward})
        </span>
      </label>
      {error && <p className="text-[14px] font-semibold text-cozy-red-deep">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving || title.trim().length < 3} className="cozy-btn cozy-btn-primary">
          {saving ? "Publicando…" : "Publicar"}
        </button>
        <button type="button" onClick={onCancel} className="cozy-btn">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Ranking() {
  const [data, setData] = useState<RankingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<RankingState>("/api/points/ranking").then(setData, (e: Error) => setError(e.message));
  }, []);
  if (!data) return <p className="text-[14px] text-cozy-ink-soft">{error ?? "Contando puntos…"}</p>;
  if (data.ranking.length === 0) return <p className="text-[14px] text-cozy-ink-soft">Nadie ganó puntos en los últimos {data.days} días todavía.</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] text-cozy-ink-soft">Puntos ganados en los últimos {data.days} días.</p>
      <ol>
        {data.ranking.map((r, i) => (
          <li
            key={r.userId}
            className={`flex items-center gap-3 border-b-2 border-cozy-paper-dark px-2 py-1.5 text-[15px] last:border-b-0 ${r.userId === data.me ? "bg-cozy-paper-dark" : ""}`}
          >
            <span className={`w-6 text-center font-semibold ${i === 0 ? "text-cozy-gold" : "text-cozy-ink-soft"}`}>{i + 1}</span>
            <CharacterSprite avatar={r.avatar} look={r.look} dir="right" className="w-8 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {r.name}
              {r.userId === data.me && " (tú)"}
            </span>
            <span className="flex items-center gap-1 font-semibold">
              <PixelIcon name="coin" size={13} color="var(--color-cozy-gold)" />
              {r.earned}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
