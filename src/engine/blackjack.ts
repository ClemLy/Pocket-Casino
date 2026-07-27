import type { Card } from './cards';

export interface HandValue {
  /** Meilleur total sans dépasser 21 quand c'est possible. */
  total: number;
  /** Vrai si un As compte encore pour 11 (main "souple"). */
  soft: boolean;
  busted: boolean;
}

function rawValue(card: Card): number {
  if (card.rank === 'A') return 11;
  if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J' || card.rank === '10') return 10;
  return Number.parseInt(card.rank, 10);
}

export function handValue(cards: readonly Card[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += rawValue(card);
    if (card.rank === 'A') aces++;
  }
  // Chaque As ramene de 11 a 1 tant qu'on dépasse 21.
  let soft = aces > 0;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
    soft = aces > 0;
  }
  return { total, soft, busted: total > 21 };
}

export function isBlackjack(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** Le croupier tire jusqu'à 17 et reste sur un 17 souple (règle "stand on soft 17"). */
export function dealerShouldHit(cards: readonly Card[]): boolean {
  const { total } = handValue(cards);
  return total < 17;
}

export function canSplit(cards: readonly Card[]): boolean {
  if (cards.length !== 2) return false;
  return rawValue(cards[0]) === rawValue(cards[1]);
}

export type PerfectPairKind = 'none' | 'mixed' | 'colored' | 'perfect';

/** Pari secondaire : paire mixte x6, paire de même couleur x12, paire parfaite x25. */
export function perfectPair(cards: readonly Card[]): { kind: PerfectPairKind; payout: number } {
  if (cards.length < 2 || cards[0].rank !== cards[1].rank) return { kind: 'none', payout: 0 };
  const [a, b] = cards;
  if (a.suit === b.suit) return { kind: 'perfect', payout: 25 };
  const sameColor =
    (a.suit === 'H' && b.suit === 'D') ||
    (a.suit === 'D' && b.suit === 'H') ||
    (a.suit === 'S' && b.suit === 'C') ||
    (a.suit === 'C' && b.suit === 'S');
  return sameColor ? { kind: 'colored', payout: 12 } : { kind: 'mixed', payout: 6 };
}

export type Outcome = 'win' | 'lose' | 'push' | 'blackjack';

export interface Settlement {
  outcome: Outcome;
  /** Retour total credite au joueur, mise comprise. 0 signifie mise perdue. */
  payout: number;
}

/** Blackjack paye 3 pour 2, une victoire simple paye 1 pour 1, l'égalité rembourse. */
export function settle(player: readonly Card[], dealer: readonly Card[], bet: number): Settlement {
  const p = handValue(player);
  const d = handValue(dealer);
  const playerBj = isBlackjack(player);
  const dealerBj = isBlackjack(dealer);

  if (p.busted) return { outcome: 'lose', payout: 0 };
  if (playerBj && dealerBj) return { outcome: 'push', payout: bet };
  if (playerBj) return { outcome: 'blackjack', payout: Math.floor(bet * 2.5) };
  if (dealerBj) return { outcome: 'lose', payout: 0 };
  if (d.busted) return { outcome: 'win', payout: bet * 2 };
  if (p.total > d.total) return { outcome: 'win', payout: bet * 2 };
  if (p.total < d.total) return { outcome: 'lose', payout: 0 };
  return { outcome: 'push', payout: bet };
}

/**
 * Table de stratégie de base simplifiee, affichée dans le carnet de règles.
 * Renvoie l'action conseillee face a la carte visible du croupier.
 */
export type BasicAction = 'Tirer' | 'Rester' | 'Doubler' | 'Splitter';

export function basicStrategy(player: readonly Card[], dealerUp: Card): BasicAction {
  const up = rawValue(dealerUp) === 11 ? 11 : rawValue(dealerUp);
  const { total, soft } = handValue(player);

  if (canSplit(player)) {
    const pairValue = rawValue(player[0]);
    if (pairValue === 11 || pairValue === 8) return 'Splitter';
    if (pairValue === 10 || pairValue === 5) {
      /* on ne split jamais les 10 ni les 5 */
    } else if (pairValue === 9) {
      if (up !== 7 && up < 10) return 'Splitter';
    } else if (up >= 2 && up <= 7) {
      return 'Splitter';
    }
  }

  if (soft && total <= 21) {
    if (total >= 19) return 'Rester';
    if (total === 18) return up >= 9 ? 'Tirer' : up >= 3 && up <= 6 ? 'Doubler' : 'Rester';
    if (total >= 15 && up >= 4 && up <= 6) return 'Doubler';
    if (total >= 13 && up >= 5 && up <= 6) return 'Doubler';
    return 'Tirer';
  }

  if (total >= 17) return 'Rester';
  if (total >= 13 && up <= 6) return 'Rester';
  if (total === 12) return up >= 4 && up <= 6 ? 'Rester' : 'Tirer';
  if (total === 11) return 'Doubler';
  if (total === 10) return up <= 9 ? 'Doubler' : 'Tirer';
  if (total === 9) return up >= 3 && up <= 6 ? 'Doubler' : 'Tirer';
  return 'Tirer';
}
