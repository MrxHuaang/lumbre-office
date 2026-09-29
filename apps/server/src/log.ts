// Logs del servidor de juego con un prefijo fijo ("[juego]") y el contexto a mano, para encontrarlos en
// los logs de Render entre todo lo demás. Sin servicios externos: solo la consola.

type Context = Record<string, unknown>;

function describe(where: string, context?: Context): string {
  if (!context || Object.keys(context).length === 0) return `[juego] ${where}`;
  let extra: string;
  try {
    extra = JSON.stringify(context);
  } catch {
    extra = String(context);
  }
  return `[juego] ${where} ${extra}`;
}

/** Anota un error con dónde pasó y los datos útiles (usuario, sala…). */
export function logError(where: string, err: unknown, context?: Context): void {
  console.error(describe(where, context), err);
}

export function logWarn(where: string, message: string, context?: Context): void {
  console.warn(`${describe(where, context)}: ${message}`);
}

export function logInfo(where: string, message: string, context?: Context): void {
  console.log(`${describe(where, context)}: ${message}`);
}

/**
 * Para un `.catch` que sigue con un valor de reemplazo: antes se tragaba el error en silencio, ahora
 * queda anotado. `promesa.catch(orElse("getPoints", 0, { userId }))`.
 */
export function orElse<T>(where: string, fallback: T, context?: Context): (err: unknown) => T {
  return (err) => {
    logError(where, err, context);
    return fallback;
  };
}
