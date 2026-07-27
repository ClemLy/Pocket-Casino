import type { Rng } from './rng';

export const STARTING_BANK = 1000;

/** Taux prélevé par la Mafia sur chaque gain tant que la dette n'est pas soldee. */
export const MAFIA_TAX_RATE = 0.2;
/** Montant avance par la Mafia. */
export const MAFIA_LOAN = 500;
/** Total a rembourser via la taxe avant d'être libre. */
export const MAFIA_DEBT = 700;

export const SIDE_JOB_REWARD = 50;
export const SIDE_JOB_DURATION_MS = 10_000;

/** Une rotation de la Roue de la Dernière Chance par tranche de 20 heures. */
export const WHEEL_COOLDOWN_MS = 20 * 60 * 60 * 1000;

export interface WheelSlice {
  amount: number;
  /** Poids relatif dans le tirage : les petits lots sortent bien plus souvent. */
  weight: number;
}

export const WHEEL_SLICES: readonly WheelSlice[] = [
  { amount: 100, weight: 30 },
  { amount: 150, weight: 24 },
  { amount: 200, weight: 18 },
  { amount: 250, weight: 12 },
  { amount: 300, weight: 8 },
  { amount: 400, weight: 5 },
  { amount: 500, weight: 3 },
];

export function spinWheel(rng: Rng): { index: number; amount: number } {
  const total = WHEEL_SLICES.reduce((sum, s) => sum + s.weight, 0);
  let ticket = rng.next() * total;
  for (let i = 0; i < WHEEL_SLICES.length; i++) {
    ticket -= WHEEL_SLICES[i].weight;
    if (ticket <= 0) return { index: i, amount: WHEEL_SLICES[i].amount };
  }
  const last = WHEEL_SLICES.length - 1;
  return { index: last, amount: WHEEL_SLICES[last].amount };
}

export interface TaxedGain {
  /** Montant réellement credite après prélevément. */
  net: number;
  /** Part prise par la Mafia. */
  tax: number;
  /** Dette restante après ce gain. */
  debtLeft: number;
}

/** Applique la taxe Mafia à un gain brut. Sans dette, le gain passe intact. */
export function applyMafiaTax(gross: number, debt: number): TaxedGain {
  if (debt <= 0 || gross <= 0) return { net: gross, tax: 0, debtLeft: Math.max(0, debt) };
  const tax = Math.min(debt, Math.ceil(gross * MAFIA_TAX_RATE));
  return { net: gross - tax, tax, debtLeft: debt - tax };
}

// U+00A0 (espace insécable) et U+202F (espace fine insécable) : le
// formatage francais utilise l'une ou l'autre selon le moteur JS.
const THIN_SPACES = /[\u00a0\u202f]/g;

/** Formate un montant à la française, avec des espaces insécables normalisées. */
export function formatMoney(amount: number): string {
  const grouped = Math.round(amount).toLocaleString('fr-FR').replace(THIN_SPACES, ' ');
  return `${grouped} $`;
}
