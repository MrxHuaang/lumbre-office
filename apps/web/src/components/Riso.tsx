import type { CSSProperties } from "react";

/** Logo: dos puntos de tinta superpuestos (rosa + azul = violeta) y la palabra Hyvento. */
export function RisoLogo({ dots = true }: { dots?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {dots && (
        <>
          <span className="h-[22px] w-[22px] rounded-full bg-riso-pink mix-blend-multiply" />
          <span className="-ml-[18px] h-[22px] w-[22px] rounded-full bg-riso-blue mix-blend-multiply" />
        </>
      )}
      <span className="font-display text-xl">Hyvento</span>
    </div>
  );
}

/**
 * Titular sobreimpreso: el texto se imprime dos veces, con dos tintas desplazadas y en
 * `multiply`, para que se mezclen donde se superponen (la técnica central del estilo RISO).
 */
export function Overprint({
  lines,
  back,
  front,
  offset,
  className = "",
  as: Tag = "p",
}: {
  lines: string[];
  back: string;
  front: string;
  offset: [number, number];
  className?: string;
  as?: "h1" | "h2" | "p";
}) {
  const text = lines.map((l, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {l}
    </span>
  ));
  return (
    <Tag className={`relative m-0 font-black whitespace-nowrap [font-family:var(--riso-archivo)] [font-stretch:125%] ${className}`}>
      <span aria-hidden className="absolute mix-blend-multiply" style={{ left: offset[0], top: offset[1], color: back }}>
        {text}
      </span>
      <span className="relative mix-blend-multiply" style={{ color: front }}>
        {text}
      </span>
    </Tag>
  );
}

/** Un frame (mirando hacia abajo) del spritesheet 3x4 de un personaje. */
export function Sprite({ avatar, className = "", style }: { avatar: string; className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      className={`pixelated aspect-square ${className}`}
      style={{ background: `url(/assets/characters/${avatar}.png) 0 0 / 300% 400% no-repeat`, ...style }}
    />
  );
}
