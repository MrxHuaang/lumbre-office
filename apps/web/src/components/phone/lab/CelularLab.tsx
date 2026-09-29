"use client";

// Laboratorio del celular (VIR-126): el celular de verdad (components/phone) sin cabaña, sin sesión y sin
// servidor. Llena el store de la oficina con gente, mensajes y clima de mentira, y el panel de la derecha
// los mueve a mano: alguien escribe, alguien se conecta, llueve, cambia tu estado. Lo que se manda desde
// Mensajes no sale a ningún lado: vuelve como un mensaje propio (y, si se quiere, alguien responde).
import { WEATHERS, WEATHER_TEXT, type ChatEvent, type ChatScope, type PresenceStatus, type Weather } from "@hyvento/shared";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { setOfflineChat } from "@/game/network";
import { SKINS, usePhoneStore, WALLPAPERS } from "@/game/phone/state";
import { useOfficeStore, type PlayerInfo, type Profile } from "@/game/store";
import { PhoneButton } from "../PhoneButton";
import { MessageToasts } from "../PhoneToasts";

// Como en la oficina: el celular se descarga recién al sacarlo.
const Phone = dynamic(() => import("../Phone").then((m) => m.Phone), { ssr: false });

const PERFIL: Profile = { name: "Tú (laboratorio)", avatar: "ada", look: null };
const YO = "s-yo";

const persona = (sessionId: string, name: string, place: string, status: PresenceStatus): PlayerInfo => ({
  sessionId,
  userId: `u-${sessionId}`,
  name,
  avatar: "bruno",
  area: "planta-baja",
  zoneId: place,
  place,
  status,
  points: 120,
  held: "",
  heldLeft: "",
  focus: "",
  focusEndsAt: 0,
  focusPreset: "",
  call: "",
  callWith: "",
});

const GENTE: PlayerInfo[] = [
  { ...persona(YO, PERFIL.name, "cafeteria", "available"), userId: "u-yo", points: 1240 },
  persona("s-ana", "Ana", "office-1", "available"),
  persona("s-beto", "Beto", "cafeteria", "busy"),
  persona("s-caro", "Caro", "salon", "away"),
  persona("s-dani", "Dani", "office-3", "dnd"),
];

const FRASES = ["¿Almorzamos?", "Ya casi llego, voy en el Megabús", "Te dejé un tinto en la oficina", "¿Vas a la reunión de las 3?", "Jajaja qué pasó en el casino", "@Tú mira el atardecer desde el observatorio"];

let seq = 0;
const msg = (from: PlayerInfo | null, text: string, scope: ChatScope): ChatEvent => ({
  id: `lab-${Date.now()}-${seq++}`,
  fromId: from?.userId ?? "",
  fromName: from?.name ?? "",
  text,
  scope,
  zoneId: null,
  ts: Date.now(),
});

/** El mundo de mentira: la gente, el lugar y un par de mensajes para arrancar. */
function sembrar() {
  useOfficeStore.setState({
    sessionId: YO,
    connection: "connected",
    players: Object.fromEntries(GENTE.map((p) => [p.sessionId, p])),
    place: "cafeteria",
    zone: { id: "cafeteria", name: "Cafetería", type: "cafe", isolated: false },
    zoneNames: { cafeteria: "Cafetería", salon: "Salón", "office-1": "Oficina de Ana", "office-3": "Oficina de Dani" },
    weather: "despejado",
    messages: [msg(GENTE[1]!, "¡Buenas! ¿Cómo va todo?", "global"), msg(GENTE[2]!, "Aquí en la cafetería", "proximity")],
  });
}

