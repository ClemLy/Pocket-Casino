import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from './cards';
import { detectHand, HAND_TABLE, handAtLevel, initialHandLevels, scoreHand } from './poker';

function hand(spec: string): Card[] {
  return spec.split(' ').map((token, i) => {
    const suit = token.slice(-1) as Suit;
    const rank = token.slice(0, -1) as Rank;
    return { id: `t${i}-${token}`, rank, suit };
  });
}

describe('detectHand', () => {
  it('reconnait une quinte flush royale', () => {
    expect(detectHand(hand('10H JH QH KH AH')).type).toBe('ROYAL_FLUSH');
  });

  it('reconnait une quinte flush non royale', () => {
    expect(detectHand(hand('5S 6S 7S 8S 9S')).type).toBe('STRAIGHT_FLUSH');
  });

  it('reconnait la roue basse A-2-3-4-5 comme une suite', () => {
    expect(detectHand(hand('AS 2H 3D 4C 5S')).type).toBe('STRAIGHT');
  });

  it('ne prend pas Q-K-A-2-3 pour une suite', () => {
    expect(detectHand(hand('QS KH AD 2C 3S')).type).toBe('HIGH_CARD');
  });

  it('distingue le full du brelan', () => {
    expect(detectHand(hand('8S 8H 8D KC KS')).type).toBe('FULL_HOUSE');
    expect(detectHand(hand('8S 8H 8D KC 2S')).type).toBe('THREE_KIND');
  });

  it('reconnait le carre et ne fait marquer que les quatre cartes', () => {
    const result = detectHand(hand('QS QH QD QC 3S'));
    expect(result.type).toBe('FOUR_KIND');
    expect(result.scoring).toHaveLength(4);
  });

  it('ne fait marquer que la paire dans une main a cinq cartes', () => {
    const result = detectHand(hand('AS AC 5H 9D KS'));
    expect(result.type).toBe('PAIR');
    expect(result.scoring.map((c) => c.rank)).toEqual(['A', 'A']);
  });

  it('ne fait marquer que la carte la plus haute sur une carte haute', () => {
    const result = detectHand(hand('KS 9H 7D 4C 2S'));
    expect(result.type).toBe('HIGH_CARD');
    expect(result.scoring).toHaveLength(1);
    expect(result.scoring[0].rank).toBe('K');
  });

  it('accepte les mains de moins de cinq cartes', () => {
    expect(detectHand(hand('7S 7H')).type).toBe('PAIR');
    expect(detectHand(hand('7S')).type).toBe('HIGH_CARD');
    expect(detectHand(hand('7S 8S 9S 10S')).type).toBe('HIGH_CARD');
  });

  it('renvoie une main vide sans planter', () => {
    expect(detectHand([]).scoring).toHaveLength(0);
  });
});

describe('handAtLevel', () => {
  it('applique les gains de niveau', () => {
    const def = HAND_TABLE.PAIR;
    expect(handAtLevel('PAIR', 1)).toEqual({ chips: def.chips, mult: def.mult });
    expect(handAtLevel('PAIR', 3)).toEqual({
      chips: def.chips + def.chipsPerLevel * 2,
      mult: def.mult + def.multPerLevel * 2,
    });
  });

  it('traite un niveau 0 ou negatif comme le niveau 1', () => {
    expect(handAtLevel('PAIR', 0)).toEqual(handAtLevel('PAIR', 1));
  });
});

describe('scoreHand', () => {
  const levels = initialHandLevels();

  it('additionne jetons de main et jetons de cartes avant de multiplier', () => {
    // Paire d'As : 10 jetons de base + 11 + 11 = 32, multiplicateur 2.
    const result = scoreHand(hand('AS AC 5H 9D KS'), levels);
    expect(result.chips).toBe(32);
    expect(result.mult).toBe(2);
    expect(result.score).toBe(64);
  });

  it('applique les modificateurs additifs puis multiplicatifs', () => {
    const result = scoreHand(hand('AS AC 5H 9D KS'), levels, { chips: 40, mult: 4, xMult: 1.5 });
    // (32 + 40) x ((2 + 4) x 1.5) = 72 x 9 = 648
    expect(result.chips).toBe(72);
    expect(result.mult).toBe(9);
    expect(result.score).toBe(648);
  });

  it('ne descend jamais sous un multiplicateur de zero', () => {
    const result = scoreHand(hand('AS AC'), levels, { mult: -99 });
    expect(result.mult).toBe(0);
    expect(result.score).toBe(0);
  });

  it('remonte les notes des modificateurs pour l affichage', () => {
    const result = scoreHand(hand('AS AC'), levels, { notes: ['Le Videur +4 Mult'] });
    expect(result.notes).toEqual(['Le Videur +4 Mult']);
  });
});
