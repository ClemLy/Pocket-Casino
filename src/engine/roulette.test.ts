import { describe, expect, it } from 'vitest';
import { betWins, colorOf, payoutOf, resolveSpin, WHEELS } from './roulette';

const euro = WHEELS.europeenne;
const turbo = WHEELS.turbo;

describe('configuration des roues', () => {
  it('a 37 cases sur la roue europeenne, toutes distinctes', () => {
    expect(euro.order).toHaveLength(37);
    expect(new Set(euro.order).size).toBe(37);
  });

  it('a 13 cases sur la roue turbo, toutes distinctes', () => {
    expect(turbo.order).toHaveLength(13);
    expect(new Set(turbo.order).size).toBe(13);
  });

  it('couvre 0 a 36 sans trou sur la roue europeenne', () => {
    for (let n = 0; n <= 36; n++) expect(euro.order).toContain(n);
  });

  it('repartit 18 rouges et 18 noirs sur la roue europeenne', () => {
    const reds = euro.order.filter((n) => colorOf(euro, n) === 'rouge');
    const blacks = euro.order.filter((n) => colorOf(euro, n) === 'noir');
    expect(reds).toHaveLength(18);
    expect(blacks).toHaveLength(18);
  });

  it('reserve le vert au seul zero', () => {
    expect(colorOf(euro, 0)).toBe('vert');
    expect(euro.order.filter((n) => colorOf(euro, n) === 'vert')).toEqual([0]);
  });
});

describe('betWins', () => {
  it('fait perdre toutes les chances simples sur le zero', () => {
    for (const kind of ['rouge', 'noir', 'pair', 'impair', 'manque', 'passe'] as const) {
      expect(betWins(euro, { kind, amount: 10 }, 0)).toBe(false);
    }
  });

  it('resout le numéro plein', () => {
    expect(betWins(euro, { kind: 'straight', value: 17, amount: 10 }, 17)).toBe(true);
    expect(betWins(euro, { kind: 'straight', value: 17, amount: 10 }, 18)).toBe(false);
  });

  it('resout les douzaines', () => {
    expect(betWins(euro, { kind: 'douzaine', value: 1, amount: 10 }, 12)).toBe(true);
    expect(betWins(euro, { kind: 'douzaine', value: 2, amount: 10 }, 12)).toBe(false);
    expect(betWins(euro, { kind: 'douzaine', value: 3, amount: 10 }, 36)).toBe(true);
  });

  it('resout les colonnes', () => {
    expect(betWins(euro, { kind: 'colonne', value: 1, amount: 10 }, 1)).toBe(true);
    expect(betWins(euro, { kind: 'colonne', value: 2, amount: 10 }, 2)).toBe(true);
    expect(betWins(euro, { kind: 'colonne', value: 3, amount: 10 }, 3)).toBe(true);
    expect(betWins(euro, { kind: 'colonne', value: 1, amount: 10 }, 2)).toBe(false);
  });

  it('coupe manque et passe au milieu de la table turbo', () => {
    expect(betWins(turbo, { kind: 'manque', amount: 10 }, 6)).toBe(true);
    expect(betWins(turbo, { kind: 'manque', amount: 10 }, 7)).toBe(false);
    expect(betWins(turbo, { kind: 'passe', amount: 10 }, 7)).toBe(true);
  });
});

describe('resolveSpin', () => {
  it('paye le numéro plein a la cote annoncée', () => {
    const result = resolveSpin(euro, [{ kind: 'straight', value: 7, amount: 10 }], 7);
    expect(result.payout).toBe(10 * (payoutOf(euro, 'straight') + 1));
    expect(result.payout).toBe(360);
  });

  it('ne rend rien sur une mise perdante', () => {
    expect(resolveSpin(euro, [{ kind: 'rouge', amount: 50 }], 20).payout).toBe(0);
  });

  it('cumule plusieurs mises gagnantes', () => {
    const result = resolveSpin(
      euro,
      [
        { kind: 'rouge', amount: 50 },
        { kind: 'straight', value: 7, amount: 10 },
      ],
      7,
    );
    expect(result.payout).toBe(100 + 360);
  });

  it('rend la moitié du tapis sur un zero avec Safety Net', () => {
    const result = resolveSpin(euro, [{ kind: 'rouge', amount: 80 }], 0, true);
    expect(result.safetyNetUsed).toBe(true);
    expect(result.payout).toBe(40);
  });

  it('ne déclenche pas le Safety Net si une mise passe malgre le zero', () => {
    const result = resolveSpin(euro, [{ kind: 'straight', value: 0, amount: 10 }], 0, true);
    expect(result.safetyNetUsed).toBe(false);
    expect(result.payout).toBe(360);
  });

  it('ne déclenche pas le Safety Net hors du zero', () => {
    const result = resolveSpin(euro, [{ kind: 'rouge', amount: 80 }], 20, true);
    expect(result.safetyNetUsed).toBe(false);
    expect(result.payout).toBe(0);
  });

  it('paye le numéro plein turbo a 11 contre 1', () => {
    const result = resolveSpin(turbo, [{ kind: 'straight', value: 5, amount: 10 }], 5);
    expect(result.payout).toBe(120);
  });
});

describe('espérance de gain', () => {
  it('garde un avantage a la maison sur le numéro plein des deux roues', () => {
    for (const wheel of [euro, turbo]) {
      const pockets = wheel.order.length;
      const expected = ((wheel.straightPayout + 1) * 1) / pockets;
      expect(expected).toBeLessThan(1);
    }
  });
});
