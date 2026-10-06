// La música del Carnaval (VIR-174, VIR-179), toda sintetizada con WebAudio y por la salida de la música del
// mezclador. Dos conjuntos, como en Pasto: la murga (bronces, maderas, tuba, acordeón y la percusión al
// frente, con cortes) y el colectivo andino (quena, zampoña, rondador, cuerdas andinas, violín y percusión).
// El repertorio está en musica-piezas.ts, la parte pura (cómo se escribe y el programa de cada tramo) en
// musica-programa.ts y los instrumentos y la mesa (estéreo y reverberación) en musica-instrumentos.ts.
//
// En el desfile cada grupo (la comparsa de una carroza o una murga) rota su repertorio desde que sale el
// desfile (`sonandoEn`): todos oyen lo mismo en el mismo punto. `BandasDelDesfile` toca el grupo de cada
// conjunto que más se oye (sube y baja con la distancia); `playPieza` toca un trozo para las cinemáticas
// y `escucharPieza` una pieza entera (para la página de escucha).
import { CONJUNTO_DE, type Conjunto, type PiezaId } from "@hyvento/shared";
import { sfxOut } from "../sfx";
import { Mesa, tocar } from "./musica-instrumentos";
import { MEZCLA, realce, Selector } from "./musica-mezcla";
import { duracionDe, PIEZAS_MUSICA, sonandoEn } from "./musica-piezas";
import { corcheaS, humano, programaTramo, tramosDe, type Evento, type TramoListo } from "./musica-programa";

export { duracionDe, PAUSA_S, PIEZAS_MUSICA, sonandoEn } from "./musica-piezas";

type Out = NonNullable<ReturnType<typeof sfxOut>>;

/** Cuánto se programa por adelantado (s): lo justo para que no se corte si un cuadro se demora. */
const AHEAD_S = 0.35;

/**
 * Toca una pieza tramo por tramo: arma el programa de un tramo solo cuando llega a él (así una pieza de tres
 * minutos no se programa de una) y lo va soltando al contexto un poquito por adelantado.
 */
class Reproductor {
  private readonly tramos: TramoListo[];
  private readonly corchea: number;
  private ti = 0;
  private eventos: Evento[] = [];
  private ei = 0;
  done = false;
  /** Lo que caiga antes de este momento (s del contexto) no se toca: ya lo programó la banda de antes. */
  minT = 0;
  /** Hasta dónde se programó (s del contexto). */
  hastaT = 0;

  constructor(
    private readonly id: PiezaId,
    /** El momento (s del contexto) en que empieza la pieza; puede ser antes de ahora (entrar a la mitad). */
    private readonly t0: number,
    /** Hasta qué segundo de la pieza se toca (las cinemáticas tocan un trozo). */
    private readonly hastaS = Infinity,
    desdeTramo = 0,
  ) {
    const p = PIEZAS_MUSICA[id];
    this.tramos = tramosDe(p);
    this.corchea = corcheaS(p);
    this.ti = desdeTramo;
    this.cargar();
  }

  /** El segundo de la pieza en que empieza el tramo `i`. */
  inicioS(i: number) {
    return this.tramos[i]!.inicio * this.corchea;
  }

  private cargar() {
    if (this.ti >= this.tramos.length) {
      this.done = true;
      return;
    }
    this.eventos = programaTramo(PIEZAS_MUSICA[this.id], this.ti);
    this.ei = 0;
  }

  tick(ctx: AudioContext, mesa: Mesa) {
    for (let guard = 0; guard < 400 && !this.done; guard++) {
      if (this.ei >= this.eventos.length) {
        this.ti++;
        this.cargar();
        continue;
      }
      const e = this.eventos[this.ei]!;
      const enS = (this.tramos[this.ti]!.inicio + e.at) * this.corchea;
      const t = this.t0 + enS;
      if (t > ctx.currentTime + AHEAD_S) return;
      if (enS >= this.hastaS) {
        this.done = true;
        return;
      }
      if (t >= ctx.currentTime - 0.05 && t >= this.minT) {
        // Como toca una persona: un pelito antes o después y un pelito más o menos fuerte (el bombo, firme).
        const { dt, dv } = humano(this.ti * 4096 + this.ei);
        const firme = e.inst === "bombo" ? 0.3 : 1;
        tocar(ctx, mesa, { ...e, vol: e.vol * (1 + (dv - 1) * firme) }, Math.max(ctx.currentTime, t + dt * firme), this.corchea);
        this.hastaT = t;
      }
      this.ei++;
    }
  }

  /** Salta al tramo donde va el segundo `enS` (para entrar a la mitad sin programar lo que ya pasó). */
  saltarA(enS: number) {
    while (this.ti + 1 < this.tramos.length && this.inicioS(this.ti + 1) <= enS) this.ti++;
    this.cargar();
  }
}

/** Un grupo sonando dentro de una banda: su pieza, su volumen propio (para el fundido) y su mesa. */
interface Voz {
  grupo: string;
  /** La pieza y cuántas lleva el grupo (`grupo:n`). */
  sonando: string;
  rep: Reproductor | null;
  gain: GainNode;
  mesa: Mesa;
  /** Si se está yendo (fundido de salida): se suelta a esta hora del contexto. */
  soltarEn?: number;
}

