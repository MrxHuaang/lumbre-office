// Los instrumentos del Carnaval, sintetizados con WebAudio (ninguna grabación).
//
// La murga: trompeta, saxo, trombón y tuba (dientes de sierra con un filtro que se abre al soplar y vibrato
// que entra tarde), clarinete (solo armónicos impares, como un tubo cerrado), flauta traversa (seno con su
// soplo), acordeón (lengüetas de pulso desafinadas un pelito: el trémolo) y la percusión: bombo, tambora,
// redoblante, caja vallenata, platillo, timbales, güiro, guasá, campana y cencerro.
//
// El colectivo andino: quena, zampoña, rondador (dos cañas a la vez), las cuerdas punteadas (requinto,
// bandola con su trémolo, tiple con sus órdenes en octava y la guitarra), el violín (arco con vibrato) y la
// percusión: bombo, shekere, maracas y chajchas.
//
// Las cuerdas punteadas son Karplus-Strong: una cuerda se calcula una sola vez por instrumento y por cada tres
// semitonos (se guarda) y cada nota la afina con la velocidad de lectura. Todo pasa por una mesa (`Mesa`):
// un canal por instrumento con su lugar en el estéreo y un poco de reverberación (la sala se arma una vez por
// contexto). Cada nota suelta sus nodos al terminar.
import { hz, type Evento, type Golpe, type Instrumento } from "./musica-programa";

type Voz = Instrumento | Golpe;

/** Cuando termine `src`, desconecta lo que quedó colgando (así los nodos de una nota no se quedan en la mesa). */
function soltar(src: AudioScheduledSourceNode, ...nodos: AudioNode[]) {
  src.onended = () => {
    for (const n of nodos) n.disconnect();
  };
}

const RUIDOS = new WeakMap<BaseAudioContext, AudioBuffer>();
/** Dos segundos de ruido por contexto, que cada golpe lee desde un punto al azar. */
function ruido(ctx: BaseAudioContext): AudioBuffer {
  let b = RUIDOS.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    RUIDOS.set(ctx, b);
  }
  return b;
}

function noise(ctx: AudioContext, out: AudioNode, t: number, len: number, type: BiquadFilterType, f: number, q: number, vol: number, attack = 0.002) {
  const src = ctx.createBufferSource();
  src.buffer = ruido(ctx);
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = f;
  filt.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(filt).connect(g).connect(out);
  src.start(t, Math.random() * Math.max(0, 1.9 - len), len + 0.05);
  soltar(src, src, filt, g);
  return g;
}

function env(g: GainNode, t: number, peak: number, attack: number, len: number, release = 0.06) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + Math.max(attack, len - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.02);
}

/** Vibrato que entra de a poco (solo en las notas largas). */
function vibrato(ctx: AudioContext, target: AudioParam, t: number, f: number, len: number, rate: number, depth: number, delay: number) {
  if (len < delay + 0.1) return null;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate;
  const d = ctx.createGain();
  d.gain.setValueAtTime(0, t + delay);
  d.gain.linearRampToValueAtTime(f * depth, t + delay + 0.2);
  lfo.connect(d).connect(target);
  lfo.start(t);
  lfo.stop(t + len + 0.1);
  soltar(lfo, lfo, d);
  return lfo;
}

// ---------- La mesa: estéreo y reverberación ----------

const SALAS = new WeakMap<BaseAudioContext, AudioBuffer>();
/**
 * La sala (la respuesta de la reverberación): ruido estéreo que se apaga en 1,4 s y se oscurece al apagarse,
 * con un pelito de espera antes (la primera pared). Se arma una vez por contexto.
 */
function sala(ctx: BaseAudioContext): AudioBuffer {
  let b = SALAS.get(ctx);
  if (!b) {
    const sr = ctx.sampleRate;
    const largo = Math.floor(sr * 1.4);
    const espera = Math.floor(sr * 0.012);
    b = ctx.createBuffer(2, largo, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = espera; i < largo; i++) {
        const x = (i - espera) / (largo - espera);
        // El filtro se cierra con el tiempo: la cola es más oscura que el comienzo.
        const k = 0.55 - 0.45 * x;
        lp += k * (Math.random() * 2 - 1 - lp);
        d[i] = lp * (1 - x) ** 2.4;
      }
    }
    SALAS.set(ctx, b);
  }
  return b;
}

