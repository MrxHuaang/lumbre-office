// Lo que se lleva en la mano vive ahora en la mochila (bag.ts). Acá queda el reloj que comparten los
// módulos que esperan un rato (la borrachera, los brindis, el clima).

export interface HeldClock {
  setTimeout(fn: () => void, ms: number): { clear(): void };
}
