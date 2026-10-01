/**
 * Banque de sons entierement synthetisee au Web Audio API.
 *
 * Aucun fichier audio n'est embarque : tout est généré a la volee (oscillateurs
 * carres facon puce 8 bits plus du bruit blanc filtre pour les cartes et les
 * jetons). Ca garde le bundle léger et le rendu cohérent avec le pixel art.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let noiseBuffer: AudioBuffer | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);
  }
  // Les navigateurs suspendent le contexte tant qu'il n'y a pas eu d'interaction.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function getNoise(audio: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const length = Math.floor(audio.sampleRate * 0.5);
    noiseBuffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
  if (value) ensureContext();
}

export function isSoundEnabled(): boolean {
  return enabled;
}

/** A appeler sur la première interaction pour debloquer l'audio mobile. */
export function unlockAudio(): void {
  if (enabled) ensureContext();
}

interface ToneOptions {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  /** Frequence de fin pour un glissando. */
  sweepTo?: number;
}

function tone({ freq, duration, type = 'square', gain = 0.5, delay = 0, sweepTo }: ToneOptions) {
  const audio = ensureContext();
  if (!audio || !master || !enabled) return;

  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const env = audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (sweepTo !== undefined)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), start + duration);

  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(env).connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

interface NoiseOptions {
  duration: number;
  gain?: number;
  delay?: number;
  filterFrom?: number;
  filterTo?: number;
  q?: number;
}

function noise({
  duration,
  gain = 0.3,
  delay = 0,
  filterFrom = 1800,
  filterTo = 600,
  q = 1,
}: NoiseOptions) {
  const audio = ensureContext();
  if (!audio || !master || !enabled) return;

  const start = audio.currentTime + delay;
  const src = audio.createBufferSource();
  src.buffer = getNoise(audio);

  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(filterFrom, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), start + duration);

  const env = audio.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  src.connect(filter).connect(env).connect(master);
  src.start(start);
  src.stop(start + duration + 0.02);
}

/** Carte qui glisse sur le feutre. */
export function sfxCardDeal(index = 0): void {
  noise({
    duration: 0.13,
    gain: 0.22,
    delay: index * 0.07,
    filterFrom: 2600,
    filterTo: 700,
    q: 0.8,
  });
}

/** Carte que l'on retourne. */
export function sfxCardFlip(): void {
  noise({ duration: 0.09, gain: 0.26, filterFrom: 3200, filterTo: 900, q: 1.4 });
  tone({ freq: 520, duration: 0.05, type: 'triangle', gain: 0.12 });
}

/** Cliquetis sec d'un jeton en céramique pose sur le tapis. */
export function sfxChip(index = 0): void {
  const delay = index * 0.035;
  noise({ duration: 0.045, gain: 0.3, delay, filterFrom: 5200, filterTo: 2200, q: 3 });
  tone({ freq: 1400 + index * 40, duration: 0.04, type: 'square', gain: 0.1, delay });
}

export function sfxChipStack(count = 4): void {
  for (let i = 0; i < count; i++) sfxChip(i);
}

/** Bouton d'arcade enfonce. */
export function sfxButton(): void {
  tone({ freq: 220, duration: 0.06, type: 'square', gain: 0.18, sweepTo: 160 });
}

/** Petit clic de la bille contre les séparateurs. */
export function sfxWheelTick(delay = 0): void {
  noise({ duration: 0.03, gain: 0.2, delay, filterFrom: 4200, filterTo: 3000, q: 6 });
}

/** Jingle de victoire, arpege majeur ascendant. */
export function sfxWin(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => tone({ freq, duration: 0.12, gain: 0.24, delay: i * 0.07 }));
}

/** Gros gain : arpege plus long avec une quinte finale tenue. */
export function sfxBigWin(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
  notes.forEach((freq, i) => tone({ freq, duration: 0.11, gain: 0.24, delay: i * 0.06 }));
  tone({ freq: 2093, duration: 0.5, gain: 0.16, delay: 0.42, type: 'triangle' });
}

/** Perte : descente dissonante. */
export function sfxLose(): void {
  tone({ freq: 320, duration: 0.16, gain: 0.2, sweepTo: 180 });
  tone({ freq: 240, duration: 0.28, gain: 0.18, delay: 0.13, sweepTo: 90 });
}

/** Piece ramassee dans le job d'appoint. */
export function sfxCoin(): void {
  tone({ freq: 988, duration: 0.06, gain: 0.2 });
  tone({ freq: 1319, duration: 0.13, gain: 0.2, delay: 0.055 });
}

/** Trophée debloque. */
export function sfxTrophy(): void {
  const notes = [659.25, 830.61, 987.77, 1318.5];
  notes.forEach((freq, i) =>
    tone({ freq, duration: 0.15, gain: 0.22, delay: i * 0.09, type: 'triangle' }),
  );
}

/** Tension du Quitte ou Double. */
export function sfxSuspense(): void {
  tone({ freq: 110, duration: 0.6, gain: 0.14, type: 'sawtooth', sweepTo: 220 });
}

/**
 * Tic du decompte de score : chaque carte qui marque monte d'un demi-ton,
 * l'oreille sent la main grimper avant de voir le total.
 */
export function sfxScoreTick(step = 0): void {
  const freq = 440 * Math.pow(2, Math.min(step, 14) / 12);
  tone({ freq, duration: 0.07, type: 'square', gain: 0.16 });
  tone({ freq: freq * 2, duration: 0.05, type: 'triangle', gain: 0.08, delay: 0.01 });
}

/** Coup de multiplicateur : grave, court, avec un claquement. */
export function sfxMult(step = 0): void {
  const freq = 196 * Math.pow(2, Math.min(step, 8) / 12);
  tone({ freq, duration: 0.12, type: 'sawtooth', gain: 0.14, sweepTo: freq * 1.5 });
  noise({ duration: 0.05, gain: 0.18, filterFrom: 3000, filterTo: 1200, q: 2 });
}

/** Le total tombe sur la table. */
export function sfxSlam(): void {
  tone({ freq: 130, duration: 0.22, type: 'square', gain: 0.2, sweepTo: 65 });
  noise({ duration: 0.16, gain: 0.32, filterFrom: 900, filterTo: 120, q: 0.7 });
}