/** El lugar de cada instrumento en el estéreo (-1 izquierda, 1 derecha) y cuánto manda a la reverberación. */
const PUESTO: Record<Voz, readonly [number, number]> = {
  trompeta: [-0.12, 0.22],
  saxo: [0.25, 0.22],
  trombon: [0.35, 0.18],
  tuba: [0, 0.08],
  acordeon: [-0.35, 0.15],
  clarinete: [-0.3, 0.25],
  flauta: [0.3, 0.28],
  quena: [0, 0.3],
  zampona: [-0.3, 0.28],
  rondador: [0.32, 0.25],
  requinto: [0.4, 0.18],
  bandola: [0.3, 0.2],
  violin: [-0.22, 0.3],
  tiple: [-0.45, 0.15],
  guitarra: [0.45, 0.12],
  bombo: [0, 0.05],
  redoblante: [0.1, 0.12],
  platillo: [-0.25, 0.15],
  timbal: [0.3, 0.1],
  timbalBajo: [0.38, 0.1],
  guiro: [0.5, 0.08],
  guiroLargo: [0.5, 0.08],
  guasa: [-0.5, 0.08],
  campana: [0.42, 0.12],
  tambora: [-0.12, 0.08],
  caja: [0.2, 0.1],
  cencerro: [0.45, 0.12],
  shekere: [-0.4, 0.1],
  maracas: [0.55, 0.1],
  chajchas: [-0.55, 0.1],
};

/**
 * La mesa de una banda: un canal por instrumento (con su lugar en el estéreo y su envío a la sala) que llega
 * a `destino`. Los canales se arman la primera vez que suena cada instrumento; `cerrar` lo suelta todo.
 */
export class Mesa {
  private readonly canales = new Map<Voz, AudioNode>();
  private readonly envio: GainNode;
  private readonly rev: ConvolverNode;
  private readonly vuelta: GainNode;

  constructor(
    readonly ctx: AudioContext,
    private readonly destino: AudioNode,
  ) {
    this.envio = ctx.createGain();
    this.rev = ctx.createConvolver();
    this.rev.buffer = sala(ctx);
    this.vuelta = ctx.createGain();
    this.vuelta.gain.value = 0.9;
    this.envio.connect(this.rev).connect(this.vuelta).connect(destino);
  }

  /** El canal de un instrumento. */
  salida(v: Voz): AudioNode {
    let c = this.canales.get(v);
    if (!c) {
      const [pan, rev] = PUESTO[v];
      const g = this.ctx.createGain();
      if (typeof this.ctx.createStereoPanner === "function") {
        const p = this.ctx.createStereoPanner();
        p.pan.value = pan;
        g.connect(p).connect(this.destino);
      } else g.connect(this.destino);
      const s = this.ctx.createGain();
      s.gain.value = rev;
      g.connect(s).connect(this.envio);
      this.canales.set(v, (c = g));
    }
    return c;
  }

  cerrar() {
    for (const c of this.canales.values()) c.disconnect();
    this.canales.clear();
    this.envio.disconnect();
    this.rev.disconnect();
    this.vuelta.disconnect();
  }
}

// ---------- Bronces ----------

/** Un bronce: dos dientes de sierra, el filtro que se abre con el soplo y se cierra un poco al sostener. */
function bronce(ctx: AudioContext, out: AudioNode, t: number, f: number, len: number, vol: number, brillo: number, ataque: number, vib: number, voces = 2) {
  const g = ctx.createGain();
  env(g, t, vol, ataque, len);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(f * 1.2, t);
  lp.frequency.linearRampToValueAtTime(f * brillo, t + ataque + 0.03);
  lp.frequency.exponentialRampToValueAtTime(f * brillo * 0.65, t + Math.max(ataque + 0.05, len));
  lp.connect(g).connect(out);
  let ultimo: OscillatorNode | null = null;
  for (const det of voces === 2 ? [-4, 5] : [0]) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.detune.value = det;
    // El bronce entra un pelito abajo y sube (el labio).
    o.frequency.setValueAtTime(f * 0.985, t);
    o.frequency.exponentialRampToValueAtTime(f, t + ataque + 0.02);
    vibrato(ctx, o.frequency, t, f, len, 5.6, vib, 0.22);
    o.connect(lp);
    o.start(t);
    o.stop(t + len + 0.1);
    ultimo = o;
  }
  if (ultimo) soltar(ultimo, lp, g);
}

