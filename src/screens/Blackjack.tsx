import { useCallback, useMemo, useRef, useState } from 'react';
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
import { Chip, CHIP_VALUES } from '../components/Chip';
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
          `${label}${value} contre ${handValue(finalDealer).total} - ${
            outcome.outcome === 'blackjack'
              ? 'Blackjack'
              : outcome.outcome === 'win'
                ? 'gagne'
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
        lines.push(`Insurance Shield : ${formatMoney(refund)} rembourses`);
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
        title: total > 0 ? 'MANCHE REMPORTEE' : 'MANCHE PERDUE',
        detail: lines.join(' | '),
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

  return (
    <div className="shell col" style={{ gap: 'var(--u4)' }}>
      <div className="table-felt col" style={{ gap: 'var(--u5)' }}>
        {/* Croupier */}
        <div className="seat">
          <span className="seat__label">CROUPIER</span>
          <div className="hand hand--tight">
            {dealer.length === 0 ? (
              <p className="t-body t-muted">Table libre.</p>
            ) : (
              dealer.map((card, i) => (
                <PlayingCard
                  key={`${card.id}-${i === 1 && !holeRevealed && !peeked ? 'down' : 'up'}`}
                  card={card}
                  faceDown={i === 1 && !holeRevealed && !peeked}
                  dealing
                  dealDelay={i * 70}
                  dimmed={i === 1 && !holeRevealed && peeked}
                />
              ))
            )}
          </div>
          {dealer.length > 0 ? (
            <span className="led" style={{ fontSize: 20 }}>
              {holeRevealed || peeked ? dealerTotal : `${dealerTotal} + ?`}
            </span>
          ) : null}
        </div>

        <div className="bj-divider" aria-hidden="true" />

        {/* Joueur */}
        <div className="bj-hands">
          {hands.length === 0 ? (
            <div className="seat">
              <span className="seat__label">TOI</span>
              <p className="t-body t-muted">Pose ta mise pour lancer la distribution.</p>
            </div>
          ) : (
            hands.map((hand, index) => {
              const value = handValue(hand.cards);
              const isActive = index === active && phase === 'joueur';
              return (
                <div key={index} className={`seat bj-seat${isActive ? ' bj-seat--active' : ''}`}>
                  <span className="seat__label">
                    {hands.length > 1 ? `MAIN ${index + 1}` : 'TOI'}
                    {hand.doubled ? ' - DOUBLEE' : ''}
                  </span>
                  <div className="hand hand--tight">
                    {hand.cards.map((card, i) => (
                      <PlayingCard key={card.id} card={card} dealing dealDelay={i * 70} />
                    ))}
                  </div>
                  <span
                    className={`led${value.busted ? ' led--red' : isBlackjack(hand.cards) ? ' led--green' : ''}`}
                    style={{ fontSize: 20 }}
                  >
                    {value.busted
                      ? `${value.total} SAUTE`
                      : value.soft
                        ? `${value.total} souple`
                        : value.total}
                  </span>
                  <span className="badge">MISE {formatMoney(hand.bet)}</span>
                </div>
              );
            })
          )}
        </div>

        {sideBetResult ? <p className="t-body t-brass center">{sideBetResult}</p> : null}
      </div>

      {/* Barre d'actions */}
      {phase === 'mise' ? (
        <div className="panel col">
          <h2 className="panel__title">TA MISE</h2>
          <div className="row row--between row--wrap">
            <div className="chip-rack">
              {CHIP_VALUES.map((value) => (
                <Chip
                  key={value}
                  value={value}
                  disabled={bank < bet + value}
                  onClick={() => setBet((b) => b + value)}
                />
              ))}
            </div>
            <div className="row">
              <span className="led" style={{ fontSize: 24, minWidth: 120, textAlign: 'right' }}>
                {formatMoney(bet)}
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setBet(MIN_BET)}
              >
                Effacer
              </button>
            </div>
          </div>

          <label className="bj-sidebet">
            <input
              type="checkbox"
              checked={sideBet}
              onChange={(event) => setSideBet(event.target.checked)}
            />
            <span className="t-body">
              Perfect Pairs pour {formatMoney(SIDE_BET)} : paire mixte x6, même couleur x12,
              parfaite x25
            </span>
          </label>

          <button
            type="button"
            className="btn btn--lg btn--wide"
            disabled={!canDeal}
            onClick={startRound}
          >
            {bank < totalStake ? 'Banque insuffisante' : `Distribuer (${formatMoney(totalStake)})`}
          </button>
        </div>
      ) : null}

      {phase === 'joueur' && activeHand && !bustPending ? (
        <div className="panel col">
          <div className="row row--wrap">
            <button type="button" className="btn grow" onClick={hit}>
              Tirer
            </button>
            <button type="button" className="btn btn--ghost grow" onClick={stand}>
              Rester
            </button>
            <button
              type="button"
              className="btn btn--ghost grow"
              onClick={double}
              disabled={activeHand.cards.length !== 2 || bank < activeHand.bet}
            >
              Doubler
            </button>
            <button
              type="button"
              className="btn btn--ghost grow"
              onClick={split}
              disabled={!canSplit(activeHand.cards) || hands.length >= 4 || bank < activeHand.bet}
            >
              Splitter
            </button>
          </div>

          <div className="row row--wrap token-bar">
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
              hint="Disponible si tu sautes"
              onUse={() => undefined}
              onBuy={onOpenShop}
            />
          </div>
        </div>
      ) : null}

      {bustPending && activeHand ? (
        <div className="panel col bj-bust">
          <h2 className="panel__title t-perte">
            TU AS SAUTE A {handValue(activeHand.cards).total}
          </h2>
          <p className="t-body">
            Le jeton Burn annule ta dernière carte et te remet dans la manche. Il t&apos;en reste{' '}
            {inventory.burn}.
          </p>
          <div className="row">
            <button type="button" className="btn grow" onClick={useBurn}>
              Bruler la dernière carte
            </button>
            <button type="button" className="btn btn--danger grow" onClick={acceptBust}>
              Encaisser le coup
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'croupier' ? (
        <div className="panel center">
          <p className="t-body t-muted blink">Le croupier joue sa main...</p>
        </div>
      ) : null}

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
      <button type="button" className="btn btn--ghost btn--sm grow" onClick={onBuy}>
        <Sprite name="bag" size={14} />
        {item.name} : acheter
      </button>
    );
  }
  return (
    <button
      type="button"
      className="btn btn--sm grow"
      onClick={onUse}
      disabled={disabled}
      title={hint ?? item.short}
    >
      <Sprite name="chip" size={14} />
      {item.name} x{count}
      {hint ? ` - ${hint}` : ''}
    </button>
  );
}