/**
 * Una banda que toca un repertorio. Cada cuadro se le dice qué grupo (`clave`), su repertorio, cuánto va del
 * desfile y a qué volumen (0 = no se oye). Si cambia de grupo, el de antes se va apagando mientras el nuevo
 * entra (fundido cruzado) en el punto donde va; dentro del mismo grupo, la pieza siguiente entra después de
 * la pausa, entera.
 */
export class BandaAndina {
  private out: Out | null = null;
  private gain: GainNode | null = null;
  private voces: Voz[] = [];
  /** El compresor y la ganancia de vuelta (se sueltan con la banda). */
  private salida: AudioNode[] = [];
  private silentSince = 0;

  update(fuente: { clave: string; repertorio: readonly PiezaId[]; ms: number } | null, vol: number) {
    if (!fuente || vol <= 0.01) {
      if (this.gain && this.out) this.gain.gain.setTargetAtTime(0, this.out.ctx.currentTime, 0.6);
      if (!this.silentSince) this.silentSince = performance.now();
      // Un rato callada: se suelta.
      if (performance.now() - this.silentSince > 4000) this.stop();
      else this.tick();
      return;
    }
    this.silentSince = 0;
    if (!this.out) {
      const a = sfxOut("music");
      if (!a) return;
      this.out = a;
      this.gain = a.ctx.createGain();
      this.gain.gain.value = 0;
      // Un compresor suave y su ganancia de vuelta: la banda se oye presente (lo bajito sube) sin saturar
      // cuando entran los bronces y la percusión a la vez.
      const comp = a.ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 12;
      comp.ratio.value = 3;
      comp.attack.value = 0.01;
      comp.release.value = 0.25;
      const vuelta = a.ctx.createGain();
      vuelta.gain.value = MEZCLA.ganancia;
      this.gain.connect(comp).connect(vuelta).connect(a.out);
      this.salida = [comp, vuelta];
    }
    const { ctx } = this.out;
    // La distancia cambia suave: así la banda se acerca y se aleja sin saltos.
    this.gain!.gain.setTargetAtTime(vol, ctx.currentTime, 0.35);
    const ahora = sonandoEn(fuente.repertorio, fuente.ms);
    const sonando = ahora ? `${fuente.clave}:${ahora.n}` : "";
    let voz = this.voces.find((v) => v.grupo === fuente.clave && v.soltarEn === undefined);
    if (!voz) {
      // Otro grupo: los que sonaban se van apagando y este entra de a poco.
      for (const v of this.voces) this.soltar(v, ctx);
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(1, ctx.currentTime, MEZCLA.fundidoS);
      g.connect(this.gain!);
      voz = { grupo: fuente.clave, sonando: "", rep: null, gain: g, mesa: new Mesa(ctx, g) };
      this.voces.push(voz);
    }
    if (sonando !== voz.sonando) {
      voz.sonando = sonando;
      // La pieza siguiente del mismo grupo: no se repite lo que la de antes dejó programado.
      const hasta = voz.rep?.hastaT ?? 0;
      voz.rep = null;
      if (ahora) {
        voz.rep = new Reproductor(ahora.pieza, ctx.currentTime + 0.05 - ahora.enS);
        voz.rep.minT = hasta + 1e-3;
        voz.rep.saltarA(ahora.enS);
      }
    }
    this.tick();
  }

  private soltar(v: Voz, ctx: AudioContext) {
    if (v.soltarEn !== undefined) return;
    v.gain.gain.cancelScheduledValues(ctx.currentTime);
    v.gain.gain.setTargetAtTime(0, ctx.currentTime, MEZCLA.fundidoS);
    v.soltarEn = ctx.currentTime + MEZCLA.fundidoS * 5;
  }

  /** Los que se van siguen tocando mientras se apagan (así el cruce no deja un hueco) y luego se sueltan. */
  private tick() {
    if (!this.out) return;
    const { ctx } = this.out;
    this.voces = this.voces.filter((v) => {
      if (v.soltarEn !== undefined && ctx.currentTime > v.soltarEn) {
        v.mesa.cerrar();
        v.gain.disconnect();
        return false;
      }
      v.rep?.tick(ctx, v.mesa);
      return true;
    });
  }

  stop() {
    for (const v of this.voces) {
      v.mesa.cerrar();
      v.gain.disconnect();
    }
    this.voces = [];
    this.gain?.disconnect();
    this.gain = null;
    for (const n of this.salida) n.disconnect();
    this.salida = [];
    this.out = null;
    this.silentSince = 0;
  }
}

/** Un grupo del desfile que suena: su clave, su repertorio y cuánto se oye desde donde estoy. */
export interface FuenteMusica {
  clave: string;
  repertorio: readonly PiezaId[];
  vol: number;
}

/** Cuántas piezas sueltas (cinemáticas, el panel del director) están sonando: el desfile se corre para atrás. */
let solos = 0;

