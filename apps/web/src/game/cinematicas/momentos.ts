// Los momentos del juego que llevan su cinemática corta (VIR-155): se enganchan a lo que ya llega del
// servidor (subir de nivel, un pez legendario o mítico, ver la estrella fugaz primero, el jackpot, el primer
// huevo, un logro legendario, el cumpleaños propio). Solo si me pasó a mí. Las de la historia (el prólogo,
// el final de un capítulo) y la de adoptar una mascota se disparan desde game/historia.ts y mascotas.ts.
import { achievementById, RELOJ_PASOS, STORY_PERIOD, FESTIVAL_MSG, fishById, GRANJA_MSG, type FestivalCineEvent, OFICIO_INFO, rewardsOf, RARITY, type GranjaNotice } from "@hyvento/shared";
import { useAchievementStore } from "../achievements";
import { useEncargos } from "../encargos";
import { currentGameTime } from "../gameClock";
import { useFishingStore } from "../fishing/store";
import { useMundoStore } from "../mundo";
import { onRoom } from "../network";
import { useObservatorio } from "../observatorio";
import { useOficios } from "../oficios";
import { useOfficeStore } from "../store";
import { playCineDef, playCinematic } from "./puerta";
import { playCineSound } from "./sonidos";

const me = () => useOfficeStore.getState().sessionId;

if (typeof window !== "undefined") {
  useOficios.subscribe((s, prev) => {
    const e = s.levelUp;
    if (!e || e === prev.levelUp || e.sessionId !== me()) return;
    const reward = rewardsOf(e.oficio).find((r) => r.level === e.level);
    void playCinematic("oficio-nivel", { oficio: OFICIO_INFO[e.oficio].name, nivel: e.level, premio: reward ? `Desbloqueaste: ${reward.label}` : "" });
  });

  useFishingStore.subscribe((s, prev) => {
    const c = s.card;
    if (!c || c === prev.card) return;
    const f = fishById(c.species);
    if (f?.rarity !== "legendario" && f?.rarity !== "mitico") return;
    void playCinematic("pez-legendario", { pez: f.name, rareza: RARITY[f.rarity].label, cm: c.size });
  });

  useObservatorio.subscribe((s, prev) => {
    const n = s.starNote;
    if (n && n !== prev.starNote && n.mine && n.first) void playCinematic("estrella-fugaz");
  });

  useMundoStore.subscribe((s, prev) => {
    const r = s.slot;
    if (r && r !== prev.slot && r.ok && r.line === "three") void playCinematic("jackpot", { puntos: r.won });
  });

  useAchievementStore.subscribe((s, prev) => {
    const fresh = s.toasts.filter((t) => !prev.toasts.some((p) => p.key === t.key));
    for (const t of fresh) {
      const a = achievementById(t.achievementId);
      if (a?.rarity === "legendario") void playCinematic("logro-legendario", { logro: a.name });
    }
  });

  // El cumpleaños propio: una vez por visita, al saberse.
  let celebrated = false;
  useOfficeStore.subscribe((s, prev) => {
    if (celebrated || s.birthdays === prev.birthdays || !s.sessionId) return;
    const mine = s.players[s.sessionId];
    if (!mine?.userId || !s.birthdays[mine.userId]) return;
    celebrated = true;
    void playCinematic("cumpleanos", { nombre: mine.name.split(" ")[0] ?? mine.name });
  });

  // En desarrollo, para probarlas a mano desde la consola: __cine("prologo"), __cine("jackpot", { puntos: 500 })
  // o una que se está escribiendo: __cineDef({ id: "x", kind: "historia", steps: [...] }).
  if (process.env.NODE_ENV !== "production") Object.assign(window, { __cine: playCinematic, __cineDef: playCineDef });

  // El reloj de pie de E. (capítulo 2): ya arreglado, da una campanada a cada hora del juego para quien está
  // en la planta baja (y a la 1 de la tarde, sus trece).
  let lastHour = -1;
  setInterval(() => {
    const t = currentGameTime();
    if (!t || t.hour === lastHour) return;
    const first = lastHour === -1;
    lastHour = t.hour;
    if (first || useOfficeStore.getState().area !== "planta-baja") return;
    const fixed = useEncargos.getState().quests.some((q) => q.questId === RELOJ_PASOS.arreglar && q.period === STORY_PERIOD && (q.status !== "ACTIVE" || q.progress >= q.goal));
    if (fixed) playCineSound(t.hour === 13 ? "campanadas" : "campanada");
  }, 1000);

  onRoom((room) => {
    // Los festivales: la apertura, el cierre y la llegada tarde las manda el servidor a todos.
    room.onMessage(FESTIVAL_MSG.cine, (e: FestivalCineEvent) => void playCinematic(e.id));
    room.onMessage(GRANJA_MSG.notice, (n: GranjaNotice) => {
      if (n.code === "eggs") void playCinematic("primer-huevo");
    });
  });
}