/** La tuba: un seno grave con un diente de sierra muy filtrado encima (el "pum" redondo del bajo). */
function tuba(ctx: AudioContext, out: AudioNode, t: number, f: number, len: number, vol: number) {
  const g = ctx.createGain();
  env(g, t, vol, 0.035, len, 0.08);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(f * 2, t);
  lp.frequency.linearRampToValueAtTime(f * 4, t + 0.05);
  lp.frequency.exponentialRampToValueAtTime(f * 2.5, t + Math.max(0.1, len));
  lp.connect(g).connect(out);
  const s = ctx.createOscillator();
  s.frequency.value = f;
  const saw = ctx.createOscillator();
  saw.type = "sawtooth";
  saw.frequency.value = f;
  const sg = ctx.createGain();
  sg.gain.value = 0.45;
  s.connect(lp);
  saw.connect(sg).connect(lp);
  for (const o of [s, saw]) {
    o.start(t);
    o.stop(t + len + 0.1);
  }
  soltar(saw, s, saw, sg, lp, g);
}

// ---------- Maderas ----------

const ONDAS = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
function onda(ctx: BaseAudioContext, clave: string, armonicos: (k: number) => number, n = 24): PeriodicWave {
  let m = ONDAS.get(ctx);
  if (!m) ONDAS.set(ctx, (m = new Map()));
  let w = m.get(clave);
  if (!w) {
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = armonicos(k);
    w = ctx.createPeriodicWave(re, im);
    m.set(clave, w);
  }
  return w;
}

/** El clarinete: casi solo armónicos impares (un tubo cerrado), con el registro grave más oscuro. */
function clarinete(ctx: AudioContext, out: AudioNode, t: number, f: number, len: number, vol: number) {
  const o = ctx.createOscillator();
  o.setPeriodicWave(onda(ctx, "clarinete", (k) => (k % 2 ? 1 / k : 0.04 / k)));
  o.frequency.setValueAtTime(f * 0.992, t);
  o.frequency.linearRampToValueAtTime(f, t + 0.05);
  vibrato(ctx, o.frequency, t, f, len, 5, 0.004, 0.3);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = Math.min(5000, f * 6);
  const g = ctx.createGain();
  env(g, t, vol, 0.03, len);
  o.connect(lp).connect(g).connect(out);
  o.start(t);
  o.stop(t + len + 0.1);
  soltar(o, o, lp, g);
  noise(ctx, out, t, Math.min(len, 0.08), "bandpass", f * 3, 3, vol * 0.12, 0.01);
}

// ---------- Acordeón ----------

/** Una onda de pulso angosta (la lengüeta), de 30%. */
function pulso(ctx: AudioContext): PeriodicWave {
  const d = 0.3;
  let m = ONDAS.get(ctx);
  if (!m) ONDAS.set(ctx, (m = new Map()));
  let w = m.get("pulso");
  if (!w) {
    const n = 24;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      re[k] = Math.sin(2 * Math.PI * k * d) / (k * Math.PI);
      im[k] = (1 - Math.cos(2 * Math.PI * k * d)) / (k * Math.PI);
    }
    w = ctx.createPeriodicWave(re, im);
    m.set("pulso", w);
  }
  return w;
}

