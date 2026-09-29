// Íconos del sistema operativo del PC: dibujos planos de 32x32 con borde café, en la paleta cozy.
import { COZY } from "@/lib/cozy";

const INK = COZY.frame;

function Icon({ children, size = 40 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" shapeRendering="crispEdges" aria-hidden>
      {children}
    </svg>
  );
}

export function NotesIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect x="6" y="4" width="20" height="25" fill={COZY.paperDark} stroke={INK} strokeWidth="2" />
      <rect x="6" y="4" width="20" height="5" fill={COZY.red} stroke={INK} strokeWidth="2" />
      <path d="M10 14h12M10 18h12M10 22h8" stroke={INK} strokeWidth="2" />
    </Icon>
  );
}

export function TrashIcon({ size, full }: { size?: number; full: boolean }) {
  return (
    <Icon size={size}>
      {full && (
        <>
          <rect x="11" y="3" width="8" height="9" fill={COZY.paperLight} stroke={INK} strokeWidth="2" transform="rotate(-12 15 7)" />
          <rect x="15" y="4" width="8" height="8" fill={COZY.paperDark} stroke={INK} strokeWidth="2" transform="rotate(10 19 8)" />
        </>
      )}
      <rect x="7" y="10" width="18" height="3" fill={COZY.sky} stroke={INK} strokeWidth="2" />
      <path d="M9 13h14l-2 16H11z" fill={COZY.sky} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M13 16v10M16 16v10M19 16v10" stroke={COZY.paper} strokeWidth="1.5" />
    </Icon>
  );
}

export function CalendarIcon({ size }: { size?: number }) {
  const day = new Date().getDate();
  return (
    <Icon size={size}>
      <rect x="5" y="6" width="22" height="22" fill={COZY.paperLight} stroke={INK} strokeWidth="2" />
      <rect x="5" y="6" width="22" height="7" fill={COZY.green} stroke={INK} strokeWidth="2" />
      <path d="M11 3v6M21 3v6" stroke={INK} strokeWidth="2" />
      <text x="16" y="25" textAnchor="middle" fontSize="10" fontWeight="900" fill={INK} fontFamily="var(--font-cozy), monospace">
        {day}
      </text>
    </Icon>
  );
}

/** Navegador de favoritos: el globo con una estrellita. */
export function BrowserIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="15" cy="15" r="11" fill={COZY.sky} stroke={INK} strokeWidth="2" />
      <path d="M4 15h22M15 4c-5 6-5 16 0 22M15 4c5 6 5 16 0 22" stroke={COZY.paper} strokeWidth="1.5" fill="none" />
      <path
        d="M24 17.5l1.7 4.2 4.5.3-3.5 2.9 1.1 4.4-3.8-2.5-3.8 2.5 1.1-4.4-3.5-2.9 4.5-.3z"
        fill={COZY.gold}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/** Enfoque (Pomodoro): un tomate con las manecillas de un reloj. */
export function TomatoIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="16" cy="18" r="11" fill={COZY.red} stroke={INK} strokeWidth="2" />
      <path d="M9 14h2v-2h2" stroke="#ee7a6a" strokeWidth="2" fill="none" />
      <path d="M16 15v4h4" stroke={COZY.paperLight} strokeWidth="2" fill="none" />
      <path d="M10 8l3 2 3-3 3 3 3-2-2 4h-8z" fill={COZY.green} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 3v4" stroke={INK} strokeWidth="2" />
    </Icon>
  );
}

/** Buscaminas: una mina sobre una casilla de papel. */
export function MineIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect x="3" y="3" width="26" height="26" fill={COZY.paperLight} stroke={INK} strokeWidth="2" />
      <path d="M16 6v20M6 16h20M9 9l14 14M23 9L9 23" stroke={INK} strokeWidth="2" />
      <circle cx="16" cy="16" r="7" fill={COZY.void} stroke={INK} strokeWidth="2" />
      <rect x="12" y="12" width="3" height="3" fill={COZY.paperLight} />
    </Icon>
  );
}

export function MusicIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M12 23V8l13-3v15" fill="none" stroke={INK} strokeWidth="2" />
      <circle cx="9" cy="23" r="4" fill={COZY.red} stroke={INK} strokeWidth="2" />
      <circle cx="22" cy="20" r="4" fill={COZY.red} stroke={INK} strokeWidth="2" />
    </Icon>
  );
}

export function WhiteboardIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect x="4" y="5" width="24" height="17" fill={COZY.paperLight} stroke={INK} strokeWidth="2" />
      <path d="M8 11h10M8 15h14" stroke={COZY.woodLight} strokeWidth="2" />
      <path d="M10 22l-3 7M22 22l3 7" stroke={INK} strokeWidth="2" />
    </Icon>
  );
}

export function MailIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect x="4" y="8" width="24" height="17" fill={COZY.wood} stroke={INK} strokeWidth="2" />
      <path d="M4 8l12 10L28 8" fill="none" stroke={COZY.paper} strokeWidth="2" />
    </Icon>
  );
}

export function PowerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" aria-hidden>
      <path d="M12 3v8" />
      <path d="M6.3 6.8a8 8 0 1 0 11.4 0" />
    </svg>
  );
}

/** Pintura: una paleta de madera con manchas de color y un pincel. */
export function PaintIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M5 16c0-7 6-11 12-11s10 4 10 9c0 4-3 5-6 5-2 0-3 1-3 3 0 3-2 5-5 5-5 0-8-5-8-11z" fill={COZY.woodLight} stroke={INK} strokeWidth="2" />
      <rect x="9" y="11" width="4" height="4" fill={COZY.red} />
      <rect x="15" y="8" width="4" height="4" fill={COZY.gold} />
      <rect x="21" y="11" width="4" height="4" fill={COZY.sky} />
      <rect x="9" y="18" width="4" height="4" fill={COZY.green} />
      <path d="M29 3L17 17" stroke={INK} strokeWidth="3" />
      <path d="M29 3L20 13.5" stroke={COZY.paperLight} strokeWidth="1" />
    </Icon>
  );
}
