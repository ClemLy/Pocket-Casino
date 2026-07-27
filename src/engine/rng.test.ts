import { describe, expect, it } from 'vitest';
import { createDeck, createShoe } from './cards';
import { createRng, seedFromLocation } from './rng';

describe('createRng', () => {
  it('produit la même suite pour une même seed', () => {
    const a = createRng(2024);
    const b = createRng(2024);
    const left = Array.from({ length: 20 }, () => a.next());
    const right = Array.from({ length: 20 }, () => b.next());
    expect(left).toEqual(right);
  });

  it('produit des suites différentes pour des seeds différentes', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('reste dans [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 2000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('respecte les bornes de int, incluses', () => {
    const rng = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const value = rng.int(1, 6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }
    expect(seen.size).toBe(6);
  });

  it('mélange sans perdre ni dupliquer de carte', () => {
    const rng = createRng(77);
    const deck = createDeck();
    const shuffled = rng.shuffle(deck);
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map((c) => c.id)).size).toBe(52);
    expect(deck.map((c) => c.id)).not.toEqual(shuffled.map((c) => c.id));
  });

  it('ne modifie pas le tableau d origine', () => {
    const rng = createRng(3);
    const source = [1, 2, 3, 4, 5];
    rng.shuffle(source);
    expect(source).toEqual([1, 2, 3, 4, 5]);
  });

  it('respecte la probabilité de chance sur un grand echantillon', () => {
    const rng = createRng(11);
    let hits = 0;
    for (let i = 0; i < 10000; i++) if (rng.chance(0.25)) hits++;
    expect(hits / 10000).toBeGreaterThan(0.22);
    expect(hits / 10000).toBeLessThan(0.28);
  });
});

describe('seedFromLocation', () => {
  it('lit la seed passee dans l URL', () => {
    expect(seedFromLocation('?seed=4242')).toBe(4242);
  });

  it('tombe sur zero si la seed est illisible', () => {
    expect(seedFromLocation('?seed=abc')).toBe(0);
  });
});

describe('createShoe', () => {
  it('empile le bon nombre de jeux avec des identifiants uniques', () => {
    const shoe = createShoe(4, createRng(8));
    expect(shoe).toHaveLength(208);
    expect(new Set(shoe.map((c) => c.id)).size).toBe(208);
  });
});