/** El acordeón: por cada nota, tres lengüetas (una afinada, una arriba y otra abajo: el trémolo). */
function acordeon(ctx: AudioContext, out: AudioNode, t: number, fs: number[], len: number, vol: number) {
  const g = ctx.createGain();
  env(g, t, vol, 0.018, len, 0.05);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3200;
  lp.connect(g).connect(out);
  let ultimo: OscillatorNode | null = null;
  for (const f of fs) {
    // Las notas del acompañamiento van con dos lengüetas (alcanza para el trémolo y pesa menos).
    for (const det of fs.length > 2 ? [6, -6] : [0, 9, -8]) {
      const o = ctx.createOscillator();
      o.setPeriodicWave(pulso(ctx));
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + len + 0.1);
      ultimo = o;
    }
  }
  if (ultimo) soltar(ultimo, lp, g);
}

// ---------- Vientos andinos y la flauta ----------

/** Una caña, una quena o la flauta: seno con un armónico suave, vibrato (si hay) y el soplo filtrado. */
function soplo(ctx: AudioContext, out: AudioNode, t: number, f: number, len: number, vol: number, aire: number, vib: number, armonico: number, vibRate = 5.4) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  if (len > 0.35) {
    // Las notas largas entran un pelito abajo y suben (como sopla un quenista).
    osc.frequency.setValueAtTime(f * 0.982, t);
    osc.frequency.linearRampToValueAtTime(f, t + 0.07);
  } else osc.frequency.setValueAtTime(f, t);
  if (vib) vibrato(ctx, osc.frequency, t, f, len, vibRate, vib, 0.12);
  const over = ctx.createOscillator();
  over.type = "triangle";
  over.frequency.value = f * 2;
  const og = ctx.createGain();
  og.gain.value = armonico;
  over.connect(og);
  const g = ctx.createGain();
  env(g, t, vol, 0.04, len);
  osc.connect(g);
  og.connect(g);
  g.connect(out);
  for (const o of [osc, over]) {
    o.start(t);
    o.stop(t + len + 0.1);
  }
  soltar(over, osc, over, og, g);
  noise(ctx, out, t, Math.min(len, 0.22), "bandpass", f * 1.5, 2.5, vol * aire, 0.03);
}

// ---------- Violín ----------

/** El violín: diente de sierra con el cuerpo (dos resonancias), el arco que entra suave y vibrato. */
function violin(ctx: AudioContext, out: AudioNode, t: number, f: number, len: number, vol: number) {
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = f;
  vibrato(ctx, o.frequency, t, f, len, 5.8, 0.006, 0.15);
  const cuerpo = ctx.createBiquadFilter();
  cuerpo.type = "peaking";
  cuerpo.frequency.value = 2800;
  cuerpo.Q.value = 1.4;
  cuerpo.gain.value = 6;
  const madera = ctx.createBiquadFilter();
  madera.type = "peaking";
  madera.frequency.value = 450;
  madera.Q.value = 1.2;
  madera.gain.value = 4;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 6500;
  const g = ctx.createGain();
  env(g, t, vol, Math.min(0.09, len * 0.3), len, 0.09);
  o.connect(madera).connect(cuerpo).connect(lp).connect(g).connect(out);
  o.start(t);
  o.stop(t + len + 0.12);
  soltar(o, o, madera, cuerpo, lp, g);
  // El roce del arco al empezar.
  noise(ctx, out, t, Math.min(len, 0.12), "bandpass", 3500, 1.5, vol * 0.15, 0.02);
}

// ---------- Cuerdas punteadas (Karplus-Strong) ----------

type Punteada = "tiple" | "requinto" | "bandola" | "guitarra";
/** Cuánto suena, qué tan brillante es el punteo (0 a 1) y cuánto se apaga en cada vuelta de la cuerda. */
const CUERDA: Record<Punteada, { s: number; brillo: number; decae: number }> = {
  guitarra: { s: 1.5, brillo: 0.45, decae: 0.997 }, // nailon: redonda y larga
  tiple: { s: 1.1, brillo: 0.85, decae: 0.995 }, // metálicas: brillante
  requinto: { s: 1, brillo: 0.8, decae: 0.995 },
  bandola: { s: 0.8, brillo: 0.95, decae: 0.993 }, // con plumilla
};
const SR_CUERDA = 24000;
const CUERDAS = new WeakMap<BaseAudioContext, Map<string, { buf: AudioBuffer; f0: number }>>();

