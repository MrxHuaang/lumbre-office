"use client";

// Las imágenes de la portada: salen del build (scripts/prerender.ts → public/prerender/portada.json)
// y se muestran con <img>. Si faltan (desarrollo sin generar), se dibujan en el navegador con el motor,
// que se carga aparte (portada-motor.ts) para no sumarlo al paquete de la portada.
import type { Look } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { LANDING_MANIFEST, PRERENDER_DIR, type LandingImage, type LandingManifest } from "@/game/iso/prerender-paths";

/** Imagen recortada al dibujo, con la esquina del recorte en el lienzo original (en píxeles del motor). */
export type Dibujo = LandingImage;
type Motor = typeof import("./portada-motor");

let manifiesto: Promise<LandingManifest | null> | undefined;
function cargarManifiesto(): Promise<LandingManifest | null> {
  manifiesto ??= fetch(`${PRERENDER_DIR}/${LANDING_MANIFEST}`)
    .then((r) => (r.ok ? (r.json() as Promise<LandingManifest>) : null))
    .catch(() => null);
  return manifiesto;
}

/** URL de una imagen del build (la versión cambia con el dibujo: no queda una vieja en caché). */
export const urlDelBuild = (m: LandingManifest, archivo: string) => `${PRERENDER_DIR}/${archivo}?v=${m.version}`;

const conUrl = (m: LandingManifest, d: LandingImage | undefined): Dibujo | undefined => d && { ...d, src: urlDelBuild(m, d.src) };

/**
 * Lo pre-dibujado que pide `delBuild`; si el build no lo trae, lo que dibuja `enVivo` con el motor.
 * Mientras tanto (o si todo falla) es null: la portada deja el hueco y sigue funcionando.
 */
export function useArte<T>(delBuild: (m: LandingManifest) => T | undefined, enVivo: (motor: Motor) => T, clave: string): T | null {
  const [valor, setValor] = useState<T | null>(null);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const m = await cargarManifiesto();
        const hecho = m ? delBuild(m) : undefined;
        if (hecho !== undefined) return vivo && setValor(hecho);
        const motor = await import("./portada-motor");
        if (vivo) setValor(enVivo(motor));
      } catch (e) {
        console.error("No se pudo dibujar la portada", e);
      }
    })();
    return () => {
      vivo = false;
    };
    // `clave` resume lo que cambia el dibujo (las funciones se recrean en cada render).
  }, [clave]);
  return valor;
}

/** La escena viva (con sus luces y las medidas del personaje). */
export function useEscena(noche: boolean) {
  return useArte(
    (m) => ({ dibujo: conUrl(m, m.escena[noche ? "noche" : "dia"])!, luces: m.luces, frame: m.frame, feetY: m.feetY }),
    (motor) => motor.escenaEnVivo(noche),
    `escena-${noche}`,
  );
}

export function useSala(sala: string, noche: boolean) {
  return useArte((m) => conUrl(m, m.salas[sala]?.[noche ? "noche" : "dia"]), (motor) => motor.salaEnVivo(sala, noche), `sala-${sala}-${noche}`);
}

export function useObjeto(nombre: string) {
  return useArte((m) => conUrl(m, m.objetos[nombre]), (motor) => motor.objetoEnVivo(nombre), `objeto-${nombre}`);
}

/** Hoja de caminata de un personaje: la del build si la hay (clave de characterKey), si no, dibujada. */
export function useHoja(clave: string, avatar: string, look: Look | null) {
  return useArte((m) => (m.personajes[clave] ? urlDelBuild(m, m.personajes[clave]) : undefined), (motor) => motor.hojaEnVivo(avatar, look), clave);
}

/** ¿La persona pidió menos movimiento? (en el servidor, o si no se puede saber, se asume que no). */
export function prefiereQuieto(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
