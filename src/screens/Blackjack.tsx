import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Card, createShoe } from '../engine/cards';
import {
  canSplit,
  dealerShouldHit,
  handValue,
  isBlackjack,
  perfectPair,
  settle,
} from '../engine/blackjack';
import { formatMoney } from '../engine/economy';
import { ITEMS } from '../engine/items';
import { appRng } from '../engine/appRng';
import { useCasino } from '../store/useCasino';
import { useJuice, useRoundActive } from '../store/useJuice';
import { sfxButton, sfxCardDeal, sfxCardFlip, sfxChip, sfxLose, sfxWin } from '../audio/sfx';
import { Chip, ChipStack, CHIP_VALUES } from '../components/Chip';
import { Counter } from '../components/Counter';
import { PlayingCard } from '../components/PlayingCard';
import { RoundEnd } from '../components/RoundEnd';
import { Sprite } from '../components/Sprite';

type Phase = 'mise' | 'joueur' | 'croupier' | 'fin';

interface PlayerHand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  done: boolean;
}

const SIDE_BET = 10;
const MIN_BET = 5;
const RESHUFFLE_AT = 24;

const PAIR_LABEL: Record<string, string> = {
  mixed: 'Paire mixte',
  colored: 'Paire de même couleur',
  perfect: 'Paire parfaite',
};

export interface BlackjackProps {
  onOpenShop: () => void;
}