/** La cuerda de `tipo` cerca de la nota `m` (se calcula una vez cada tres semitonos y se guarda). */
function cuerda(ctx: BaseAudioContext, tipo: Punteada, m: number): { buf: AudioBuffer; f0: number } {
  const base = Math.round(m / 3) * 3;
  let cache = CUERDAS.get(ctx);
  if (!cache) CUERDAS.set(ctx, (cache = new Map()));
  const clave = `${tipo}:${base}`;
  let c = cache.get(clave);
  if (!c) {
    const { s, brillo, decae } = CUERDA[tipo];
    const N = Math.max(2, Math.round(SR_CUERDA / hz(base)));
    const largo = Math.floor(SR_CUERDA * s);
    const buf = ctx.createBuffer(1, largo, SR_CUERDA);
    const d = buf.getChannelData(0);
    // El punteo: ruido pasado por un filtro (más o menos brillante), sin corriente continua.
    let lp = 0;
    let media = 0;
    for (let i = 0; i < N; i++) {
      lp += brillo * (Math.random() * 2 - 1 - lp);
      d[i] = lp;
      media += lp / N;
    }
    for (let i = 0; i < N; i++) d[i] = d[i]! - media;
    // La cuerda: cada vuelta promedia dos muestras vecinas y se apaga un poco.
    for (let i = N; i < largo; i++) d[i] = decae * 0.5 * (d[i - N]! + d[i - N - 1 < 0 ? 0 : i - N - 1]!);
    c = { buf, f0: SR_CUERDA / (N + 0.5) };
    cache.set(clave, c);
  }
  return c;
}

/** Una cuerda punteada en `t`: la cuerda guardada, afinada con la velocidad de lectura. */
function puntear(ctx: AudioContext, out: AudioNode, t: number, tipo: Punteada, m: number, len: number, vol: number) {
  const { buf, f0 } = cuerda(ctx, tipo, m);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = hz(m) / f0;
  const g = ctx.createGain();
  const fin = Math.min(len, buf.duration * 0.95);
  g.gain.setValueAtTime(vol, t);
  g.gain.setValueAtTime(vol, t + Math.max(0.01, fin - 0.06));
  g.gain.exponentialRampToValueAtTime(0.0001, t + fin);
  src.connect(g).connect(out);
  src.start(t);
  src.stop(t + fin + 0.02);
  soltar(src, src, g);
}

/**
 * Un rasgueo: las notas de abajo hacia arriba (o al revés si la mano sube), una tras otra. El tiple dobla los
 * órdenes graves a la octava (sus cuerdas de entorchado), y las subidas suenan más suaves.
 */
function rasguear(ctx: AudioContext, out: AudioNode, t: number, tipo: Punteada, ms: number[], len: number, vol: number, dir: 1 | -1) {
  const orden = dir === 1 ? ms : [...ms].reverse();
  const paso = tipo === "tiple" ? 0.011 : 0.016;
  const v = vol * (dir === 1 ? 1 : 0.7);
  orden.forEach((m, i) => {
    const ti = t + i * paso;
    puntear(ctx, out, ti, tipo, m, len, v);
    if (tipo === "tiple" && m !== Math.max(...ms)) puntear(ctx, out, ti + 0.003, tipo, m - 12, len, v * 0.5);
  });
}

// ---------- Percusión ----------

function bombo(ctx: AudioContext, out: AudioNode, t: number, vol: number) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(105, t);
  osc.frequency.exponentialRampToValueAtTime(46, t + 0.24);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.37);
  soltar(osc, osc, g);
  noise(ctx, out, t, 0.05, "lowpass", 900, 0.7, vol * 0.4);
}

/** Un tambor de cuero: la nota que cae, el cuerpo y el golpe (la tambora y la caja vallenata). */
function tambor(ctx: AudioContext, out: AudioNode, t: number, vol: number, f: number, cae: number, len: number, chasquido: number) {
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(f * cae, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + len + 0.02);
  soltar(o, o, g);
  noise(ctx, out, t, 0.04, "bandpass", f * 9, 1, vol * chasquido);
}

