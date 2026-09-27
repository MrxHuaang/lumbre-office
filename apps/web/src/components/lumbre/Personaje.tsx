"use client";

// Un personaje de la portada: la hoja de caminata viene del build (sin el motor de arte); uno armado al
// azar que el build no conoce se dibuja en el navegador (el motor se carga recién ahí).
import type { Direction, Look } from "@hyvento/shared";
import type { CSSProperties } from "react";
import { characterKey } from "@/game/lookKey";
import { CharacterSheet } from "../CharacterSheet";
import { useHoja } from "./dibujo";

export function Personaje({
  avatar,
  look = null,
  ...rest
}: {
  avatar: string;
  look?: Look | null;
  dir?: Direction;
  walking?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const url = useHoja(characterKey(avatar, look), avatar, look);
  return <CharacterSheet url={url} {...rest} />;
}
