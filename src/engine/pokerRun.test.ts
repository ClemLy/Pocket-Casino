import { describe, expect, it } from 'vitest';
import { type Card, createDeck } from './cards';
import { detectHand, initialHandLevels, scoreHand, type HandLevels } from './poker';
import { anteConfig, HAND_SIZE, MAX_SELECTED } from './pokerRun';
import { createRng, type Rng } from './rng';

/** Toutes les combinaisons de 1 a 5 cartes parmi la main. */
function subsets(cards: Card[]): Card[][] {
  const out: Card[][] = [];
  const walk = (start: number, current: Card[]) => {
    if (current.length > 0) out.push(current.slice());
    if (current.length === MAX_SELECTED) return;
    for (let i = start; i < cards.length; i++) {
      current.push(cards[i]);
      walk(i + 1, current);
      current.pop();
    }
  };
  walk(0, []);
  return out;
}

interface BestPlay {
  cards: Card[];
  score: number;
}

function bestPlay(hand: Card[], levels: HandLevels): BestPlay {
  let best: BestPlay = { cards: [], score: -1 };
  for (const candidate of subsets(hand)) {
    const { score } = scoreHand(candidate, levels);
    if (score > best.score) best = { cards: candidate, score };
  }
  return best;
}

/**
 * Simule une manche jouee par quelqu'un qui reflechit un minimum : il cherche
 * la meilleure combinaison possible et defausse le reste tant que sa meilleure
 * main ne vaut pas grand-chose.
 */
function playAnte(ante: number, rng: Rng): { score: number; won: boolean } {
  const config = anteConfig(ante);
  const levels = initialHandLevels();
  const deck = rng.shuffle(createDeck(`sim${ante}`));

  let hand: Card[] = [];
  const draw = () => {
    while (hand.length < HAND_SIZE && deck.length > 0) hand.push(deck.pop() as Card);
  };
  draw();

  let total = 0;
  let discardsLeft = config.discards;

  for (let handsLeft = config.hands; handsLeft > 0; handsLeft--) {
    let best = bestPlay(hand, levels);

    // Tant que la meilleure main reste faible, on jette ce qui ne marque pas.
    while (discardsLeft > 0 && detectHand(best.cards).type === 'HIGH_CARD') {
      const keep = new Set(best.cards.map((c) => c.id));
      const trash = hand.filter((c) => !keep.has(c.id)).slice(0, MAX_SELECTED);
      if (trash.length === 0) break;
      const trashed = new Set(trash.map((c) => c.id));
      hand = hand.filter((c) => !trashed.has(c.id));
      draw();
      discardsLeft--;
      best = bestPlay(hand, levels);
    }

    total += best.score;
    const played = new Set(best.cards.map((c) => c.id));
    hand = hand.filter((c) => !played.has(c.id));
    draw();

    if (total >= config.target) return { score: total, won: true };
  }

  return { score: total, won: false };
}

describe('anteConfig', () => {
  it('durcit la cible a chaque ante', () => {
    for (let ante = 2; ante <= 12; ante++) {
      expect(anteConfig(ante).target).toBeGreaterThan(anteConfig(ante - 1).target);
    }
  });

  it('augmente le buy-in et la recompense en meme temps', () => {
    for (let ante = 2; ante <= 12; ante++) {
      expect(anteConfig(ante).buyIn).toBeGreaterThan(anteConfig(ante - 1).buyIn);
      expect(anteConfig(ante).reward).toBeGreaterThan(anteConfig(ante - 1).reward);
    }
  });

  it('garde la recompense au-dessus du buy-in a tous les antes', () => {
    for (let ante = 1; ante <= 12; ante++) {
      const config = anteConfig(ante);
      expect(config.reward, `ante ${ante}`).toBeGreaterThan(config.buyIn);
    }
  });

  it('continue a monter au-dela de la table codee en dur', () => {
    expect(anteConfig(9).target).toBeGreaterThan(anteConfig(8).target);
    expect(Number.isFinite(anteConfig(20).target)).toBe(true);
  });
});

describe('equilibrage de la difficulte', () => {
  // Ces bornes protegent la courbe de difficulte : si un jour le bareme des
  // mains ou les cibles bougent, le test dit tout de suite dans quel sens.
  const simulate = (ante: number, runs = 300) => {
    const rng = createRng(4242);
    let wins = 0;
    for (let i = 0; i < runs; i++) if (playAnte(ante, rng).won) wins++;
    return wins / runs;
  };

  it('rend l ante 1 largement gagnable sans joker ni amelioration', () => {
    // Premiere manche : elle doit donner envie, pas filtrer.
    expect(simulate(1)).toBeGreaterThan(0.75);
  });

  it('garde l ante 2 jouable a nu, mais deja serre', () => {
    const rate = simulate(2);
    expect(rate).toBeGreaterThan(0.45);
    expect(rate).toBeLessThan(0.9);
  });

  it('rend l ante 4 hors de portee sans passer par la boutique', () => {
    // C'est ce qui force la boucle du roguelike : acheter pour continuer.
    expect(simulate(4)).toBeLessThan(0.1);
  });
});