function redoblante(ctx: AudioContext, out: AudioNode, t: number, vol: number) {
  // El cuero y la bordona.
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(210, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol * 0.6, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.12);
  soltar(o, o, g);
  noise(ctx, out, t, 0.16, "highpass", 1800, 0.7, vol);
}

/** El platillo: seis cuadradas desafinadas (como un platillo de verdad) y un ruido agudo que se apaga lento. */
function platillo(ctx: AudioContext, out: AudioNode, t: number, vol: number) {
  const bp = ctx.createBiquadFilter();
  bp.type = "highpass";
  bp.frequency.value = 6500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol * 0.5, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  bp.connect(g).connect(out);
  let ultimo: OscillatorNode | null = null;
  for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = f * 1.7;
    o.connect(bp);
    o.start(t);
    o.stop(t + 1.15);
    ultimo = o;
  }
  if (ultimo) soltar(ultimo, bp, g);
  noise(ctx, out, t, 1.2, "highpass", 5000, 0.5, vol);
}

function timbal(ctx: AudioContext, out: AudioNode, t: number, vol: number, f: number) {
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(f * 1.15, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
  const o2 = ctx.createOscillator();
  o2.frequency.value = f * 1.52;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g);
  o2.connect(g);
  g.connect(out);
  for (const x of [o, o2]) {
    x.start(t);
    x.stop(t + 0.3);
  }
  soltar(o2, o, o2, g);
  // El golpe del palo en el borde metálico.
  noise(ctx, out, t, 0.03, "bandpass", 3500, 1.2, vol * 0.5);
}

/** El güiro: el raspado son muchos golpecitos de ruido seguidos (un LFO que abre y cierra el ruido). */
function guiro(ctx: AudioContext, out: AudioNode, t: number, len: number, vol: number) {
  const g = noise(ctx, out, t, len, "bandpass", 3200, 1.5, vol, 0.01);
  const lfo = ctx.createOscillator();
  lfo.type = "sawtooth";
  lfo.frequency.value = 42;
  const d = ctx.createGain();
  d.gain.value = vol * 0.8;
  lfo.connect(d).connect(g.gain);
  lfo.start(t);
  lfo.stop(t + len + 0.05);
  soltar(lfo, lfo, d);
}

/** Una campana de metal: dos cuadradas por un filtro (la campana de la murga y el cencerro, más grave y largo). */
function metal(ctx: AudioContext, out: AudioNode, t: number, vol: number, fs: readonly number[], centro: number, len: number) {
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = centro;
  bp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  bp.connect(g).connect(out);
  let ultimo: OscillatorNode | null = null;
  for (const f of fs) {
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = f;
    o.connect(bp);
    o.start(t);
    o.stop(t + len + 0.02);
    ultimo = o;
  }
  if (ultimo) soltar(ultimo, bp, g);
}

/** Las chajchas (pezuñas de cabra): un puñado de clics que caen casi juntos. */
function chajchas(ctx: AudioContext, out: AudioNode, t: number, vol: number) {
  for (let i = 0; i < 6; i++) noise(ctx, out, t + i * 0.011 + Math.random() * 0.008, 0.025, "bandpass", 2200 + Math.random() * 2600, 4, vol * (1 - i * 0.12));
}