export function CelularLab() {
  const mounted = usePhoneStore((s) => s.mounted);
  const skin = usePhoneStore((s) => s.skin);
  const wallpaper = usePhoneStore((s) => s.wallpaper);
  const weather = useOfficeStore((s) => s.weather);
  const night = useOfficeStore((s) => s.night);
  const players = useOfficeStore((s) => s.players);
  const [responden, setResponden] = useState(true);
  const [registro, setRegistro] = useState<string[]>([]);
  const respondenRef = useRef(responden);
  respondenRef.current = responden;

  const anotar = (linea: string) => setRegistro((r) => [`${new Date().toLocaleTimeString("es-CO")}  ${linea}`, ...r].slice(0, 30));
  const llega = (de: PlayerInfo, text: string, scope: ChatScope) => {
    useOfficeStore.getState().addMessages([msg(de, text, scope)]);
    anotar(`← ${de.name} (${scope === "global" ? "Global" : "Cerca"}): ${text}`);
  };

  useEffect(() => {
    sembrar();
    // Lo que se manda desde Mensajes vuelve como propio; si está marcado, alguien contesta a los 2 s.
    setOfflineChat((text, scope) => {
      useOfficeStore.getState().addMessages([msg(GENTE[0]!, text, scope)]);
      anotar(`→ enviado (${scope === "global" ? "Global" : "Cerca"}): ${text}`);
      if (respondenRef.current) window.setTimeout(() => llega(GENTE[1]!, `Recibido: "${text.slice(0, 40)}"`, scope), 2000);
    });
    return () => setOfflineChat(null);
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estadoDe = (p: PlayerInfo, status: PresenceStatus) =>
    useOfficeStore.setState((s) => ({ players: { ...s.players, [p.sessionId]: { ...s.players[p.sessionId]!, status } } }));
  const conectar = (p: PlayerInfo, on: boolean) =>
    useOfficeStore.setState((s) => {
      const next = { ...s.players };
      if (on) next[p.sessionId] = p;
      else delete next[p.sessionId];
      return { players: next };
    });

  return (
    <main className="relative min-h-full overflow-hidden font-pixel text-cozy-ink" style={{ background: night ? "#161320" : "#6d8f5a" }}>
      {/* Arriba a la izquierda, el botón del HUD (con el contador) y arriba a la derecha los avisos, como en la oficina. */}
      <div className="absolute top-3 left-3 z-10">
        <PhoneButton />
      </div>
      <div className="pointer-events-none absolute top-3 right-3 z-10 flex w-[min(270px,calc(100%-1.5rem))] flex-col items-end gap-2 md:right-[calc(min(420px,45vw)+1.5rem)]">
        <MessageToasts />
      </div>
      {mounted && <Phone profile={PERFIL} />}

      <section className="cozy-panel absolute top-3 right-3 bottom-3 z-20 flex w-[min(420px,45vw)] min-w-0 flex-col gap-4 overflow-y-auto px-5 py-4 text-[14px] max-md:hidden" aria-label="Panel de pruebas">
        <header>
          <h1 className="text-[22px] leading-none">Laboratorio del celular</h1>
          <p className="mt-1 text-[12px] text-cozy-ink-soft">
            Solo en desarrollo, con datos de mentira. <Kbd>C</Kbd> saca o guarda el celular, <Kbd>Enter</Kbd> lo abre en Mensajes. Adentro: flechas, <Kbd>Enter</Kbd>, <Kbd>Esc</Kbd> y los números
            (multi-toque).
          </p>
        </header>

        <Grupo titulo="Mensajes que llegan">
          <div className="flex flex-wrap gap-1.5">
            {GENTE.slice(1, 4).map((p) => (
              <button key={p.sessionId} type="button" className="cozy-btn px-2 py-1" onClick={() => llega(p, FRASES[Math.floor(Math.random() * FRASES.length)] ?? "Hola", "proximity")}>
                {p.name} (cerca)
              </button>
            ))}
            <button type="button" className="cozy-btn px-2 py-1" onClick={() => llega(GENTE[4]!, "Anuncio para toda la cabaña", "global")}>
              Dani (global)
            </button>
            <button type="button" className="cozy-btn px-2 py-1" onClick={() => llega(GENTE[1]!, `@${PERFIL.name.split(" ")[0]} te necesito un momento`, "proximity")}>
              Te mencionan
            </button>
          </div>
          <Check checked={responden} onChange={setResponden}>
            Cuando mando algo, Ana responde a los 2 s
          </Check>
          <button type="button" className="cozy-btn self-start px-2 py-1" onClick={() => useOfficeStore.setState({ messages: [] })}>
            Borrar el chat
          </button>
        </Grupo>

        <Grupo titulo="Contactos">
          <ul className="flex flex-col gap-1.5">
            {GENTE.slice(1).map((p) => {
              const online = players[p.sessionId];
              return (
                <li key={p.sessionId} className="flex items-center gap-2">
                  <span className="w-12">{p.name}</span>
                  <select
                    className="cozy-input px-1 py-0.5 text-[13px]"
                    value={online?.status ?? p.status}
                    disabled={!online}
                    onChange={(e) => estadoDe(p, e.target.value as PresenceStatus)}
                  >
                    {(["available", "busy", "dnd", "away", "meeting"] as const).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Check checked={Boolean(online)} onChange={(v) => conectar(p, v)}>
                    conectado
                  </Check>
                </li>
              );
            })}
          </ul>
        </Grupo>

        <Grupo titulo="Afuera">
          <label className="flex items-center gap-2">
            Clima
            <select className="cozy-input px-2 py-1" value={weather} onChange={(e) => useOfficeStore.setState({ weather: e.target.value as Weather })}>
              {WEATHERS.map((w) => (
                <option key={w} value={w}>
                  {WEATHER_TEXT[w]}
                </option>
              ))}
            </select>
          </label>
          <Check checked={night} onChange={(v) => useOfficeStore.setState({ night: v })}>
            De noche
          </Check>
        </Grupo>

        <Grupo titulo="El celular">
          <div className="flex flex-wrap items-center gap-3">
            <Elegir label="Carcasa" value={skin} options={SKINS} onChange={(v) => usePhoneStore.getState().setPrefs({ skin: v })} />
            <Elegir label="Fondo" value={wallpaper} options={WALLPAPERS} onChange={(v) => usePhoneStore.getState().setPrefs({ wallpaper: v })} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="cozy-btn px-2 py-1" onClick={() => usePhoneStore.getState().buzz()}>
              Vibrar
            </button>
            <button type="button" className="cozy-btn px-2 py-1" onClick={() => usePhoneStore.getState().setRinging(!usePhoneStore.getState().ringing)}>
              Alarma sonando (sí / no)
            </button>
          </div>
        </Grupo>

        <Grupo titulo="Registro">
          <ol className="cozy-scroll max-h-40 overflow-y-auto bg-cozy-paper-light px-2 py-1 text-[12px] leading-snug">
            {registro.length ? registro.map((l, i) => <li key={i}>{l}</li>) : <li className="text-cozy-placeholder">Todavía nada.</li>}
          </ol>
          <button type="button" className="cozy-btn self-start px-2 py-1" onClick={() => (sembrar(), setRegistro([]))}>
            Reiniciar el mundo
          </button>
        </Grupo>
      </section>
    </main>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[15px] font-semibold">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-[13px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

function Elegir<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; name: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="flex items-center gap-2">
      {label}
      <select className="cozy-input px-2 py-1" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="cozy-kbd px-1">{children}</kbd>;
}
