import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, LayoutGroup, motion, type Variants } from 'motion/react';
import { type Card, chipValue, createDeck, rankOrder } from '../engine/cards';
import { formatMoney } from '../engine/economy';
import {
  applyJokersDetailed,
  findJoker,
  JOKERS,
  type Joker,
  type JokerTrigger,
} from '../engine/jokers';
import {
  detectHand,
  HAND_TABLE,
  handAtLevel,
  type HandLevels,
  type HandType,
  initialHandLevels,
  scoreHand,
} from '../engine/poker';
import {
  anteConfig,
  HAND_SIZE,
  MAX_SELECTED,
  SHOP_OFFER_SIZE,
  UNUSED_HAND_BONUS,
} from '../engine/pokerRun';
import { appRng } from '../engine/appRng';
import { useCasino } from '../store/useCasino';
import { useJuice, useRoundActive } from '../store/useJuice';
import {
  sfxButton,
  sfxCardDeal,
  sfxChip,
  sfxLose,
  sfxMult,
  sfxScoreTick,
  sfxSlam,
  sfxWin,
} from '../audio/sfx';
import { Counter } from '../components/Counter';
import { JokerCard } from '../components/JokerCard';
import { PlayingCard } from '../components/PlayingCard';
import { RoundEnd } from '../components/RoundEnd';
import { Sprite } from '../components/Sprite';

type Phase = 'accueil' | 'jeu' | 'gain' | 'boutique' | 'echec';
type SortMode = 'rang' | 'couleur';

/**
 * Mains proposées à l'amélioration en boutique, de la plus faible à la plus
 * forte. Les dix combinaisons existent, il n'y a pas de raison d'en cacher
 * certaines : le Carré, la Quinte Flush et la Quinte Flush Royale doivent
 * pouvoir monter en niveau comme les autres.
 */
const UPGRADABLE: readonly HandType[] = [
  'HIGH_CARD',
  'PAIR',
  'TWO_PAIR',
  'THREE_KIND',
  'STRAIGHT',
  'FLUSH',
  'FULL_HOUSE',
  'FOUR_KIND',
  'STRAIGHT_FLUSH',
  'ROYAL_FLUSH',
];

const MAX_JOKERS = 5;
const SUIT_ORDER = { S: 0, H: 1, C: 2, D: 3 } as const;

/** Rythme du decompte, en millisecondes. Divise par 4 en animations reduites. */
const BEAT = {
  land: 380,
  card: 300,
  joker: 440,
  total: 460,
  apply: 640,
  clear: 560,
};

/** Calcul affiche dans la colonne de score. */
interface Tally {
  label: string;
  level: number;
  chips: number;
  mult: number;
  total: number | null;
  /** Compteurs de pulsation : changer la valeur rejoue l'animation. */
  chipsPulse: number;
  multPulse: number;
}

interface Bubble {
  id: number;
  /** Carte ou joker au-dessus duquel la bulle apparait. */
  anchor: string;
  text: string;
  kind: 'chips' | 'mult' | 'xmult';
}

/**
 * Sorties de l'eventail : une defausse part vers le bas, une carte jouee
 * s'efface sur place car c'est son double, dans la zone de jeu, qui voyage.
 */
const FAN_VARIANTS: Variants = {
  dealt: { opacity: 0, x: 260, y: -40, rotate: 14 },
  held: { opacity: 1, x: 0, y: 0, rotate: 0 },
  gone: (isDiscard: boolean) =>
    isDiscard
      ? {
          opacity: 0,
          y: 110,
          rotate: 16,
          transition: { duration: 0.26, ease: [0.23, 1, 0.32, 1] as const },
        }
      : { opacity: 0, transition: { duration: 0 } },
};

function sortHand(cards: Card[], mode: SortMode | null): Card[] {
  if (!mode) return cards;
  return [...cards].sort((a, b) =>
    mode === 'rang'
      ? rankOrder(b.rank) - rankOrder(a.rank) || SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]
      : SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || rankOrder(b.rank) - rankOrder(a.rank),
  );
}

