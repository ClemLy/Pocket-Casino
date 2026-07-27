export type WheelKind = 'europeenne' | 'turbo';
export type PocketColor = 'rouge' | 'noir' | 'vert';

export interface WheelConfig {
  kind: WheelKind;
  label: string;
  /** Ordre physique des cases sur la roue, sens horaire. */
  order: readonly number[];
  reds: ReadonlySet<number>;
  /** Cote d'un numéro plein, hors mise. */
  straightPayout: number;
  max: number;
  /** Vrai si la table propose les douzaines et les colonnes. */
  hasDozens: boolean;
}

const EUROPEAN_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

const EUROPEAN_REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// Roue courte maison : 12 numéros plus le zero, couleurs alternees comme sur une vraie table.
const TURBO_ORDER = [0, 5, 11, 6, 12, 1, 7, 2, 8, 3, 9, 4, 10] as const;
const TURBO_REDS = new Set([1, 3, 5, 7, 9, 12]);

export const WHEELS: Record<WheelKind, WheelConfig> = {
  europeenne: {
    kind: 'europeenne',
    label: 'Européenne',
    order: EUROPEAN_ORDER,
    reds: EUROPEAN_REDS,
    straightPayout: 35,
    max: 36,
    hasDozens: true,
  },
  turbo: {
    kind: 'turbo',
    label: 'Turbo',
    order: TURBO_ORDER,
    reds: TURBO_REDS,
    straightPayout: 11,
    max: 12,
    hasDozens: false,
  },
};

export function colorOf(wheel: WheelConfig, n: number): PocketColor {
  if (n === 0) return 'vert';
  return wheel.reds.has(n) ? 'rouge' : 'noir';
}

export type BetKind =
  'straight' | 'rouge' | 'noir' | 'pair' | 'impair' | 'manque' | 'passe' | 'douzaine' | 'colonne';

export interface Bet {
  kind: BetKind;
  /** Numéro pour `straight`, index 1 à 3 pour `douzaine` et `colonne`. */
  value?: number;
  amount: number;
}

export interface BetDefinition {
  kind: BetKind;
  label: string;
  /** Cote hors mise : 1 signifie que l'on recupere le double. */
  payout: number;
  hint: string;
}

export function betDefinitions(wheel: WheelConfig): BetDefinition[] {
  const half = wheel.max / 2;
  const defs: BetDefinition[] = [
    {
      kind: 'straight',
      label: 'Numéro plein',
      payout: wheel.straightPayout,
      hint: 'Un seul numéro',
    },
    { kind: 'rouge', label: 'Rouge', payout: 1, hint: 'Toutes les cases rouges' },
    { kind: 'noir', label: 'Noir', payout: 1, hint: 'Toutes les cases noires' },
    { kind: 'pair', label: 'Pair', payout: 1, hint: 'Numéros pairs, zero exclu' },
    { kind: 'impair', label: 'Impair', payout: 1, hint: 'Numéros impairs' },
    { kind: 'manque', label: `Manque 1-${half}`, payout: 1, hint: 'Moitie basse' },
    { kind: 'passe', label: `Passe ${half + 1}-${wheel.max}`, payout: 1, hint: 'Moitie haute' },
  ];
  if (wheel.hasDozens) {
    defs.push(
      { kind: 'douzaine', label: 'Douzaine', payout: 2, hint: '12 numéros consécutifs' },
      { kind: 'colonne', label: 'Colonne', payout: 2, hint: '12 numéros en colonne' },
    );
  }
  return defs;
}

export function payoutOf(wheel: WheelConfig, kind: BetKind): number {
  return betDefinitions(wheel).find((d) => d.kind === kind)?.payout ?? 0;
}

/** Vrai si la mise est gagnante sur le numéro sorti. Le zero fait perdre les chances simples. */
export function betWins(wheel: WheelConfig, bet: Bet, n: number): boolean {
  const half = wheel.max / 2;
  switch (bet.kind) {
    case 'straight':
      return bet.value === n;
    case 'rouge':
      return colorOf(wheel, n) === 'rouge';
    case 'noir':
      return colorOf(wheel, n) === 'noir';
    case 'pair':
      return n !== 0 && n % 2 === 0;
    case 'impair':
      return n !== 0 && n % 2 === 1;
    case 'manque':
      return n >= 1 && n <= half;
    case 'passe':
      return n > half && n <= wheel.max;
    case 'douzaine': {
      if (n === 0 || bet.value === undefined) return false;
      return Math.ceil(n / 12) === bet.value;
    }
    case 'colonne': {
      if (n === 0 || bet.value === undefined) return false;
      return ((n - 1) % 3) + 1 === bet.value;
    }
    default:
      return false;
  }
}

export interface SpinResult {
  number: number;
  color: PocketColor;
  /** Retour total, mises gagnantes comprises. */
  payout: number;
  totalStake: number;
  /** Vrai si le jeton Safety Net a rembourse la moitié des mises sur un zero. */
  safetyNetUsed: boolean;
}

/**
 * Règle les mises. Avec le jeton Safety Net, un zero ne coute que la moitié
 * des mises perdantes au lieu de la totalité.
 */
export function resolveSpin(
  wheel: WheelConfig,
  bets: readonly Bet[],
  n: number,
  safetyNet = false,
): SpinResult {
  const totalStake = bets.reduce((sum, b) => sum + b.amount, 0);
  let payout = 0;

  for (const bet of bets) {
    if (betWins(wheel, bet, n)) payout += bet.amount * (payoutOf(wheel, bet.kind) + 1);
  }

  const safetyNetUsed = safetyNet && n === 0 && payout === 0 && totalStake > 0;
  if (safetyNetUsed) payout = Math.floor(totalStake * 0.5);

  return { number: n, color: colorOf(wheel, n), payout, totalStake, safetyNetUsed };
}

export interface BetPreset {
  id: string;
  name: string;
  wheel: WheelKind;
  bets: Bet[];
}