export function Blackjack({ onOpenShop }: BlackjackProps) {
  const bank = useCasino((s) => s.bank);
  const inventory = useCasino((s) => s.inventory);
  const withdraw = useCasino((s) => s.withdraw);
  const consumeItem = useCasino((s) => s.consumeItem);
  const unlock = useCasino((s) => s.unlock);
  const juice = useJuice();

  const shoeRef = useRef<Card[]>(createShoe(4, appRng));
  const [phase, setPhase] = useState<Phase>('mise');
  const [bet, setBet] = useState(25);
  const [sideBet, setSideBet] = useState(false);
  const [hands, setHands] = useState<PlayerHand[]>([]);
  const [active, setActive] = useState(0);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [holeRevealed, setHoleRevealed] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const [bustPending, setBustPending] = useState(false);
  const [sideBetResult, setSideBetResult] = useState<string | null>(null);
  const [result, setResult] = useState<{ amount: number; title: string; detail: string } | null>(
    null,
  );

  const draw = useCallback((): Card => {
    if (shoeRef.current.length < RESHUFFLE_AT) shoeRef.current = createShoe(4, appRng);
    return shoeRef.current.pop() as Card;
  }, []);

  const totalStake = bet + (sideBet ? SIDE_BET : 0);
  const canDeal = phase === 'mise' && bet >= MIN_BET && bank >= totalStake;

  const startRound = () => {
    if (!canDeal) return;
    if (!withdraw(totalStake)) return;

    const p1 = draw();
    const d1 = draw();
    const p2 = draw();
    const d2 = draw();
    [0, 1, 2, 3].forEach((i) => sfxCardDeal(i));

    const hand: PlayerHand = { cards: [p1, p2], bet, doubled: false, done: false };
    setHands([hand]);
    setDealer([d1, d2]);
    setActive(0);
    setHoleRevealed(false);
    setPeeked(false);
    setBustPending(false);
    setResult(null);

    // Le pari secondaire se règle immédiatement, avant toute décision.
    if (sideBet) {
      const pair = perfectPair(hand.cards);
      setSideBetResult(
        pair.payout > 0
          ? `${PAIR_LABEL[pair.kind]} : ${formatMoney(SIDE_BET * pair.payout)}`
          : 'Perfect Pairs : manqué',
      );
      if (pair.payout > 0) sfxWin();
    } else {
      setSideBetResult(null);
    }

    if (isBlackjack(hand.cards)) {
      setHands([{ ...hand, done: true }]);
      window.setTimeout(() => runDealer([{ ...hand, done: true }], [d1, d2]), 520);
      setPhase('croupier');
    } else {
      setPhase('joueur');
    }
  };

  /** Règle toutes les mains une fois que le croupier a fini de tirer. */
  const finishRound = useCallback(
    (finalHands: PlayerHand[], finalDealer: Card[]) => {
      let total = 0;
      const lines: string[] = [];

      finalHands.forEach((hand, index) => {
        const outcome = settle(hand.cards, finalDealer, hand.bet);
        total += outcome.payout;
        const label = finalHands.length > 1 ? `Main ${index + 1} : ` : '';
        const value = handValue(hand.cards).total;
        lines.push(
          `${label}${value} contre ${handValue(finalDealer).total} : ${
            outcome.outcome === 'blackjack'
              ? 'blackjack'
              : outcome.outcome === 'win'
                ? 'gagné'
                : outcome.outcome === 'push'
                  ? 'égalité'
                  : 'perdu'
          }`,
        );

        if (outcome.outcome === 'lose' && value === 20 && handValue(finalDealer).total === 21) {
          unlock('poissard-legendaire');
        }
      });

      // Assurance : le bouclier ne se consomme que s'il sert vraiment.
      if (isBlackjack(finalDealer) && inventory.shield > 0 && consumeItem('shield')) {
        const refund = Math.floor(finalHands[0].bet * 0.5);
        total += refund;
        lines.push(`Insurance Shield : ${formatMoney(refund)} remboursés`);
      }

      if (sideBet) {
        const pair = perfectPair(finalHands[0].cards.slice(0, 2));
        if (pair.payout > 0) {
          total += SIDE_BET * pair.payout;
          lines.push(`${PAIR_LABEL[pair.kind]} : x${pair.payout}`);
        }
      }

      setResult({
        amount: total,
        title: total > 0 ? 'La table paye' : 'La maison gagne',
        detail: lines.join(' · '),
      });
      setPhase('fin');
    },
    [consumeItem, inventory.shield, sideBet, unlock],
  );

  /** Le croupier retourne sa carte puis tire jusqu'à 17, une carte à la fois. */
  const runDealer = useCallback(
    (finalHands: PlayerHand[], startDealer: Card[]) => {
      setHoleRevealed(true);
      sfxCardFlip();

      const allBusted = finalHands.every((h) => handValue(h.cards).busted);
      const step = (current: Card[]) => {
        if (!allBusted && dealerShouldHit(current)) {
          window.setTimeout(() => {
            const next = [...current, draw()];
            sfxCardDeal();
            setDealer(next);
            step(next);
          }, 520);
        } else {
          window.setTimeout(() => finishRound(finalHands, current), 520);
        }
      };
      step(startDealer);
    },
    [draw, finishRound],
  );

  const advance = useCallback(
    (updated: PlayerHand[]) => {
      const nextIndex = updated.findIndex((h, i) => i >= active && !h.done);
      if (nextIndex === -1) {
        const remaining = updated.findIndex((h) => !h.done);
        if (remaining === -1) {
          setPhase('croupier');
          window.setTimeout(() => runDealer(updated, dealer), 420);
          return;
        }
        setActive(remaining);
        return;
      }
      setActive(nextIndex);
    },
    [active, dealer, runDealer],
  );

  const updateHand = (index: number, patch: Partial<PlayerHand>) =>
    setHands((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));

  const hit = () => {
    const hand = hands[active];
    if (!hand) return;
    const card = draw();
    sfxCardDeal();
    const cards = [...hand.cards, card];
    const busted = handValue(cards).busted;

    const updated = hands.map((h, i) => (i === active ? { ...h, cards, done: busted } : h));
    setHands(updated);

    if (busted) {
      // Le jeton Burn offre une porte de sortie : on suspend avant de valider.
      if (inventory.burn > 0) {
        setBustPending(true);
      } else {
        sfxLose();
        juice.shake();
        advance(updated);
      }
    }
  };

  const stand = () => {
    sfxButton();
    const updated = hands.map((h, i) => (i === active ? { ...h, done: true } : h));
    setHands(updated);
    advance(updated);
  };

  const double = () => {
    const hand = hands[active];
    if (!hand || !withdraw(hand.bet)) return;
    sfxChip();
    const card = draw();
    sfxCardDeal();
    const cards = [...hand.cards, card];
    const updated = hands.map((h, i) =>
      i === active ? { ...h, cards, bet: h.bet * 2, doubled: true, done: true } : h,
    );
    setHands(updated);
    if (handValue(cards).busted) {
      sfxLose();
      juice.shake();
    }
    advance(updated);
  };

  const split = () => {
    const hand = hands[active];
    if (!hand || !canSplit(hand.cards) || hands.length >= 4) return;
    if (!withdraw(hand.bet)) return;
    sfxChip();
    const left: PlayerHand = {
      cards: [hand.cards[0], draw()],
      bet: hand.bet,
      doubled: false,
      done: false,
    };
    const right: PlayerHand = {
      cards: [hand.cards[1], draw()],
      bet: hand.bet,
      doubled: false,
      done: false,
    };
    sfxCardDeal(0);
    sfxCardDeal(1);
    setHands((prev) => [...prev.slice(0, active), left, right, ...prev.slice(active + 1)]);
  };

  const useBurn = () => {
    if (!consumeItem('burn')) return;
    sfxCardFlip();
    const hand = hands[active];
    const cards = hand.cards.slice(0, -1);
    updateHand(active, { cards, done: false });
    setBustPending(false);
    unlock('nettoyage-de-printemps');
  };

  const acceptBust = () => {
    sfxLose();
    juice.shake();
    setBustPending(false);
    const updated = hands.map((h, i) => (i === active ? { ...h, done: true } : h));
    setHands(updated);
    advance(updated);
  };

  const usePeek = () => {
    if (peeked || !consumeItem('peek')) return;
    sfxCardFlip();
    setPeeked(true);
  };

  const resetTable = () => {
    setPhase('mise');
    setHands([]);
    setDealer([]);
    setResult(null);
    setSideBetResult(null);
    setBustPending(false);
  };

  useRoundActive(phase !== 'mise');

  const activeHand = hands[active];
  const dealerTotal = useMemo(
    () => (holeRevealed || peeked ? handValue(dealer).total : handValue(dealer.slice(0, 1)).total),
    [dealer, holeRevealed, peeked],
  );

  /* -------------------------------------------------------------- clavier */

  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => undefined);
  keyHandler.current = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || result) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return;
    const key = event.key.toLowerCase();
    if (phase === 'mise' && key === 'enter') {
      startRound();
      event.preventDefault();
      return;
    }
    if (phase !== 'joueur' || !activeHand || bustPending) return;
    if (key === 't') hit();
    else if (key === 'r') stand();
    else if (key === 'd' && activeHand.cards.length === 2 && bank >= activeHand.bet) double();
    else if (
      key === 's' &&
      canSplit(activeHand.cards) &&
      hands.length < 4 &&
      bank >= activeHand.bet
    )
      split();
  };

  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const dealerLabel =
    dealer.length === 0
      ? null
      : holeRevealed || peeked
        ? String(dealerTotal)
        : `${dealerTotal} + ?`;
  const dealerBust = holeRevealed && handValue(dealer).busted;

  return (
    <div className="game bj">
      <section className="bj-table" aria-label="Table de blackjack">
        <div className="bj-shoe" aria-hidden="true">
          <span className="bj-shoe__box">
            <span className="bj-shoe__card" />
          </span>
          <span className="bj-shoe__label">Sabot</span>
        </div>

        <div className="bj-seat bj-seat--dealer">
          <span className="seat-label">Croupier</span>
          <div className="bj-row">
            <div className="bj-cards">
              {dealer.map((card, i) => {
                const hidden = i === 1 && !holeRevealed && !peeked;
                return (
                  <PlayingCard
                    key={card.id}
                    card={card}
                    faceDown={hidden}
                    dealing
                    dealDelay={i === 0 ? 70 : i === 1 ? 210 : 0}
                    flipIn
                    flipDelay={(i === 0 ? 70 : i === 1 ? 210 : 0) + 260}
                    dimmed={i === 1 && !holeRevealed && peeked}
                  />
                );
              })}
            </div>
            {dealerLabel ? (
              <span className={`total-pill${dealerBust ? ' total-pill--bust' : ''}`}>
                {dealerBust ? `${dealerTotal} sauté` : dealerLabel}
              </span>
            ) : null}
          </div>
        </div>

        <svg
          className="bj-print"
          viewBox="0 0 800 220"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <path id="bj-arc-main" d="M 90 40 Q 400 210 710 40" />
            <path id="bj-arc-sub" d="M 150 78 Q 400 222 650 78" />
          </defs>
          <text className="bj-print__main">
            <textPath href="#bj-arc-main" startOffset="50%" textAnchor="middle">
              Le blackjack paye 3 pour 2
            </textPath>
          </text>
          <text className="bj-print__sub">
            <textPath href="#bj-arc-sub" startOffset="50%" textAnchor="middle">
              Le croupier tire jusqu’à 16 et reste à 17
            </textPath>
          </text>
        </svg>

        <div className="bj-seat bj-seat--player">
          {hands.length === 0 ? (
            <div className="bj-hand">
              <div className="bet-spot">
                {bet > 0 ? <ChipStack amount={bet} size="md" /> : null}
                <span className="bet-spot__ring" aria-hidden="true" />
              </div>
              <div className={`side-spot${sideBet ? ' is-on' : ''}`}>
                {sideBet ? <ChipStack amount={SIDE_BET} size="xs" /> : null}
                <span className="side-spot__label">PP</span>
              </div>
            </div>
          ) : (
            <div className="bj-hands">
              {hands.map((hand, index) => {
                const value = handValue(hand.cards);
                const isActive = index === active && phase === 'joueur';
                const natural = isBlackjack(hand.cards);
                return (
                  <div
                    key={index}
                    className={`bj-hand${isActive ? ' is-active' : ''}${value.busted ? ' is-bust' : ''}`}
                  >
                    <span className="seat-label">
                      {hands.length > 1 ? `Main ${index + 1}` : 'Toi'}
                      {hand.doubled ? ' · doublée' : ''}
                    </span>
                    <div className="bj-row">
                      <div className="bj-cards">
                        {hand.cards.map((card, i) => (
                          <PlayingCard
                            key={card.id}
                            card={card}
                            dealing
                            dealDelay={i < 2 && hands.length === 1 ? i * 280 : 0}
                            flipIn
                            flipDelay={(i < 2 && hands.length === 1 ? i * 280 : 0) + 260}
                          />
                        ))}
                      </div>
                      <span
                        className={`total-pill${value.busted ? ' total-pill--bust' : natural ? ' total-pill--bj' : ''}`}
                      >
                        {value.busted
                          ? `${value.total} sauté`
                          : natural
                            ? 'Blackjack'
                            : value.soft
                              ? `${value.total} souple`
                              : value.total}
                      </span>
                    </div>
                    <div className="bet-spot bet-spot--small">
                      <ChipStack amount={hand.bet} size="sm" />
                      <span className="bet-spot__ring" aria-hidden="true" />
                    </div>
                    <span className="sr-only">Mise {formatMoney(hand.bet)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {sideBetResult ? <p className="bj-sidebet-result">{sideBetResult}</p> : null}
        </div>
      </section>

      {/* Console du joueur : a droite sur grand ecran, collee en bas sur telephone. */}
      <aside className="panel bj-console" aria-label="Commandes de la table">
        {phase === 'mise' ? (
          <div className="bj-controls bj-controls--bet">
            <div className="bj-controls__bet">
              <div className="chip-rack">
                {CHIP_VALUES.map((value) => (
                  <Chip
                    key={value}
                    value={value}
                    size="lg"
                    disabled={bank < bet + value}
                    onClick={() => setBet((b) => b + value)}
                  />
                ))}
              </div>
              <div className="bj-controls__stake">
                <span className="t-label">Ta mise</span>
                <span className="led bj-controls__led">
                  <Counter value={bet} money />
                </span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    sfxButton();
                    setBet(MIN_BET);
                  }}
                >
                  Effacer
                </button>
              </div>
            </div>

            <label className="toggle">
              <input
                type="checkbox"
                checked={sideBet}
                onChange={(event) => setSideBet(event.target.checked)}
              />
              <span className="toggle__track" aria-hidden="true">
                <span className="toggle__thumb" />
              </span>
              <span className="toggle__text">
                <span className="toggle__title">Perfect Pairs · {formatMoney(SIDE_BET)}</span>
                <span className="toggle__hint">Paire mixte x6, même couleur x12, parfaite x25</span>
              </span>
            </label>

            <button
              type="button"
              className="btn btn--lg btn--wide"
              disabled={!canDeal}
              onClick={startRound}
            >
              {bank < totalStake
                ? 'Banque insuffisante'
                : `Distribuer (${formatMoney(totalStake)})`}
              <span className="kbd">Entrée</span>
            </button>
          </div>
        ) : null}

        {phase === 'joueur' && activeHand && !bustPending ? (
          <div className="bj-controls">
            <div className="bj-actions">
              <button type="button" className="btn btn--lg" onClick={hit}>
                Tirer <span className="kbd">T</span>
              </button>
              <button type="button" className="btn btn--lg btn--felt" onClick={stand}>
                Rester <span className="kbd">R</span>
              </button>
              <button
                type="button"
                className="btn btn--lg btn--ghost"
                onClick={double}
                disabled={activeHand.cards.length !== 2 || bank < activeHand.bet}
              >
                Doubler <span className="kbd">D</span>
              </button>
              <button
                type="button"
                className="btn btn--lg btn--ghost"
                onClick={split}
                disabled={!canSplit(activeHand.cards) || hands.length >= 4 || bank < activeHand.bet}
              >
                Splitter <span className="kbd">S</span>
              </button>
            </div>

            <div className="token-bar">
              <span className="t-label">Jetons d&apos;avantage</span>
              <div className="token-bar__row">
                <TokenButton
                  itemId="peek"
                  count={inventory.peek}
                  disabled={peeked}
                  onUse={usePeek}
                  onBuy={onOpenShop}
                />
                <TokenButton
                  itemId="shield"
                  count={inventory.shield}
                  disabled
                  hint="Se déclenche tout seul"
                  onUse={() => undefined}
                  onBuy={onOpenShop}
                />
                <TokenButton
                  itemId="burn"
                  count={inventory.burn}
                  disabled
                  hint="Si tu sautes"
                  onUse={() => undefined}
                  onBuy={onOpenShop}
                />
              </div>
            </div>
          </div>
        ) : null}

        {bustPending && activeHand ? (
          <div className="bj-controls bj-bust">
            <h2 className="bj-bust__title">Tu as sauté à {handValue(activeHand.cards).total}</h2>
            <p className="t-body">
              Le jeton Burn annule ta dernière carte et te remet dans la manche. Il t&apos;en reste{' '}
              {inventory.burn}.
            </p>
            <div className="bj-actions bj-actions--two">
              <button type="button" className="btn btn--lg" onClick={useBurn}>
                Brûler la dernière carte
              </button>
              <button type="button" className="btn btn--lg btn--danger" onClick={acceptBust}>
                Encaisser le coup
              </button>
            </div>
          </div>
        ) : null}

        {phase === 'croupier' || phase === 'fin' ? (
          <div className="bj-controls bj-waiting">
            <p className="bj-waiting__text">
              {phase === 'croupier' ? 'Le croupier joue sa main' : 'Le croupier règle la table'}
              <span className="dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </p>
          </div>
        ) : null}
      </aside>

      {result ? (
        <RoundEnd
          amount={result.amount}
          title={result.title}
          detail={result.detail}
          onDone={resetTable}
          continueLabel="Nouvelle main"
        />
      ) : null}
    </div>
  );
}

interface TokenButtonProps {
  itemId: 'peek' | 'burn' | 'shield';
  count: number;
  disabled?: boolean;
  hint?: string;
  onUse: () => void;
  onBuy: () => void;
}

function TokenButton({ itemId, count, disabled, hint, onUse, onBuy }: TokenButtonProps) {
  const item = ITEMS[itemId];
  if (count === 0) {
    return (
      <button type="button" className="token token--empty" onClick={onBuy}>
        <span className="token__coin" aria-hidden="true">
          <Sprite name="bag" size={20} />
        </span>
        <span className="token__text">
          <span className="token__name">{item.name}</span>
          <span className="token__meta">Acheter</span>
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`token${disabled ? ' token--passive' : ''}`}
      onClick={onUse}
      disabled={disabled}
      title={hint ?? item.short}
    >
      <span className="token__coin" aria-hidden="true">
        <Sprite name="chip" size={20} />
        <span className="token__count num">{count}</span>
      </span>
      <span className="token__text">
        <span className="token__name">{item.name}</span>
        <span className="token__meta">{hint ?? 'Utiliser'}</span>
      </span>
    </button>
  );
}
