/** Paramêtres d'une manche du mode Poker Roguelike. */
export interface AnteConfig {
  ante: number;
  /** Score a atteindre pour valider la manche. */
  target: number;
  /** Droit d'entrée prélevé sur la banque. */
  buyIn: number;
  /** Gain versé à la banque si la manche est validée. */
  reward: number;
  hands: number;
  discards: number;
}

/**
 * Cibles de score par ante.
 *
 * Calibrees sur une simulation (voir pokerRun.test.ts) : une manche jouee
 * proprement mais sans joker ni amelioration rapporte environ 500 points en
 * mediane. L'ante 1 doit donc passer presque toujours, l'ante 2 rester jouable
 * a nu, et tout ce qui suit obliger a passer par la boutique. C'est la boucle
 * du roguelike : sans achat, la course s'arrete vite.
 */
const TARGETS = [300, 450, 700, 1100, 1700, 2600, 4000, 6200] as const;

export const HAND_SIZE = 8;
export const MAX_SELECTED = 5;

export function anteConfig(ante: number): AnteConfig {
  const index = Math.min(ante - 1, TARGETS.length - 1);
  const overflow = Math.max(0, ante - TARGETS.length);
  const target = Math.round(TARGETS[index] * Math.pow(1.65, overflow));
  return {
    ante,
    target,
    buyIn: 100 + 50 * (ante - 1),
    reward: 250 + 150 * (ante - 1),
    hands: 4,
    discards: 3,
  };
}

/** Nombre de jokers proposes en boutique entre deux manches. */
export const SHOP_OFFER_SIZE = 3;

/** Bonus verse par main restante quand la manche est validée en avance. */
export const UNUSED_HAND_BONUS = 40;
