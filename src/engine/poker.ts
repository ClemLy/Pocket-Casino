import { type Card, chipValue, rankOrder } from './cards';

export type HandType =
  | 'HIGH_CARD'
  | 'PAIR'
  | 'TWO_PAIR'
  | 'THREE_KIND'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'FULL_HOUSE'
  | 'FOUR_KIND'
  | 'STRAIGHT_FLUSH'
  | 'ROYAL_FLUSH';

export interface HandDefinition {
  type: HandType;
  label: string;
  /** Jetons de base au niveau 1. */
  chips: number;
  /** Multiplicateur de base au niveau 1. */
  mult: number;
  /** Gain de jetons par niveau supplémentaire. */
  chipsPerLevel: number;
  /** Gain de multiplicateur par niveau supplémentaire. */
  multPerLevel: number;
  /** Coût d'amélioration en boutique. */
  upgradeCost: number;
}

/** Table des mains, de la plus faible à la plus forte. */
export const HAND_TABLE: Record<HandType, HandDefinition> = {
  HIGH_CARD: {
    type: 'HIGH_CARD',
    label: 'Carte Haute',
    chips: 5,
    mult: 1,
    chipsPerLevel: 10,
    multPerLevel: 1,
    upgradeCost: 60,
  },
  PAIR: {
    type: 'PAIR',
    label: 'Paire',
    chips: 10,
    mult: 2,
    chipsPerLevel: 15,
    multPerLevel: 1,
    upgradeCost: 80,
  },
  TWO_PAIR: {
    type: 'TWO_PAIR',
    label: 'Double Paire',
    chips: 20,
    mult: 2,
    chipsPerLevel: 20,
    multPerLevel: 1,
    upgradeCost: 100,
  },
  THREE_KIND: {
    type: 'THREE_KIND',
    label: 'Brelan',
    chips: 30,
    mult: 3,
    chipsPerLevel: 20,
    multPerLevel: 2,
    upgradeCost: 130,
  },
  STRAIGHT: {
    type: 'STRAIGHT',
    label: 'Suite',
    chips: 30,
    mult: 4,
    chipsPerLevel: 30,
    multPerLevel: 3,
    upgradeCost: 160,
  },
  FLUSH: {
    type: 'FLUSH',
    label: 'Couleur',
    chips: 35,
    mult: 4,
    chipsPerLevel: 15,
    multPerLevel: 2,
    upgradeCost: 160,
  },
  FULL_HOUSE: {
    type: 'FULL_HOUSE',
    label: 'Full',
    chips: 40,
    mult: 4,
    chipsPerLevel: 25,
    multPerLevel: 2,
    upgradeCost: 190,
  },
  FOUR_KIND: {
    type: 'FOUR_KIND',
    label: 'Carre',
    chips: 60,
    mult: 7,
    chipsPerLevel: 30,
    multPerLevel: 3,
    upgradeCost: 240,
  },
  STRAIGHT_FLUSH: {
    type: 'STRAIGHT_FLUSH',
    label: 'Quinte Flush',
    chips: 100,
    mult: 8,
    chipsPerLevel: 40,
    multPerLevel: 4,
    upgradeCost: 300,
  },
  ROYAL_FLUSH: {
    type: 'ROYAL_FLUSH',
    label: 'Quinte Flush Royale',
    chips: 100,
    mult: 8,
    chipsPerLevel: 40,
    multPerLevel: 4,
    upgradeCost: 300,
  },
};

/** Ordre d'affichage dans le carnet de règles, du plus fort au plus faible. */
export const HAND_ORDER: readonly HandType[] = [
  'ROYAL_FLUSH',
  'STRAIGHT_FLUSH',
  'FOUR_KIND',
  'FULL_HOUSE',
  'FLUSH',
  'STRAIGHT',
  'THREE_KIND',
  'TWO_PAIR',
  'PAIR',
  'HIGH_CARD',
];

export type HandLevels = Record<HandType, number>;

export function initialHandLevels(): HandLevels {
  return {
    HIGH_CARD: 1,
    PAIR: 1,
    TWO_PAIR: 1,
    THREE_KIND: 1,
    STRAIGHT: 1,
    FLUSH: 1,
    FULL_HOUSE: 1,
    FOUR_KIND: 1,
    STRAIGHT_FLUSH: 1,
    ROYAL_FLUSH: 1,
  };
}

export interface LeveledHand {
  chips: number;
  mult: number;
}

export function handAtLevel(type: HandType, level: number): LeveledHand {
  const def = HAND_TABLE[type];
  const extra = Math.max(0, level - 1);
  return {
    chips: def.chips + def.chipsPerLevel * extra,
    mult: def.mult + def.multPerLevel * extra,
  };
}

