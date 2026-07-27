import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from './cards';
import {
  basicStrategy,
  canSplit,
  dealerShouldHit,
  handValue,
  isBlackjack,
  perfectPair,
  settle,
} from './blackjack';

function hand(spec: string): Card[] {
  return spec.split(' ').map((token, i) => {
    const suit = token.slice(-1) as Suit;
    const rank = token.slice(0, -1) as Rank;
    return { id: `t${i}-${token}`, rank, suit };
  });
}

describe('handValue', () => {
  it('compte l As pour 11 quand ca passe', () => {
    expect(handValue(hand('AS 9H'))).toEqual({ total: 20, soft: true, busted: false });
  });

  it('ramene l As a 1 pour éviter de sauter', () => {
    expect(handValue(hand('AS 9H 5D'))).toEqual({ total: 15, soft: false, busted: false });
  });

  it('gere plusieurs As', () => {
    expect(handValue(hand('AS AH')).total).toBe(12);
    expect(handValue(hand('AS AH AD AC')).total).toBe(14);
    expect(handValue(hand('AS AH 9D')).total).toBe(21);
  });

  it('marque la main comme sautée au dela de 21', () => {
    expect(handValue(hand('KS QH 5D')).busted).toBe(true);
  });
});

describe('isBlackjack', () => {
  it('exige exactement deux cartes', () => {
    expect(isBlackjack(hand('AS KH'))).toBe(true);
    expect(isBlackjack(hand('7S 7H 7D'))).toBe(false);
  });
});

describe('dealerShouldHit', () => {
  it('tire jusqu a 16', () => {
    expect(dealerShouldHit(hand('10S 6H'))).toBe(true);
  });

  it('reste a 17', () => {
    expect(dealerShouldHit(hand('10S 7H'))).toBe(false);
  });

  it('reste sur un 17 souple', () => {
    expect(dealerShouldHit(hand('AS 6H'))).toBe(false);
  });
});

describe('canSplit', () => {
  it('accepte deux cartes de même valeur', () => {
    expect(canSplit(hand('8S 8H'))).toBe(true);
    expect(canSplit(hand('KS 10H'))).toBe(true);
  });

  it('refuse au dela de deux cartes', () => {
    expect(canSplit(hand('8S 8H 8D'))).toBe(false);
  });
});

describe('perfectPair', () => {
  it('classe les trois types de paires', () => {
    expect(perfectPair(hand('8H 8H')).kind).toBe('perfect');
    expect(perfectPair(hand('8H 8D')).kind).toBe('colored');
    expect(perfectPair(hand('8H 8S')).kind).toBe('mixed');
    expect(perfectPair(hand('8H 9S')).kind).toBe('none');
  });

  it('paye plus cher la paire parfaite', () => {
    expect(perfectPair(hand('8H 8H')).payout).toBeGreaterThan(perfectPair(hand('8H 8D')).payout);
  });
});

describe('settle', () => {
  it('paye le blackjack 3 pour 2', () => {
    expect(settle(hand('AS KH'), hand('10S 8H'), 100)).toEqual({
      outcome: 'blackjack',
      payout: 250,
    });
  });

  it('rembourse sur deux blackjacks', () => {
    expect(settle(hand('AS KH'), hand('AD QC'), 100)).toEqual({ outcome: 'push', payout: 100 });
  });

  it('fait perdre une main sautée même si le croupier saute aussi', () => {
    expect(settle(hand('KS QH 5D'), hand('KS QH 5C'), 100)).toEqual({
      outcome: 'lose',
      payout: 0,
    });
  });

  it('paye 1 pour 1 quand le croupier saute', () => {
    expect(settle(hand('10S 8H'), hand('KS QH 5D'), 100)).toEqual({ outcome: 'win', payout: 200 });
  });

  it('rembourse a égalité', () => {
    expect(settle(hand('10S 9H'), hand('KS 9D'), 100)).toEqual({ outcome: 'push', payout: 100 });
  });

  it('fait perdre le 20 face au blackjack du croupier', () => {
    expect(settle(hand('KS QH'), hand('AS QD'), 100).outcome).toBe('lose');
  });
});

describe('basicStrategy', () => {
  it('conseille toujours de splitter les As et les 8', () => {
    for (const up of ['2', '7', '10', 'A'] as Rank[]) {
      expect(basicStrategy(hand('AS AH'), hand(`${up}C`)[0])).toBe('Splitter');
      expect(basicStrategy(hand('8S 8H'), hand(`${up}C`)[0])).toBe('Splitter');
    }
  });

  it('ne splitte jamais les 10', () => {
    expect(basicStrategy(hand('10S 10H'), hand('6C')[0])).not.toBe('Splitter');
  });

  it('reste sur un dur 17 ou plus', () => {
    expect(basicStrategy(hand('10S 7H'), hand('AC')[0])).toBe('Rester');
  });

  it('double sur 11', () => {
    expect(basicStrategy(hand('6S 5H'), hand('6C')[0])).toBe('Doubler');
  });

  it('tire sur un dur 12 face a un 2', () => {
    expect(basicStrategy(hand('10S 2H'), hand('2C')[0])).toBe('Tirer');
  });

  it('reste sur un dur 13 face a un 6', () => {
    expect(basicStrategy(hand('10S 3H'), hand('6C')[0])).toBe('Rester');
  });
});
