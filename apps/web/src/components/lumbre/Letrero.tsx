"use client";

// "Tu equipo, tu nombre": quien visita escribe el nombre de su equipo y lo ve en el letrero de la
// cabaña, en el menú del HUD y en la estación del bus. Es solo una vista previa: el nombre vive en el
// estado de este componente y no se manda ni se guarda en ningún lado.
import { useId, useMemo, useState } from "react";
import { PixelIcon } from "../Cozy";
import { LETRERO_MAX, NOMBRE_EJEMPLO, nombreDeLetrero, pixelesDeLetrero } from "./nombre-letrero";

/** Colores del letrero del porche (tabla oscura, marco claro, letras doradas). */
const C = {
  marco: "#b3571a",
  marcoLuz: "#e0923e",
  tabla: "#3a1f16",
  tablaVeta: "#4a2a1c",
  letra: "#ffcf4a",
  letraSombra: "#8a4b1c",
  cadena: "#6e5a4a",
};

function TablaPixel({ texto }: { texto: string }) {
  const { w, pixeles } = pixelesDeLetrero(texto);
  // Tabla: 3 de margen a cada lado de las letras; 2 de marco y 2 de aire arriba y abajo.
  const tw = Math.max(w, 11) + 8;
  const th = 5 + 8;
  const ox = Math.round((tw - w) / 2);
  const oy = 4;
  const alto = th + 5;
  return (
    <svg viewBox={`0 0 ${tw} ${alto}`} shapeRendering="crispEdges" className="h-auto w-full" role="img" aria-label={`Letrero de madera que dice ${texto}`}>
      {/* Cadenas de donde cuelga. */}
      {[3, tw - 4].map((cx) => (
        <g key={cx}>
          {[0, 2, 4].map((cy) => (
            <rect key={cy} x={cx} y={cy} width={1} height={1} fill={C.cadena} />
          ))}
        </g>
      ))}
      <g transform="translate(0 5)">
        <rect x={0} y={0} width={tw} height={th} fill={C.marco} />
        <rect x={1} y={1} width={tw - 2} height={1} fill={C.marcoLuz} />
        <rect x={1} y={1} width={1} height={th - 2} fill={C.marcoLuz} />
        <rect x={2} y={2} width={tw - 4} height={th - 4} fill={C.tabla} />
        {/* Vetas de la madera arriba y abajo de las letras (entre ellas se leerían como rayas). */}
        {[3, 10].map((vy, i) => (
          <rect key={vy} x={3 + i * 5} y={vy} width={Math.max(3, tw - 12 - i * 6)} height={1} fill={C.tablaVeta} />
        ))}
        {pixeles.map((p) => (
          <rect key={`s${p.x}-${p.y}`} x={ox + p.x + 0.5} y={oy + p.y + 0.5} width={1} height={1} fill={C.letraSombra} />
        ))}
        {pixeles.map((p) => (
          <rect key={`l${p.x}-${p.y}`} x={ox + p.x} y={oy + p.y} width={1} height={1} fill={C.letra} />
        ))}
      </g>
    </svg>
  );
}

export function Letrero() {
  const id = useId();
  const [nombre, setNombre] = useState("");
  const texto = useMemo(() => nombreDeLetrero(nombre) || nombreDeLetrero(NOMBRE_EJEMPLO), [nombre]);
  // Como se escribió (con tildes y minúsculas), para el HUD y el título de la pestaña.
  const bonito = nombre.trim().replace(/\s+/g, " ").slice(0, LETRERO_MAX) || NOMBRE_EJEMPLO.replace("Fogon", "Fogón");

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-14">
      <div className="flex flex-col gap-5">
        <label htmlFor={id} className="text-[17px] font-semibold text-cozy-ink">
          Escribe el nombre de tu equipo
        </label>
        <input
          id={id}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={LETRERO_MAX * 2}
          placeholder={NOMBRE_EJEMPLO.replace("Fogon", "Fogón")}
          autoComplete="off"
          spellCheck={false}
          className="cozy-input w-full max-w-md px-4 py-3 text-[20px]"
          aria-describedby={`${id}-nota`}
        />
        <p id={`${id}-nota`} className="flex items-start gap-2 text-[15px] leading-snug text-cozy-ink-soft">
          <PixelIcon name="lock" size={14} className="mt-0.5 shrink-0" />
          Es solo una vista previa en tu navegador: no se guarda ni se manda a ningún lado.
        </p>
        <ul className="mt-2 flex flex-col gap-3 text-[16px] leading-snug text-cozy-ink">
          <li className="flex items-center gap-3">
            <PixelIcon name="cabin" size={18} color="var(--color-cozy-wood)" className="shrink-0" />
            En el letrero del porche de la cabaña
          </li>
          <li className="flex items-center gap-3">
            <PixelIcon name="menu" size={18} color="var(--color-cozy-wood)" className="shrink-0" />
            En el menú de arriba, para que nadie se pierda
          </li>
          <li className="flex items-center gap-3">
            <PixelIcon name="steps" size={18} color="var(--color-cozy-wood)" className="shrink-0" />
            En la estación del bus a la entrada del jardín
          </li>
        </ul>
      </div>

      {/* La vista previa: el letrero colgando sobre el pasto, con el HUD y la estación debajo. */}
      <div className="lumbre-pasto relative border-4 border-cozy-frame px-5 pt-6 pb-5 shadow-[6px_6px_0_rgb(20_10_24/0.5)] sm:px-10 sm:pt-8" aria-live="polite">
        <div className="mx-auto w-[min(100%,560px)]">
          <TablaPixel texto={texto} />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <span className="cozy-chip flex max-w-full items-center gap-2 px-3 py-1.5 text-[15px] leading-none">
            <PixelIcon name="menu" size={14} />
            <span className="truncate">{bonito}</span>
            <PixelIcon name="chevron" size={12} />
          </span>
          <span className="flex max-w-full items-center gap-2 border-2 border-[#2e4a1c] bg-[#bfe34a] px-3 py-1.5 text-[13px] leading-none font-semibold text-[#1f2a10] uppercase shadow-[2px_2px_0_rgb(20_10_24/0.4)]">
            <span className="truncate">Estación {texto}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
