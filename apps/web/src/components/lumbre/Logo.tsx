// El logotipo de Lumbre: la llamita pixel (dos cuadros que se turnan: titila) y el nombre en la
// fuente pixel con sombra de madera, como los títulos cozy.
import { llamaPixeles, MARCA } from "./marca";

const A = llamaPixeles(0);
const B = llamaPixeles(1);

/** La llamita. Con `viva` titila (salvo con "menos movimiento"). */
export function Llama({ size = 32, viva = true, className = "" }: { size?: number; viva?: boolean; className?: string }) {
  return (
    <svg
      width={(size * A.w) / A.h}
      height={size}
      viewBox={`0 0 ${A.w} ${A.h}`}
      shapeRendering="crispEdges"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <g className={viva ? "lumbre-cuadro-a" : undefined}>
        {A.pixeles.map((p) => (
          <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width={1} height={1} fill={p.color} />
        ))}
      </g>
      {viva && (
        <g className="lumbre-cuadro-b">
          {B.pixeles.map((p) => (
            <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width={1} height={1} fill={p.color} />
          ))}
        </g>
      )}
    </svg>
  );
}

/** Llama + "Lumbre". `size` es el alto de la llama en píxeles; el nombre se ajusta a ella. */
export function LumbreLogo({ size = 28, viva = true, className = "" }: { size?: number; viva?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-end gap-[0.3em] font-pixel leading-none font-semibold text-cozy-paper-light ${className}`} style={{ fontSize: size * 0.95 }}>
      <Llama size={size} viva={viva} />
      <span
        className="pb-[0.04em]"
        style={{ textShadow: `${Math.max(1, Math.round(size / 14))}px ${Math.max(1, Math.round(size / 14))}px 0 var(--color-cozy-wood), ${Math.max(2, Math.round(size / 7))}px ${Math.max(2, Math.round(size / 7))}px 0 var(--color-cozy-frame)` }}
      >
        {MARCA}
      </span>
    </span>
  );
}