export interface DetectedHand {
  type: HandType;
  /** Sous-ensemble des cartes jouées qui compte réellement dans le score. */
  scoring: Card[];
}

function groupByRank(cards: Card[]): Map<number, Card[]> {
  const groups = new Map<number, Card[]>();
  for (const card of cards) {
    const key = rankOrder(card.rank);
    const bucket = groups.get(key);
    if (bucket) bucket.push(card);
    else groups.set(key, [card]);
  }
  return groups;
}

/** Suite sur exactement 5 cartes. Gère la roue basse A-2-3-4-5. */
function findStraight(cards: Card[]): Card[] | null {
  if (cards.length !== 5) return null;
  const unique = new Map<number, Card>();
  for (const card of cards) {
    const key = rankOrder(card.rank);
    if (!unique.has(key)) unique.set(key, card);
  }
  if (unique.size !== 5) return null;

  const values = [...unique.keys()].sort((a, b) => a - b);
  const consecutive = values.every((v, i) => i === 0 || v === values[i - 1] + 1);
  if (consecutive) return cards;

  // Roue basse : l'As compte comme 1.
  const isWheel = values.join(',') === '2,3,4,5,14';
  return isWheel ? cards : null;
}

function isFlush(cards: Card[]): boolean {
  return cards.length === 5 && cards.every((c) => c.suit === cards[0].suit);
}

/**
 * Identifie la meilleure main formée par les cartes jouées (1 à 5 cartes) et
 * renvoie les cartes qui rapportent des jetons. Les cartes hors combinaison ne
 * marquent pas, exactement comme dans un roguelike de poker.
 */
export function detectHand(cards: Card[]): DetectedHand {
  if (cards.length === 0) return { type: 'HIGH_CARD', scoring: [] };

  const straight = findStraight(cards);
  const flush = isFlush(cards);

  if (straight && flush) {
    const values = cards.map((c) => rankOrder(c.rank)).sort((a, b) => a - b);
    const isRoyal = values.join(',') === '10,11,12,13,14';
    return { type: isRoyal ? 'ROYAL_FLUSH' : 'STRAIGHT_FLUSH', scoring: cards };
  }

  const groups = [...groupByRank(cards).values()].sort(
    (a, b) => b.length - a.length || rankOrder(b[0].rank) - rankOrder(a[0].rank),
  );

  if (groups[0].length === 4) return { type: 'FOUR_KIND', scoring: groups[0] };
  if (groups[0].length === 3 && groups[1]?.length === 2) {
    return { type: 'FULL_HOUSE', scoring: [...groups[0], ...groups[1]] };
  }
  if (flush) return { type: 'FLUSH', scoring: cards };
  if (straight) return { type: 'STRAIGHT', scoring: cards };
  if (groups[0].length === 3) return { type: 'THREE_KIND', scoring: groups[0] };
  if (groups[0].length === 2 && groups[1]?.length === 2) {
    return { type: 'TWO_PAIR', scoring: [...groups[0], ...groups[1]] };
  }
  if (groups[0].length === 2) return { type: 'PAIR', scoring: groups[0] };

  const highest = cards.reduce((best, c) => (rankOrder(c.rank) > rankOrder(best.rank) ? c : best));
  return { type: 'HIGH_CARD', scoring: [highest] };
}

export interface ScoreBreakdown {
  hand: DetectedHand;
  baseChips: number;
  cardChips: number;
  chips: number;
  mult: number;
  /** Lignes lisibles pour l'UI : "Le Videur +4 Mult". */
  notes: string[];
  score: number;
}

export interface ScoreModifiers {
  chips?: number;
  mult?: number;
  xMult?: number;
  notes?: string[];
}

/**
 * Score final = (jetons de la main + jetons des cartes + bonus) x multiplicateur.
 * Les modificateurs viennent des jokers et des consommables.
 */
export function scoreHand(
  cards: Card[],
  levels: HandLevels,
  modifiers: ScoreModifiers = {},
): ScoreBreakdown {
  const hand = detectHand(cards);
  const leveled = handAtLevel(hand.type, levels[hand.type] ?? 1);
  const cardChips = hand.scoring.reduce((sum, c) => sum + chipValue(c.rank), 0);

  const chips = leveled.chips + cardChips + (modifiers.chips ?? 0);
  const mult = Math.max(0, (leveled.mult + (modifiers.mult ?? 0)) * (modifiers.xMult ?? 1));

  return {
    hand,
    baseChips: leveled.chips,
    cardChips,
    chips,
    mult: Math.round(mult * 100) / 100,
    notes: modifiers.notes ?? [],
    score: Math.floor(chips * mult),
  };
}
