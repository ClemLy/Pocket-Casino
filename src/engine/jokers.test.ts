import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from './cards';
import { applyJokers, JOKERS, type JokerContext } from './jokers';
import { createRng } from './rng';

function hand(spec: string): Card[] {
  return spec.split(' ').map((token, i) => {
    const suit = token.slice(-1) as Suit;
    const rank = token.slice(0, -1) as Rank;
    return { id: `t${i}-${token}`, rank, suit };
  });
}

function ctx(overrides: Partial<JokerContext> = {}): JokerContext {
  const cards = hand('AS AC 5H 9D KS');
  return {
    handType: 'PAIR',
    scoring: cards.slice(0, 2),
    played: cards,
    discardsLeft: 2,
    handsLeft: 3,
    rng: createRng(1),
    ...overrides,
  };
}

describe('catalogue de jokers', () => {
  it('a des identifiants uniques', () => {
    expect(new Set(JOKERS.map((j) => j.id)).size).toBe(JOKERS.length);
  });

  it('a un prix positif et une description pour chacun', () => {
    for (const joker of JOKERS) {
      expect(joker.price, joker.id).toBeGreaterThan(0);
      expect(joker.description.length, joker.id).toBeGreaterThan(10);
    }
  });
});

describe('applyJokers', () => {
  it('ne fait rien sans joker équipe', () => {
    expect(applyJokers([], ctx())).toEqual({ chips: 0, mult: 0, xMult: 1, notes: [] });
  });

  it('ignore un identifiant inconnu', () => {
    expect(applyJokers(['joker-fantome'], ctx()).mult).toBe(0);
  });

  it('cumule les bonus additifs de plusieurs jokers', () => {
    const result = applyJokers(['videur', 'croupier-vereux'], ctx());
    expect(result.mult).toBe(4);
    expect(result.chips).toBe(40);
    expect(result.notes).toHaveLength(2);
  });

  it('compte les piques marquants pour Coeur de Pique', () => {
    // Une seule des deux cartes qui marquent est un pique.
    expect(applyJokers(['coeur-de-pique'], ctx()).mult).toBe(3);
  });

  it('ne déclenche pas Main Lourde sur une simple paire', () => {
    expect(applyJokers(['main-lourde'], ctx()).chips).toBe(0);
    expect(applyJokers(['main-lourde'], ctx({ handType: 'FULL_HOUSE' })).chips).toBe(50);
  });

  it('multiplie les xMult entre eux', () => {
    const result = applyJokers(
      ['vieux-briscard', 'flambeur'],
      ctx({ played: hand('AS AC'), handsLeft: 1 }),
    );
    expect(result.xMult).toBe(3);
  });

  it('récompense les défausses non utilisées avec le Compteur', () => {
    expect(applyJokers(['compteur-de-cartes'], ctx({ discardsLeft: 3 })).mult).toBe(6);
    expect(applyJokers(['compteur-de-cartes'], ctx({ discardsLeft: 0 })).mult).toBe(0);
  });

  it('fait tomber la Machine à Sous environ une fois sur quatre', () => {
    const rng = createRng(2024);
    let hits = 0;
    for (let i = 0; i < 4000; i++) {
      if (applyJokers(['machine-a-sous'], ctx({ rng })).mult === 20) hits++;
    }
    expect(hits / 4000).toBeGreaterThan(0.22);
    expect(hits / 4000).toBeLessThan(0.28);
  });
});