/**
 * La música del desfile: una banda para la murga y otra para el colectivo, cada una con un grupo de su
 * conjunto (el `Selector` no la deja saltar de grupo a cada rato). Si se oyen las dos, la que menos baja
 * (no se tapan del todo: así suena una calle con dos bandas), y mientras suena una cinemática con música,
 * el desfile queda de fondo.
 */
export class BandasDelDesfile {
  private bandas: Record<Conjunto, BandaAndina> = { murga: new BandaAndina(), colectivo: new BandaAndina() };
  private selectores: Record<Conjunto, Selector> = { murga: new Selector(), colectivo: new Selector() };
  private bajo = 1;

  update(fuentes: readonly FuenteMusica[], ms: number) {
    const now = performance.now();
    const elegida: Partial<Record<Conjunto, FuenteMusica>> = {};
    for (const c of ["murga", "colectivo"] as const) {
      const mias = fuentes.filter((f) => f.repertorio[0] && CONJUNTO_DE[f.repertorio[0]] === c);
      const clave = this.selectores[c].elegir(
        mias.map((f) => ({ clave: f.clave, vol: f.vol, enPausa: !sonandoEn(f.repertorio, ms) })),
        now,
      );
      const f = mias.find((x) => x.clave === clave);
      if (f) elegida[c] = f;
    }
    // La cinemática manda: el desfile baja suave mientras suena su música y vuelve igual.
    this.bajo += ((solos > 0 ? MEZCLA.bajoCine : 1) - this.bajo) * 0.05;
    const fuerte = (elegida.murga?.vol ?? 0) >= (elegida.colectivo?.vol ?? 0) ? "murga" : "colectivo";
    for (const c of ["murga", "colectivo"] as const) {
      const f = elegida[c];
      const vol = f ? realce(f.vol) * (c === fuerte ? 1 : MEZCLA.segunda) * this.bajo : 0;
      this.bandas[c].update(f ? { clave: f.clave, repertorio: f.repertorio, ms } : null, vol);
    }
  }

  stop() {
    this.bandas.murga.stop();
    this.bandas.colectivo.stop();
  }
}

/** Toca una pieza desde ahora hasta que termine (o hasta `hastaS`) y devuelve cómo pararla. */
function tocarSola(id: PiezaId, vol: number, desdeTramo: number, hastaS: number): () => void {
  const a = sfxOut("music");
  if (!a) return () => {};
  const { ctx } = a;
  const g = ctx.createGain();
  g.gain.value = vol;
  g.connect(a.out);
  const mesa = new Mesa(ctx, g);
  // Mientras suena, el desfile queda de fondo (una sola vez por pieza, aunque se pare dos veces).
  let suelta = false;
  solos++;
  const soltar = () => {
    if (suelta) return;
    suelta = true;
    solos = Math.max(0, solos - 1);
  };
  const cerrar = () => {
    soltar();
    mesa.cerrar();
    g.disconnect();
  };
  const probe = new Reproductor(id, 0, Infinity, desdeTramo);
  const desdeS = probe.inicioS(desdeTramo);
  const rep = new Reproductor(id, ctx.currentTime + 0.05 - desdeS, desdeS + hastaS, desdeTramo);
  let timer: ReturnType<typeof setInterval> | null = null;
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    soltar();
    setTimeout(cerrar, 2500);
  };
  const tick = () => {
    rep.tick(ctx, mesa);
    if (rep.done) {
      if (timer) clearInterval(timer);
      timer = null;
      soltar();
      // Un trozo se apaga de a poco; la pieza entera ya trae su final.
      if (Number.isFinite(hastaS)) g.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
      setTimeout(cerrar, 4000);
    }
  };
  tick();
  timer = setInterval(tick, 100);
  return stop;
}

/** Toca un trozo de la pieza (unos 16 s, desde su `extracto`), para las cinemáticas. */
let cineSonando: (() => void) | null = null;

export function playPieza(id: PiezaId, vol = 0.8) {
  // Dos cinemáticas seguidas no se montan: la de antes se apaga.
  cineSonando?.();
  cineSonando = tocarSola(id, vol, PIEZAS_MUSICA[id].extracto ?? 0, 16);
}

/** Toca la pieza entera, de principio a fin (para escucharla); devuelve cómo pararla. */
export function escucharPieza(id: PiezaId, vol = 0.8): () => void {
  return tocarSola(id, vol, 0, Infinity);
}

/** Todas las piezas, para la página de escucha: id, nombre, conjunto, si es original, cuánto dura, cómo suena y de dónde sale. */
export const listaParaEscuchar = (): {
  id: PiezaId;
  nombre: string;
  conjunto: Conjunto;
  original: boolean;
  duracionS: number;
  nota: string;
  fuentes: readonly { titulo: string; url: string; dice: string }[];
}[] =>
  (Object.keys(PIEZAS_MUSICA) as PiezaId[]).map((id) => {
    const p = PIEZAS_MUSICA[id];
    return { id, nombre: p.nombre, conjunto: p.conjunto, original: p.original, duracionS: Math.round(duracionDe(id)), nota: p.nota, fuentes: p.fuentes ?? [] };
  });
