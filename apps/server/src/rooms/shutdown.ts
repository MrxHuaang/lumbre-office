// Cierre ordenado de la sala: esperar lo que quedó a medias (devoluciones y guardados) sin que una tarea que
// falla corte a las demás, y dejar anotado cuál falló.

/**
 * Corre todas las tareas a la vez y espera a que terminen (bien o mal). Las que fallan se anotan con su
 * nombre; ninguna tira error hacia afuera (el cierre sigue con lo demás).
 */
export async function settleAll(stage: string, tasks: Record<string, () => unknown>): Promise<void> {
  const names = Object.keys(tasks);
  // `Promise.resolve().then` también atrapa lo que falle de forma sincrónica.
  const results = await Promise.allSettled(names.map((name) => Promise.resolve().then(() => tasks[name]!())));
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`Cierre de la sala (${stage}): falló "${names[i]}"`, r.reason);
  });
}
