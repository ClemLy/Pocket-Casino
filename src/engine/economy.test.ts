import { describe, expect, it } from 'vitest';
import { applyMafiaTax, formatMoney, MAFIA_DEBT, spinWheel, WHEEL_SLICES } from './economy';
import { createRng } from './rng';

describe('applyMafiaTax', () => {
  it('laisse le gain intact sans dette', () => {
    expect(applyMafiaTax(500, 0)).toEqual({ net: 500, tax: 0, debtLeft: 0 });
  });

  it('prélevé 20 % tant que la dette court', () => {
    expect(applyMafiaTax(500, MAFIA_DEBT)).toEqual({
      net: 400,
      tax: 100,
      debtLeft: MAFIA_DEBT - 100,
    });
  });

  it('ne prend jamais plus que la dette restante', () => {
    const result = applyMafiaTax(5000, 50);
    expect(result.tax).toBe(50);
    expect(result.debtLeft).toBe(0);
    expect(result.net).toBe(4950);
  });

  it('ignore les gains nuls ou negatifs', () => {
    expect(applyMafiaTax(0, MAFIA_DEBT).tax).toBe(0);
    expect(applyMafiaTax(-10, MAFIA_DEBT).tax).toBe(0);
  });

  it('solde la dette au bout de plusieurs gains', () => {
    let debt = MAFIA_DEBT;
    let rounds = 0;
    while (debt > 0 && rounds < 100) {
      debt = applyMafiaTax(400, debt).debtLeft;
      rounds++;
    }
    expect(debt).toBe(0);
    expect(rounds).toBeLessThan(20);
  });
});

describe('spinWheel', () => {
  it('ne sort que des lots declares', () => {
    const rng = createRng(42);
    const amounts = new Set(WHEEL_SLICES.map((s) => s.amount));
    for (let i = 0; i < 500; i++) {
      expect(amounts.has(spinWheel(rng).amount)).toBe(true);
    }
  });

  it('reste dans la fourchette 100 a 500 promise au joueur', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const { amount } = spinWheel(rng);
      expect(amount).toBeGreaterThanOrEqual(100);
      expect(amount).toBeLessThanOrEqual(500);
    }
  });

  it('sort les petits lots plus souvent que les gros', () => {
    const rng = createRng(1234);
    let small = 0;
    let big = 0;
    for (let i = 0; i < 4000; i++) {
      const { amount } = spinWheel(rng);
      if (amount <= 150) small++;
      if (amount >= 400) big++;
    }
    expect(small).toBeGreaterThan(big * 3);
  });
});

describe('formatMoney', () => {
  it('groupe les milliers avec une espace normale', () => {
    expect(formatMoney(12345)).toBe('12 345 $');
  });

  it('arrondit a l unité', () => {
    expect(formatMoney(99.6)).toBe('100 $');
  });

  it('gere le zero', () => {
    expect(formatMoney(0)).toBe('0 $');
  });
});
