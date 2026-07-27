import type { Rng } from './rng';

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  /** Identifiant unique et stable, utile comme clé React pendant les animations. */
  id: string;
  rank: Rank;
  suit: Suit;
}

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS: readonly Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

export const SUIT_LABEL: Record<Suit, string> = {
  S: 'Pique',
  H: 'Coeur',
  D: 'Carreau',
  C: 'Trefle',
};

export const RED_SUITS: readonly Suit[] = ['H', 'D'];

export function isRed(card: Card): boolean {
  return card.suit === 'H' || card.suit === 'D';
}

/** Valeur en jetons d'une carte au poker roguelike (l'As vaut 11). */
export function chipValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
  return Number.parseInt(rank, 10);
}

/** Rang ordinal pour les suites. L'As vaut 14 et peut aussi valoir 1 (A-2-3-4-5). */
export function rankOrder(rank: Rank): number {
  if (rank === 'A') return 14;
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  return Number.parseInt(rank, 10);
}

export function isFaceCard(rank: Rank): boolean {
  return rank === 'J' || rank === 'Q' || rank === 'K';
}

/** Jeu de 52 cartes, ordre canonique. `tag` évite les collisions d'id entre paquets. */
export function createDeck(tag = 'd'): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${tag}-${rank}${suit}`, rank, suit });
    }
  }
  return deck;
}

/** Sabot de `count` jeux mélangés, comme au blackjack de casino. */
export function createShoe(count: number, rng: Rng): Card[] {
  const shoe: Card[] = [];
  for (let i = 0; i < count; i++) shoe.push(...createDeck(`s${i}`));
  return rng.shuffle(shoe);
}

export function cardLabel(card: Card): string {
  return `${card.rank} de ${SUIT_LABEL[card.suit]}`;
}
