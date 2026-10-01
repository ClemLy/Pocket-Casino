import { type Card, isFaceCard, isRed } from './cards';
import type { HandType } from './poker';
import type { Rng } from './rng';

export interface JokerContext {
  handType: HandType;
  /** Cartes qui comptent dans la combinaison. */
  scoring: Card[];
  /** Toutes les cartes posées sur la table. */
  played: Card[];
  discardsLeft: number;
  handsLeft: number;
  rng: Rng;
}

export interface JokerEffect {
  chips?: number;
  mult?: number;
  xMult?: number;
  note?: string;
}

export type JokerRarity = 'commun' | 'rare' | 'legendaire';

/** Les cles restent en ASCII, seuls les libelles affiches portent les accents. */
export const RARITY_LABEL: Record<JokerRarity, string> = {
  commun: 'commun',
  rare: 'rare',
  legendaire: 'légendaire',
};

export interface Joker {
  id: string;
  name: string;
  description: string;
  price: number;
  rarity: JokerRarity;
  /** Renvoie null quand la condition n'est pas remplie sur cette main. */
  apply(ctx: JokerContext): JokerEffect | null;
}

const STRONG_HANDS: readonly HandType[] = [
  'THREE_KIND',
  'STRAIGHT',
  'FLUSH',
  'FULL_HOUSE',
  'FOUR_KIND',
  'STRAIGHT_FLUSH',
  'ROYAL_FLUSH',
];

export const JOKERS: readonly Joker[] = [
  {
    id: 'videur',
    name: 'Le Videur',
    description: '+4 Mult, sans condition. Il ne discute pas.',
    price: 300,
    rarity: 'commun',
    apply: () => ({ mult: 4, note: 'Le Videur +4 Mult' }),
  },
  {
    id: 'croupier-vereux',
    name: 'Croupier Véreux',
    description: '+40 Jetons, sans condition. Sa manche est trop large.',
    price: 250,
    rarity: 'commun',
    apply: () => ({ chips: 40, note: 'Croupier Véreux +40 Jetons' }),
  },
  {
    id: 'coeur-de-pique',
    name: 'Coeur de Pique',
    description: '+3 Mult par Pique qui marque.',
    price: 350,
    rarity: 'commun',
    apply: (ctx) => {
      const spades = ctx.scoring.filter((c) => c.suit === 'S').length;
      return spades > 0 ? { mult: spades * 3, note: `Coeur de Pique +${spades * 3} Mult` } : null;
    },
  },
  {
    id: 'porte-bonheur',
    name: 'Porte-Bonheur',
    description: '+1 Mult par carte rouge qui marque.',
    price: 250,
    rarity: 'commun',
    apply: (ctx) => {
      const reds = ctx.scoring.filter(isRed).length;
      return reds > 0 ? { mult: reds, note: `Porte-Bonheur +${reds} Mult` } : null;
    },
  },
  {
    id: 'dame-de-carreau',
    name: 'Dame de Carreau',
    description: '+25 Jetons par figure (V, D, R) qui marque.',
    price: 400,
    rarity: 'rare',
    apply: (ctx) => {
      const faces = ctx.scoring.filter((c) => isFaceCard(c.rank)).length;
      return faces > 0
        ? { chips: faces * 25, note: `Dame de Carreau +${faces * 25} Jetons` }
        : null;
    },
  },
  {
    id: 'main-lourde',
    name: 'Main Lourde',
    description: '+50 Jetons si la main est un Brelan ou mieux.',
    price: 350,
    rarity: 'commun',
    apply: (ctx) =>
      STRONG_HANDS.includes(ctx.handType) ? { chips: 50, note: 'Main Lourde +50 Jetons' } : null,
  },
  {
    id: 'compteur-de-cartes',
    name: 'Compteur de Cartes',
    description: '+2 Mult par défausse encore disponible.',
    price: 300,
    rarity: 'rare',
    apply: (ctx) =>
      ctx.discardsLeft > 0
        ? { mult: ctx.discardsLeft * 2, note: `Compteur +${ctx.discardsLeft * 2} Mult` }
        : null,
  },
  {
    id: 'vieux-briscard',
    name: 'Vieux Briscard',
    description: 'x1.5 Mult si tu poses 3 cartes ou moins.',
    price: 400,
    rarity: 'rare',
    apply: (ctx) =>
      ctx.played.length <= 3 ? { xMult: 1.5, note: 'Vieux Briscard x1.5 Mult' } : null,
  },
  {
    id: 'machine-a-sous',
    name: 'Machine à Sous',
    description: '1 chance sur 4 de donner +20 Mult.',
    price: 300,
    rarity: 'rare',
    apply: (ctx) =>
      ctx.rng.chance(0.25)
        ? { mult: 20, note: 'Machine à Sous JACKPOT +20 Mult' }
        : { note: 'Machine à Sous : rien' },
  },
  {
    id: 'flambeur',
    name: 'Le Flambeur',
    description: 'x2 Mult sur la dernière main de la manche.',
    price: 500,
    rarity: 'legendaire',
    apply: (ctx) => (ctx.handsLeft <= 1 ? { xMult: 2, note: 'Le Flambeur x2 Mult' } : null),
  },
];

export function findJoker(id: string): Joker | undefined {
  return JOKERS.find((j) => j.id === id);
}

export interface AggregatedJokers {
  chips: number;
  mult: number;
  xMult: number;
  notes: string[];
}

/** Effet d'un joker qui s'est declenche sur une main donnee. */
export interface JokerTrigger {
  id: string;
  effect: JokerEffect;
}

export interface DetailedJokers extends AggregatedJokers {
  /** Un element par joker declenche, dans l'ordre de possession. */
  triggers: JokerTrigger[];
}

/**
 * Comme `applyJokers`, mais garde aussi la trace de chaque declenchement.
 * L'interface s'en sert pour faire reagir chaque joker a son tour pendant le
 * decompte. Chaque joker n'est evalue qu'une fois : les tirages aleatoires
 * (Machine a Sous) restent coherents entre le detail et le total.
 */
export function applyJokersDetailed(ids: readonly string[], ctx: JokerContext): DetailedJokers {
  const result: DetailedJokers = { chips: 0, mult: 0, xMult: 1, notes: [], triggers: [] };
  for (const id of ids) {
    const joker = findJoker(id);
    if (!joker) continue;
    const effect = joker.apply(ctx);
    if (!effect) continue;
    result.chips += effect.chips ?? 0;
    result.mult += effect.mult ?? 0;
    result.xMult *= effect.xMult ?? 1;
    if (effect.note) result.notes.push(effect.note);
    result.triggers.push({ id, effect });
  }
  return result;
}

/** Applique les jokers dans l'ordre où ils sont possédés, puis cumule les effets. */
export function applyJokers(ids: readonly string[], ctx: JokerContext): AggregatedJokers {
  const { triggers: _triggers, ...aggregate } = applyJokersDetailed(ids, ctx);
  return aggregate;
}