/** Toca un evento del programa en el momento `t` (s del contexto); `corchea` es lo que dura una corchea (s). */
export function tocar(ctx: AudioContext, mesa: Mesa, e: Evento, t: number, corchea: number) {
  const out = mesa.salida(e.inst);
  const len = Math.max(0.06, e.dur * corchea * 0.95);
  const fs = (e.ms ?? []).map(hz);
  switch (e.inst) {
    case "trompeta":
      for (const f of fs) bronce(ctx, out, t, f, len, e.vol, 7, 0.03, 0.006);
      return;
    case "saxo":
      for (const f of fs) bronce(ctx, out, t, f, len, e.vol, 5, 0.04, 0.009);
      return;
    case "trombon":
      // En el acompañamiento (dos notas) va con una sola sierra por nota.
      for (const f of fs) bronce(ctx, out, t, f, len, e.vol, 5.5, 0.05, 0.004, fs.length > 1 ? 1 : 2);
      return;
    case "tuba":
      for (const f of fs) tuba(ctx, out, t, f, len, e.vol);
      return;
    case "clarinete":
      for (const f of fs) clarinete(ctx, out, t, f, len, e.vol);
      return;
    case "flauta":
      for (const f of fs) soplo(ctx, out, t, f, len, e.vol, 0.12, 0.012, 0.06, 5);
      return;
    case "acordeon":
      return acordeon(ctx, out, t, fs, len, e.vol);
    case "quena":
      for (const f of fs) soplo(ctx, out, t, f, len, e.vol, 0.18, 0.008, 0.12);
      return;
    case "zampona":
      for (const f of fs) soplo(ctx, out, t, f, len, e.vol, 0.35, 0.002, 0.2);
      return;
    case "rondador":
      // Las dos cañas vecinas suenan juntas, cada una con su soplo (y una pizca desafinadas: baten).
      fs.forEach((f, i) => soplo(ctx, out, t, f * (i ? 1.003 : 1), len, e.vol, 0.45, 0, 0.08));
      return;
    case "violin":
      for (const f of fs) violin(ctx, out, t, f, len, e.vol);
      return;
    case "tiple":
    case "guitarra": {
      const ms = e.ms ?? [];
      if (e.rasgo) return rasguear(ctx, out, t, e.inst, ms, Math.max(len, corchea * 1.6), e.vol, e.rasgo);
      for (const m of ms) puntear(ctx, out, t, e.inst, m, Math.max(len, 0.5), e.vol);
      return;
    }
    case "requinto":
      for (const m of e.ms ?? []) puntear(ctx, out, t, "requinto", m, Math.max(len, 0.35), e.vol);
      return;
    case "bandola":
      // La bandola sostiene las notas largas con trémolo de plumilla (cada 75 ms, más suave al seguir).
      for (const m of e.ms ?? []) {
        if (len < 0.32) puntear(ctx, out, t, "bandola", m, Math.max(len, 0.3), e.vol);
        else for (let x = 0, j = 0; x < len - 0.02; x += 0.075, j++) puntear(ctx, out, t + x, "bandola", m, 0.16, e.vol * (j ? 0.55 : 1));
      }
      return;
    case "bombo":
      return bombo(ctx, out, t, e.vol);
    case "tambora":
      return tambor(ctx, out, t, e.vol, 95, 1.6, 0.3, 0.5);
    case "caja":
      return tambor(ctx, out, t, e.vol, 240, 1.3, 0.12, 0.9);
    case "redoblante":
      return redoblante(ctx, out, t, e.vol);
    case "platillo":
      return platillo(ctx, out, t, e.vol);
    case "timbal":
      return timbal(ctx, out, t, e.vol, 420);
    case "timbalBajo":
      return timbal(ctx, out, t, e.vol, 300);
    case "guiro":
      return guiro(ctx, out, t, Math.min(0.09, len), e.vol);
    case "guiroLargo":
      return guiro(ctx, out, t, corchea * 1.4, e.vol);
    case "guasa":
      return void noise(ctx, out, t, 0.08, "bandpass", 5500, 1.1, e.vol, 0.015);
    case "shekere":
      noise(ctx, out, t, 0.1, "highpass", 4200, 0.8, e.vol, 0.01);
      return void noise(ctx, out, t + 0.012, 0.05, "bandpass", 9000, 2, e.vol * 0.5);
    case "maracas":
      // Las semillas pegan dos veces: contra la pared del fruto al ir y al volver.
      noise(ctx, out, t, 0.05, "highpass", 6500, 0.9, e.vol, 0.004);
      return void noise(ctx, out, t + 0.03, 0.04, "highpass", 7000, 0.9, e.vol * 0.45, 0.004);
    case "chajchas":
      return chajchas(ctx, out, t, e.vol);
    case "campana":
      return metal(ctx, out, t, e.vol, [562, 845], 800, 0.3);
    case "cencerro":
      return metal(ctx, out, t, e.vol, [385, 572], 520, 0.5);
  }
}