/** Ordre d'affichage des jokers : les ajouts d'abord, les multiplications ensuite. */
function orderTriggers(triggers: JokerTrigger[]): JokerTrigger[] {
  const additive = triggers.filter((t) => !t.effect.xMult || t.effect.xMult === 1);
  const multiplicative = triggers.filter((t) => t.effect.xMult && t.effect.xMult !== 1);
  return [...additive, ...multiplicative];
}

function formatMult(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

export function PokerRun() {
  const bank = useCasino((s) => s.bank);
  const inventory = useCasino((s) => s.inventory);
  const reducedMotion = useCasino((s) => s.reducedMotion);
  const withdraw = useCasino((s) => s.withdraw);
  const consumeItem = useCasino((s) => s.consumeItem);
  const unlock = useCasino((s) => s.unlock);
  const recordStat = useCasino((s) => s.recordStat);
  const juice = useJuice();

  const deckRef = useRef<Card[]>([]);
  const timersRef = useRef<number[]>([]);
  const bubbleId = useRef(1);

  const [phase, setPhase] = useState<Phase>('accueil');
  const [ante, setAnte] = useState(1);
  const [score, setScore] = useState(0);
  const [handsLeft, setHandsLeft] = useState(0);
  const [discardsLeft, setDiscardsLeft] = useState(0);
  const [hand, setHand] = useState<Card[]>([]);
  const [played, setPlayed] = useState<Card[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [jokers, setJokers] = useState<string[]>([]);
  const [levels, setLevels] = useState<HandLevels>(initialHandLevels());
  const [jokerCardArmed, setJokerCardArmed] = useState(false);
  const [pureRound, setPureRound] = useState(true);
  const [offer, setOffer] = useState<Joker[]>([]);
  const [reward, setReward] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [tally, setTally] = useState<Tally | null>(null);
  const [lastTally, setLastTally] = useState<Tally | null>(null);
  const [scoringIds, setScoringIds] = useState<string[]>([]);
  const [pulses, setPulses] = useState<Record<string, number>>({});
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [discarding, setDiscarding] = useState(false);

  useRoundActive(phase === 'jeu' || phase === 'gain');

  const config = useMemo(() => anteConfig(ante), [ante]);
  const progress = Math.min(100, (score / config.target) * 100);
  const shownHand = useMemo(() => sortHand(hand, sortMode), [hand, sortMode]);

  // Les minuteurs du decompte meurent avec l'ecran.
  useEffect(() => () => timersRef.current.forEach(window.clearTimeout), []);

  const later = useCallback(
    (fn: () => void, at: number) => {
      const speed =
        reducedMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0.25 : 1;
      timersRef.current.push(window.setTimeout(fn, at * speed));
    },
    [reducedMotion],
  );

  const pulse = (key: string) => setPulses((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));

  const bubble = (anchor: string, text: string, kind: Bubble['kind']) => {
    const id = bubbleId.current++;
    setBubbles((prev) => [...prev, { id, anchor, text, kind }]);
    window.setTimeout(() => setBubbles((prev) => prev.filter((b) => b.id !== id)), 1100);
  };

  const drawTo = useCallback((current: Card[], size = HAND_SIZE): Card[] => {
    const next = current.slice();
    while (next.length < size && deckRef.current.length > 0) {
      next.push(deckRef.current.pop() as Card);
    }
    return next;
  }, []);

  const beginRound = useCallback(
    (nextAnte: number) => {
      const cfg = anteConfig(nextAnte);
      if (!withdraw(cfg.buyIn)) return false;

      deckRef.current = appRng.shuffle(createDeck(`a${nextAnte}`));
      const fresh = drawTo([]);
      fresh.forEach((_, i) => sfxCardDeal(i));

      setAnte(nextAnte);
      setScore(0);
      setHandsLeft(cfg.hands);
      setDiscardsLeft(cfg.discards);
      setHand(fresh);
      setPlayed([]);
      setSelected([]);
      setTally(null);
      setLastTally(null);
      setPureRound(true);
      setJokerCardArmed(false);
      setBusy(false);
      setPhase('jeu');
      return true;
    },
    [drawTo, withdraw],
  );

  const startRun = () => {
    sfxButton();
    setJokers([]);
    setLevels(initialHandLevels());
    beginRound(1);
  };

  const toggleCard = useCallback(
    (id: string) => {
      if (busy) return;
      setSelected((prev) => {
        if (prev.includes(id)) return prev.filter((c) => c !== id);
        if (prev.length >= MAX_SELECTED) return prev;
        sfxChip();
        return [...prev, id];
      });
    },
    [busy],
  );

  const selectedCards = useMemo(
    () => shownHand.filter((c) => selected.includes(c.id)),
    [shownHand, selected],
  );

  /** Aperçu en direct de la combinaison en cours de sélection. */
  const preview = useMemo<Tally | null>(() => {
    if (selectedCards.length === 0) return null;
    const detected = detectHand(selectedCards);
    const level = levels[detected.type];
    const leveled = handAtLevel(detected.type, level);
    return {
      label: HAND_TABLE[detected.type].label,
      level,
      chips: leveled.chips,
      mult: leveled.mult,
      total: null,
      chipsPulse: 0,
      multPulse: 0,
    };
  }, [selectedCards, levels]);

  /* ---------------------------------------------------------------- jouer */

  const playHand = () => {
    if (busy || selectedCards.length === 0 || handsLeft === 0) return;

    const cards = selectedCards;
    const detected = detectHand(cards);
    const detailed = applyJokersDetailed(jokers, {
      handType: detected.type,
      scoring: detected.scoring,
      played: cards,
      discardsLeft,
      handsLeft,
      rng: appRng,
    });

    const notes = [...detailed.notes];
    let xMult = detailed.xMult;
    const armed = jokerCardArmed;
    if (armed) {
      xMult *= 1.5;
      notes.push('Carte Joker x1.5');
      setJokerCardArmed(false);
    }

    const breakdown = scoreHand(cards, levels, {
      chips: detailed.chips,
      mult: detailed.mult,
      xMult,
      notes,
    });

    const level = levels[detected.type];
    const leveled = handAtLevel(detected.type, level);
    const label = HAND_TABLE[detected.type].label;
    const kept = hand.filter((c) => !selected.includes(c.id));
    const total = score + breakdown.score;
    const remainingHands = handsLeft - 1;

    // La main quitte l'eventail et se pose au centre de la table.
    setBusy(true);
    setPlayed(cards);
    setHand(kept);
    setSelected([]);
    setHandsLeft(remainingHands);
    recordStat('mainsDePoker', 1);
    cards.forEach((_, i) => sfxCardDeal(i));

    let t = BEAT.land;
    const running = { chips: leveled.chips, mult: leveled.mult };
    let chipsPulse = 1;
    let multPulse = 1;

    later(() => {
      setTally({ label, level, ...running, total: null, chipsPulse, multPulse });
      setScoringIds(detected.scoring.map((c) => c.id));
      sfxButton();
    }, t);

    // Chaque carte qui marque ajoute sa valeur, une par une.
    detected.scoring.forEach((card, i) => {
      t += BEAT.card;
      later(() => {
        const value = chipValue(card.rank);
        running.chips += value;
        chipsPulse += 1;
        setTally((prev) =>
          prev ? { ...prev, chips: running.chips, chipsPulse: chipsPulse } : prev,
        );
        pulse(card.id);
        bubble(card.id, `+${value}`, 'chips');
        sfxScoreTick(i);
      }, t);
    });

    // Puis les jokers, dans un ordre qui tombe juste : ajouts, puis multiplications.
    orderTriggers(detailed.triggers).forEach((trigger, i) => {
      t += BEAT.joker;
      later(() => {
        const { chips = 0, mult = 0, xMult: times = 1 } = trigger.effect;
        running.chips += chips;
        running.mult = (running.mult + mult) * times;
        if (chips) chipsPulse += 1;
        if (mult || times !== 1) multPulse += 1;
        setTally((prev) => (prev ? { ...prev, ...running, chipsPulse, multPulse } : prev));
        pulse(`joker:${trigger.id}`);
        const text = times !== 1 ? `x${formatMult(times)}` : chips ? `+${chips}` : `+${mult}`;
        bubble(`joker:${trigger.id}`, text, times !== 1 ? 'xmult' : chips ? 'chips' : 'mult');
        if (chips && !mult && times === 1) sfxScoreTick(detected.scoring.length + i);
        else sfxMult(i);
      }, t);
    });

    if (armed) {
      t += BEAT.joker;
      later(() => {
        running.mult *= 1.5;
        multPulse += 1;
        setTally((prev) => (prev ? { ...prev, mult: running.mult, multPulse } : prev));
        bubble('item:jokerCard', 'x1,5', 'xmult');
        sfxMult(4);
      }, t);
    }

    // Le total tombe, aligne exactement sur le moteur.
    t += BEAT.total;
    later(() => {
      const final: Tally = {
        label,
        level,
        chips: breakdown.chips,
        mult: breakdown.mult,
        total: breakdown.score,
        chipsPulse,
        multPulse,
      };
      setTally(final);
      setLastTally(final);
      sfxSlam();
    }, t);

    t += BEAT.apply;
    later(() => {
      setScore(total);
      sfxWin();
      if (detected.type === 'STRAIGHT_FLUSH' || detected.type === 'ROYAL_FLUSH') {
        unlock('roi-du-bluff');
        juice.rain(70);
      }
    }, t);

    t += BEAT.clear;
    later(() => {
      setPlayed([]);
      setScoringIds([]);
      setTally(null);

      if (total >= config.target) {
        const bonus = remainingHands * UNUSED_HAND_BONUS;
        setReward(config.reward + bonus);
        recordStat('meilleurAntePoker', ante, 'max');
        if (pureRound) unlock('main-de-fer');
        juice.rain(50);
        later(() => setPhase('gain'), 420);
        return;
      }

      if (remainingHands === 0) {
        sfxLose();
        juice.shake();
        later(() => setPhase('echec'), 520);
        return;
      }

      const refilled = drawTo(kept);
      refilled.slice(kept.length).forEach((_, i) => sfxCardDeal(i));
      setHand(refilled);
      setBusy(false);
    }, t);
  };

  const discard = () => {
    if (busy || selectedCards.length === 0 || discardsLeft === 0) return;
    sfxButton();
    setPureRound(false);
    setDiscardsLeft((d) => d - 1);
    const kept = hand.filter((c) => !selected.includes(c.id));
    const refilled = drawTo(kept);
    setDiscarding(true);
    refilled.slice(kept.length).forEach((_, i) => sfxCardDeal(i + 2));
    setHand(refilled);
    setSelected([]);
    window.setTimeout(() => setDiscarding(false), 400);
  };

  const spendExtraDiscard = () => {
    if (!consumeItem('extraDiscard')) return;
    sfxChip();
    setDiscardsLeft((d) => d + 1);
  };

  const armJokerCard = () => {
    if (jokerCardArmed || !consumeItem('jokerCard')) return;
    sfxChip();
    setJokerCardArmed(true);
  };

  const openShop = () => {
    const owned = new Set(jokers);
    const pool = JOKERS.filter((j) => !owned.has(j.id));
    setOffer(appRng.shuffle(pool).slice(0, SHOP_OFFER_SIZE));
    setPhase('boutique');
  };

  const buyJoker = (joker: Joker) => {
    if (jokers.length >= MAX_JOKERS) return;
    if (!withdraw(joker.price)) return;
    sfxChip();
    setJokers((prev) => [...prev, joker.id]);
    setOffer((prev) => prev.filter((j) => j.id !== joker.id));
  };

  const upgradeHand = (type: HandType) => {
    const cost = HAND_TABLE[type].upgradeCost * levels[type];
    if (!withdraw(cost)) return;
    sfxChip();
    setLevels((prev) => ({ ...prev, [type]: prev[type] + 1 }));
  };

  const quitRun = () => {
    sfxButton();
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    setBusy(false);
    setPlayed([]);
    setTally(null);
    setPhase('accueil');
    setAnte(1);
    setScore(0);
    setJokers([]);
    setLevels(initialHandLevels());
  };

  const toggleSort = (mode: SortMode) => {
    sfxButton();
    setSortMode((current) => (current === mode ? null : mode));
  };

  /* -------------------------------------------------------------- clavier */

  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => undefined);
  keyHandler.current = (event: KeyboardEvent) => {
    if (phase !== 'jeu' || busy) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const index = Number.parseInt(event.key, 10);
    if (index >= 1 && index <= shownHand.length) {
      toggleCard(shownHand[index - 1].id);
      event.preventDefault();
    } else if (event.key === 'Enter') {
      playHand();
      event.preventDefault();
    } else if (event.key.toLowerCase() === 'd') {
      discard();
    }
  };

  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  /* ---------------------------------------------------------------- écrans */

  if (phase === 'accueil') {
    const cfg = anteConfig(1);
    return (
      <div className="shell poker-intro">
        <div className="panel poker-intro__panel">
          <p className="t-label">Table de poker</p>
          <h1 className="poker-intro__title">Poker Roguelike</h1>
          <p className="t-body poker-intro__lead">
            Chaque manche te donne 8 cartes, 4 mains à jouer et 3 défausses pour atteindre un score
            cible. Entre deux manches, la boutique vend des jokers et des améliorations de mains.
            Tant que tu passes, tu montes d&apos;ante et les cibles grimpent.
          </p>
          <div className="plaques">
            <Plaque label="Droit d'entrée" value={formatMoney(cfg.buyIn)} />
            <Plaque label="Score à battre" value={cfg.target.toLocaleString('fr-FR')} />
            <Plaque label="Récompense" value={formatMoney(cfg.reward)} accent />
          </div>
          <div className="formula" aria-label="Score égal jetons fois multiplicateur">
            <span className="formula__chips">Jetons</span>
            <span className="formula__x">x</span>
            <span className="formula__mult">Mult</span>
            <span className="formula__eq">=</span>
            <span className="formula__score">Score</span>
          </div>
          <button
            type="button"
            className="btn btn--lg btn--wide"
            disabled={bank < cfg.buyIn}
            onClick={startRun}
          >
            {bank < cfg.buyIn
              ? 'Banque insuffisante'
              : `Payer le buy-in (${formatMoney(cfg.buyIn)})`}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'boutique') {
    const next = anteConfig(ante + 1);
    return (
      <div className="shell poker-shop">
        <header className="poker-shop__head">
          <div>
            <p className="t-label">Boutique de manche</p>
            <h1 className="poker-shop__title">Ante {ante} validée</h1>
            <p className="t-body t-muted">
              Prochaine cible : <span className="t-brass num">{next.target}</span> points pour{' '}
              <span className="num">{formatMoney(next.buyIn)}</span> de buy-in.
            </p>
          </div>
          <div className="poker-shop__cta">
            <button
              type="button"
              className="btn btn--lg"
              disabled={bank < next.buyIn}
              onClick={() => {
                sfxButton();
                beginRound(ante + 1);
              }}
            >
              Ante {ante + 1} ({formatMoney(next.buyIn)})
            </button>
            <button type="button" className="link-btn" onClick={quitRun}>
              Quitter la run
            </button>
          </div>
        </header>

        <section className="shop-section">
          <h2 className="engraved">
            Jokers à vendre
            <span className="engraved__count num">
              {jokers.length} / {MAX_JOKERS} emplacements
            </span>
          </h2>
          <div className="shop-jokers">
            {offer.length === 0 ? (
              <p className="t-body t-muted">Le stock est vide pour cette fois.</p>
            ) : (
              offer.map((joker) => (
                <article key={joker.id} className="shop-joker">
                  <JokerCard joker={joker} />
                  <div className="shop-joker__info">
                    <p className="t-body">{joker.description}</p>
                    <button
                      type="button"
                      className="btn btn--sm"
                      disabled={bank < joker.price || jokers.length >= MAX_JOKERS}
                      onClick={() => buyJoker(joker)}
                    >
                      Acheter {formatMoney(joker.price)}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
          {jokers.length > 0 ? (
            <div className="shop-owned">
              <span className="t-label">Ta main de jokers</span>
              <div className="shop-owned__row">
                {jokers.map((id) => {
                  const joker = findJoker(id);
                  return joker ? <JokerCard key={id} joker={joker} size="sm" tooltip /> : null;
                })}
              </div>
            </div>
          ) : null}
        </section>

        <section className="shop-section">
          <h2 className="engraved">Niveaux de mains</h2>
          <ul className="levels">
            {UPGRADABLE.map((type) => {
              const level = levels[type];
              const leveled = handAtLevel(type, level);
              const cost = HAND_TABLE[type].upgradeCost * level;
              return (
                <li key={type} className="levels__row">
                  <span className="levels__name">{HAND_TABLE[type].label}</span>
                  <span className="badge">Niv {level}</span>
                  <span className="levels__calc num">
                    <span className="t-chips">{leveled.chips}</span>
                    <span className="t-muted"> x </span>
                    <span className="t-mult">{leveled.mult}</span>
                  </span>
                  <span className="levels__gain t-muted">
                    +{HAND_TABLE[type].chipsPerLevel} / +{HAND_TABLE[type].multPerLevel}
                  </span>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    disabled={bank < cost}
                    onClick={() => upgradeHand(type)}
                  >
                    {formatMoney(cost)}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    );
  }

  if (phase === 'echec') {
    return (
      <div className="shell poker-intro">
        <div className="panel poker-intro__panel poker-intro__panel--fail">
          <Sprite name="skull" size={72} title="Run terminée" />
          <h1 className="poker-intro__title">Run terminée</h1>
          <p className="t-body t-muted">
            Tombé à l&apos;ante {ante} avec <span className="num t-brass">{score}</span> points sur{' '}
            <span className="num">{config.target}</span>. Le buy-in reste au casino.
          </p>
          <button type="button" className="btn btn--lg btn--wide" onClick={quitRun}>
            Retour au comptoir
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- table jeu */

  const display = tally ?? preview ?? lastTally;
  const isLive = tally !== null;
  const isPreview = !tally && preview !== null;
  const bubblesFor = (anchor: string) => bubbles.filter((b) => b.anchor === anchor);

  return (
    <div className="game poker">
      <aside className="poker-side" aria-label="Tableau de score">
        <div className="side-ante">
          <div className="side-ante__badge">
            <span className="t-label">Ante</span>
            <span className="side-ante__num num">{ante}</span>
          </div>
          <dl className="side-ante__facts">
            <div>
              <dt className="t-label">Objectif</dt>
              <dd className="num">{config.target.toLocaleString('fr-FR')}</dd>
            </div>
            <div>
              <dt className="t-label">Récompense</dt>
              <dd className="num t-brass">{formatMoney(config.reward)}</dd>
            </div>
          </dl>
        </div>

        <div className="side-score">
          <span className="t-label">Score de la manche</span>
          <span className="side-score__value num">
            <Counter value={score} />
            <span className="side-score__target"> / {config.target.toLocaleString('fr-FR')}</span>
          </span>
          <div className="meter">
            <div
              className={`meter__fill${progress < 60 ? ' meter__fill--warn' : ''}`}
              style={{ width: `${progress}%` }}
            />
            <span className="meter__label">{Math.round(progress)} %</span>
          </div>
        </div>

        <div
          className={`side-hand${isLive ? ' is-live' : ''}${!display ? ' is-empty' : ''}`}
          aria-live="polite"
        >
          <div className="side-hand__head">
            <span className="side-hand__label">
              {display ? display.label : 'Choisis tes cartes'}
            </span>
            {display ? <span className="badge">Niv {display.level}</span> : null}
          </div>
          <div className="calc">
            <span className="calc__box calc__box--chips">
              <span
                className={display && display.chipsPulse ? 'pop' : undefined}
                key={display?.chipsPulse}
              >
                {display ? display.chips : 0}
              </span>
            </span>
            <span className="calc__x" aria-label="fois">
              x
            </span>
            <span className="calc__box calc__box--mult">
              <span
                className={display && display.multPulse ? 'pop' : undefined}
                key={display?.multPulse}
              >
                {display ? formatMult(display.mult) : 0}
              </span>
            </span>
          </div>
          <div className="side-hand__total">
            {display && display.total !== null ? (
              <span className="side-hand__result num" key={display.total}>
                {display.total.toLocaleString('fr-FR')}
              </span>
            ) : (
              <span className="t-muted t-small">
                {isLive
                  ? 'Décompte…'
                  : isPreview
                    ? 'Aperçu de base, hors jokers'
                    : 'Jusqu’à 5 cartes'}
              </span>
            )}
          </div>
        </div>

        <div className="side-counters">
          <div className="side-counter side-counter--hands">
            <span className="side-counter__num num">{handsLeft}</span>
            <span className="t-label">Mains</span>
          </div>
          <div className="side-counter side-counter--discards">
            <span className="side-counter__num num">{discardsLeft}</span>
            <span className="t-label">Défausses</span>
          </div>
        </div>

        <div className="side-items">
          <button
            type="button"
            className={`item-btn${jokerCardArmed ? ' is-armed' : ''}`}
            disabled={(inventory.jokerCard === 0 && !jokerCardArmed) || jokerCardArmed || busy}
            onClick={armJokerCard}
          >
            <span className="item-btn__name">Carte Joker</span>
            <span className="item-btn__meta">
              {jokerCardArmed ? 'Armée : x1,5' : `x${inventory.jokerCard}`}
            </span>
            {bubblesFor('item:jokerCard').map((b) => (
              <span key={b.id} className={`bubble bubble--${b.kind}`}>
                {b.text}
              </span>
            ))}
          </button>
          <button
            type="button"
            className="item-btn"
            disabled={inventory.extraDiscard === 0 || busy}
            onClick={spendExtraDiscard}
          >
            <span className="item-btn__name">
              Défausse<span className="item-btn__long"> extra</span>
              <span className="item-btn__short"> +1</span>
            </span>
            <span className="item-btn__meta">x{inventory.extraDiscard}</span>
          </button>
        </div>

        <button
          type="button"
          className="link-btn link-btn--danger side-quit"
          onClick={quitRun}
          disabled={busy}
        >
          Abandonner<span className="side-quit__more"> la run</span>
        </button>
      </aside>

      <section className="poker-table">
        <div className="joker-rail" aria-label="Jokers équipés">
          {Array.from({ length: MAX_JOKERS }, (_, i) => {
            const joker = jokers[i] ? findJoker(jokers[i]) : undefined;
            return (
              <div key={i} className={`joker-slot${joker ? '' : ' joker-slot--empty'}`}>
                {joker ? (
                  <>
                    <JokerCard
                      joker={joker}
                      size="sm"
                      tooltip
                      pulse={pulses[`joker:${joker.id}`] ?? 0}
                    />
                    {bubblesFor(`joker:${joker.id}`).map((b) => (
                      <span key={b.id} className={`bubble bubble--${b.kind}`}>
                        {b.text}
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="joker-slot__hint">{i === 0 ? 'Jokers' : ''}</span>
                )}
              </div>
            );
          })}
        </div>

        <LayoutGroup>
          <div className="play-zone">
            {played.length === 0 ? (
              <p className="play-zone__hint">
                {busy ? '' : 'Sélectionne jusqu’à 5 cartes, puis joue ta main'}
              </p>
            ) : null}
            <div className="play-zone__cards">
              <AnimatePresence>
                {played.map((card) => (
                  <motion.div
                    key={card.id}
                    layoutId={card.id}
                    className="play-slot"
                    exit={{ opacity: 0, y: -50, scale: 0.92, transition: { duration: 0.22 } }}
                    transition={{ type: 'spring', duration: 0.45, bounce: 0.2 }}
                  >
                    <PlayingCard
                      card={card}
                      size="lg"
                      tilt={0}
                      scoring={scoringIds.includes(card.id)}
                      dimmed={tally !== null && !scoringIds.includes(card.id)}
                      pulse={pulses[card.id] ?? 0}
                    />
                    {bubblesFor(card.id).map((b) => (
                      <span key={b.id} className={`bubble bubble--${b.kind}`}>
                        {b.text}
                      </span>
                    ))}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {tally && tally.total !== null ? (
              <div className="play-zone__total" key={tally.total}>
                <span className="num">+{tally.total.toLocaleString('fr-FR')}</span>
              </div>
            ) : null}
          </div>

          <div className="hand-zone">
            <div
              className={`hand-fan${discarding ? ' is-discarding' : ''}`}
              style={{ '--n': shownHand.length } as CSSProperties}
            >
              <AnimatePresence initial mode="popLayout" custom={discarding}>
                {shownHand.map((card, i) => {
                  const mid = (shownHand.length - 1) / 2;
                  const offset = i - mid;
                  const isSelected = selected.includes(card.id);
                  return (
                    <motion.div
                      key={card.id}
                      layoutId={card.id}
                      className="fan-slot"
                      custom={discarding}
                      variants={FAN_VARIANTS}
                      initial="dealt"
                      animate="held"
                      exit="gone"
                      transition={{
                        type: 'spring',
                        duration: 0.5,
                        bounce: 0.18,
                        delay: Math.min(i, 8) * 0.045,
                      }}
                      style={
                        {
                          '--fan-o': offset,
                          '--fan-o2': offset * offset,
                          '--i': i,
                        } as CSSProperties
                      }
                    >
                      <div className="fan-pose">
                        <PlayingCard
                          card={card}
                          size="lg"
                          tilt={0}
                          selected={isSelected}
                          onClick={() => toggleCard(card.id)}
                          disabled={busy || (!isSelected && selected.length >= MAX_SELECTED)}
                        />
                        <span className="fan-key" aria-hidden="true">
                          {i + 1}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </LayoutGroup>

        <div className="poker-actions">
          <button
            type="button"
            className="btn btn--lg poker-actions__play"
            disabled={busy || selectedCards.length === 0 || handsLeft === 0}
            onClick={playHand}
          >
            Jouer la main <span className="kbd">Entrée</span>
          </button>
          <div className="sort-toggle" role="group" aria-label="Trier la main">
            <span className="t-label">Trier</span>
            <button
              type="button"
              className={`sort-toggle__btn${sortMode === 'rang' ? ' is-on' : ''}`}
              aria-pressed={sortMode === 'rang'}
              onClick={() => toggleSort('rang')}
            >
              Rang
            </button>
            <button
              type="button"
              className={`sort-toggle__btn${sortMode === 'couleur' ? ' is-on' : ''}`}
              aria-pressed={sortMode === 'couleur'}
              onClick={() => toggleSort('couleur')}
            >
              Couleur
            </button>
          </div>
          <button
            type="button"
            className="btn btn--danger btn--lg poker-actions__discard"
            disabled={busy || selectedCards.length === 0 || discardsLeft === 0}
            onClick={discard}
          >
            Défausser ({discardsLeft}) <span className="kbd">D</span>
          </button>
          <div className="deck-pile" aria-label={`${deckRef.current.length} cartes dans le paquet`}>
            <span className="deck-pile__stack" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="deck-pile__count num">{deckRef.current.length}</span>
          </div>
        </div>
      </section>

      {phase === 'gain' ? (
        <RoundEnd
          amount={reward}
          title={`Ante ${ante} validée`}
          detail={`${score} points sur ${config.target} demandés.`}
          onDone={openShop}
        />
      ) : null}
    </div>
  );
}

function Plaque({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="plaque">
      <span className="t-label">{label}</span>
      <span className={`plaque__value num${accent ? ' t-brass' : ''}`}>{value}</span>
    </div>
  );
}
