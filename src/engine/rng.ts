/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 *
 * Pourquoi ne pas utiliser Math.random ? Parce qu'une seed explicite rend les
 * parties rejouables, les tests reproductibles et les captures d'écran stables
 * (scripts/screenshots.mjs passe `?seed=` dans l'URL).
 */
export interface Rng {
  /** Flottant dans [0, 1). */
  next(): number;
  /** Entier dans [min, max] inclus. */
  int(min: number, max: number): number;
  /** Renvoie true avec la probabilité donnée (0 à 1). */
  chance(probability: number): boolean;
  /** Élément au hasard dans un tableau non vide. */
  pick<T>(items: readonly T[]): T;
  /** Copie mélangée (Fisher-Yates), l'entrée n'est pas modifiée. */
  shuffle<T>(items: readonly T[]): T[];
}

export function createRng(seed: number = Date.now()): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));

  return {
    next,
    int,
    chance: (probability) => next() < probability,
    pick: (items) => items[int(0, items.length - 1)],
    shuffle: (items) => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

/** Lit `?seed=` dans l'URL, sinon renvoie une seed aléatoire. */
export function seedFromLocation(search = typeof location === 'undefined' ? '' : location.search) {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null) return Math.floor(Math.random() * 2 ** 32);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
