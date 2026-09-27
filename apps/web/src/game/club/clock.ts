// La hora del servidor para la música del club: varios ping/pong al entrar y uno cada tanto, y se queda
// con el de menor ida y vuelta (la mitad de ese viaje es lo que tarda en llegar la hora). Así el mismo
// golpe suena a la vez en todos los navegadores y el desfase no crece con las horas.
import { clockOffset, MSG, type ClockPong, type ClockSample } from "@hyvento/shared";
import type { Room } from "colyseus.js";

/** Cuántos pings al entrar, cada cuánto después y cuántas medidas se guardan. */
const BURST = 5;
const BURST_GAP_MS = 250;
const EVERY_MS = 30_000;
const KEEP = 8;

let offset: number | null = null;
let timers: number[] = [];

/** Diferencia medida entre la hora del servidor y la local (null hasta la primera respuesta). */
export const measuredOffset = () => offset;

export function startClockSync(room: Room) {
  for (const t of timers) {
    window.clearTimeout(t);
    window.clearInterval(t);
  }
  timers = [];
  offset = null;
  const samples: ClockSample[] = [];
  const pending = new Map<number, number>();
  let next = 0;
  const ping = () => {
    const id = ++next;
    pending.set(id, performance.now());
    // Un ping que nunca volvió no se guarda para siempre.
    if (pending.size > KEEP) pending.delete(pending.keys().next().value!);
    room.send(MSG.clockPing, { id });
  };
  room.onMessage(MSG.clockPong, (p: ClockPong) => {
    const sent = pending.get(p.id);
    if (sent === undefined) return;
    pending.delete(p.id);
    // Se mide con el reloj monótono y se pasa a la hora local al final.
    const received = performance.now();
    const shift = Date.now() - received;
    samples.push({ sentAt: sent + shift, receivedAt: received + shift, serverNow: p.now });
    if (samples.length > KEEP) samples.shift();
    offset = clockOffset(samples);
  });
  for (let k = 0; k < BURST; k++) timers.push(window.setTimeout(ping, k * BURST_GAP_MS));
  timers.push(window.setInterval(ping, EVERY_MS));
}
