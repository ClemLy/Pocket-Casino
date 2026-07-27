import { useCallback, useMemo, useRef, useState } from 'react';
import { type Card, createDeck } from '../engine/cards';
import { formatMoney } from '../engine/economy';
import { applyJokers, findJoker, JOKERS, RARITY_LABEL, type Joker } from '../engine/jokers';
import {
  detectHand,
  HAND_TABLE,
  handAtLevel,
  type HandLevels,
  type HandType,
  initialHandLevels,
  scoreHand,
  type ScoreBreakdown,
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
import { sfxButton, sfxCardDeal, sfxChip, sfxLose, sfxWin } from '../audio/sfx';
import { PlayingCard } from '../components/PlayingCard';
import { RoundEnd } from '../components/RoundEnd';
import { Sprite } from '../components/Sprite';

type Phase = 'accueil' | 'jeu' | 'gain' | 'boutique' | 'echec';

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

export function PokerRun() {
  const bank = useCasino((s) => s.bank);
  const inventory = useCasino((s) => s.inventory);
  const withdraw = useCasino((s) => s.withdraw);
  const consumeItem = useCasino((s) => s.consumeItem);
  const unlock = useCasino((s) => s.unlock);
  const recordStat = useCasino((s) => s.recordStat);
  const juice = useJuice();

  const deckRef = useRef<Card[]>([]);
  const [phase, setPhase] = useState<Phase>('accueil');
  const [ante, setAnte] = useState(1);
  const [score, setScore] = useState(0);
  const [handsLeft, setHandsLeft] = useState(0);
  const [discardsLeft, setDiscardsLeft] = useState(0);
  const [hand, setHand] = useState<Card[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [jokers, setJokers] = useState<string[]>([]);
  const [levels, setLevels] = useState<HandLevels>(initialHandLevels());
  const [jokerCardArmed, setJokerCardArmed] = useState(false);
  const [lastPlay, setLastPlay] = useState<ScoreBreakdown | null>(null);
  const [pureRound, setPureRound] = useState(true);
  const [offer, setOffer] = useState<Joker[]>([]);
  const [reward, setReward] = useState(0);

  useRoundActive(phase === 'jeu' || phase === 'gain');

  const config = useMemo(() => anteConfig(ante), [ante]);
  const progress = Math.min(100, (score / config.target) * 100);

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
      setSelected([]);
      setLastPlay(null);
      setPureRound(true);
      setJokerCardArmed(false);
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

  const toggleCard = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= MAX_SELECTED) return prev;
      sfxChip();
      return [...prev, id];
    });
  };

  const selectedCards = useMemo(
    () => hand.filter((c) => selected.includes(c.id)),
    [hand, selected],
  );

  /** Aperçu en direct de la combinaison en cours de sélection. */
  const preview = useMemo(() => {
    if (selectedCards.length === 0) return null;
    const detected = detectHand(selectedCards);
    const leveled = handAtLevel(detected.type, levels[detected.type]);
    return { type: detected.type, ...leveled };
  }, [selectedCards, levels]);

  const playHand = () => {
    if (selectedCards.length === 0 || handsLeft === 0) return;

    const detected = detectHand(selectedCards);
    const aggregated = applyJokers(jokers, {
      handType: detected.type,
      scoring: detected.scoring,
      played: selectedCards,
      discardsLeft,
      handsLeft,
      rng: appRng,
    });

    const notes = [...aggregated.notes];
    let xMult = aggregated.xMult;
    if (jokerCardArmed) {
      xMult *= 1.5;
      notes.push('Carte Joker x1.5');
      setJokerCardArmed(false);
    }

    const breakdown = scoreHand(selectedCards, levels, {
      chips: aggregated.chips,
      mult: aggregated.mult,
      xMult,
      notes,
    });

    const total = score + breakdown.score;
    setLastPlay(breakdown);
    setScore(total);
    recordStat('mainsDePoker', 1);
    sfxWin();

    if (detected.type === 'STRAIGHT_FLUSH' || detected.type === 'ROYAL_FLUSH') {
      unlock('roi-du-bluff');
      juice.rain(70);
    }

    const remainingHands = handsLeft - 1;
    setHandsLeft(remainingHands);

    const kept = hand.filter((c) => !selected.includes(c.id));
    setHand(drawTo(kept));
    setSelected([]);

    if (total >= config.target) {
      const bonus = remainingHands * UNUSED_HAND_BONUS;
      const won = config.reward + bonus;
      setReward(won);
      recordStat('meilleurAntePoker', ante, 'max');
      if (pureRound) unlock('main-de-fer');
      juice.rain(50);
      window.setTimeout(() => setPhase('gain'), 700);
    } else if (remainingHands === 0) {
      sfxLose();
      juice.shake();
      window.setTimeout(() => setPhase('echec'), 700);
    }
  };

  const discard = () => {
    if (selectedCards.length === 0 || discardsLeft === 0) return;
    sfxButton();
    setPureRound(false);
    setDiscardsLeft((d) => d - 1);
    const kept = hand.filter((c) => !selected.includes(c.id));
    const refilled = drawTo(kept);
    refilled.slice(kept.length).forEach((_, i) => sfxCardDeal(i));
    setHand(refilled);
    setSelected([]);
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
    if (jokers.length >= 5) return;
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
    setPhase('accueil');
    setAnte(1);
    setScore(0);
    setJokers([]);
    setLevels(initialHandLevels());
  };

  /* ---------------------------------------------------------------- écrans */

  if (phase === 'accueil') {
    const cfg = anteConfig(1);
    return (
      <div className="shell col" style={{ gap: 'var(--u4)' }}>
        <div className="panel col">
          <h2 className="panel__title">POKER ROGUELIKE</h2>
          <p className="t-body">
            Chaque manche te donne 8 cartes, 4 mains à jouer et 3 défausses pour atteindre un score
            cible. Entre deux manches, la boutique vend des jokers et des ameliorations de mains.
            Tant que tu passes, tu montes d&apos;ante et les cibles grimpent.
          </p>
          <div className="tile-grid">
            <InfoTile label="Droit d'entrée" value={formatMoney(cfg.buyIn)} />
            <InfoTile label="Score a battre" value={String(cfg.target)} />
            <InfoTile label="Récompense" value={formatMoney(cfg.reward)} />
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
    return (
      <div className="shell col" style={{ gap: 'var(--u4)' }}>
        <div className="panel col">
          <h2 className="panel__title">BOUTIQUE DE MANCHE - ANTE {ante} VALIDE</h2>
          <p className="t-body t-muted">
            Prochaine cible : {anteConfig(ante + 1).target} points pour{' '}
            {formatMoney(anteConfig(ante + 1).buyIn)} de buy-in.
          </p>

          <h3 className="t-label">Jokers ({jokers.length} sur 5 emplacements)</h3>
          <div className="tile-grid">
            {offer.length === 0 ? (
              <p className="t-body t-muted">Le stock est vide pour cette fois.</p>
            ) : (
              offer.map((joker) => (
                <div key={joker.id} className="tile tile--gold">
                  <div className="tile__head">
                    <Sprite name="spade" size={20} palette={{ a: 'var(--brass-500)' }} />
                    <span className="tile__name">{joker.name}</span>
                  </div>
                  <p className="tile__desc">{joker.description}</p>
                  <div className="tile__foot">
                    <span
                      className={`badge badge--${joker.rarity === 'legendaire' ? 'gold' : 'green'}`}
                    >
                      {RARITY_LABEL[joker.rarity]}
                    </span>
                    <button
                      type="button"
                      className="btn btn--sm"
                      disabled={bank < joker.price || jokers.length >= 5}
                      onClick={() => buyJoker(joker)}
                    >
                      {formatMoney(joker.price)}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <h3 className="t-label">Niveaux de mains</h3>
          <div className="tile-grid">
            {UPGRADABLE.map((type) => {
              const level = levels[type];
              const leveled = handAtLevel(type, level);
              const cost = HAND_TABLE[type].upgradeCost * level;
              return (
                <div key={type} className="tile">
                  <div className="tile__head">
                    <span className="tile__name">{HAND_TABLE[type].label}</span>
                    <span className="badge">NIV {level}</span>
                  </div>
                  <p className="score-line">
                    <span className="score-line__chips">{leveled.chips}</span>
                    <span className="score-line__x">x</span>
                    <span className="score-line__mult">{leveled.mult}</span>
                  </p>
                  <div className="tile__foot">
                    <span className="t-body t-muted">
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
                  </div>
                </div>
              );
            })}
          </div>

          <div className="row row--wrap">
            <button
              type="button"
              className="btn btn--lg grow"
              disabled={bank < anteConfig(ante + 1).buyIn}
              onClick={() => {
                sfxButton();
                beginRound(ante + 1);
              }}
            >
              Ante {ante + 1} ({formatMoney(anteConfig(ante + 1).buyIn)})
            </button>
            <button type="button" className="btn btn--ghost" onClick={quitRun}>
              Quitter la run
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'echec') {
    return (
      <div className="shell">
        <div className="panel result-panel col">
          <Sprite name="skull" size={64} className="center" title="Run terminée" />
          <h2 className="doubler__title">RUN TERMINEE A L'ANTE {ante}</h2>
          <p className="t-body t-muted">
            Score final {score} sur {config.target}. Le buy-in reste au casino.
          </p>
          <button type="button" className="btn btn--lg btn--wide" onClick={quitRun}>
            Retour au comptoir
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- table jeu */

  return (
    <div className="shell col" style={{ gap: 'var(--u4)' }}>
      <div className="poker-hud">
        <div className="panel panel--dark col" style={{ gap: 'var(--u2)' }}>
          <span className="t-label">Ante {ante} - objectif</span>
          <div className="meter">
            <div
              className={`meter__fill${progress < 60 ? ' meter__fill--warn' : ''}`}
              style={{ width: `${progress}%` }}
            />
            <span className="meter__label">
              {score} / {config.target}
            </span>
          </div>
          <div className="row row--between">
            <span className="badge">MAINS {handsLeft}</span>
            <span className="badge">DEFAUSSES {discardsLeft}</span>
            <span className="badge badge--gold">GAIN {formatMoney(config.reward)}</span>
          </div>
        </div>

        <div className="panel panel--dark col" style={{ gap: 'var(--u2)' }}>
          <span className="t-label">Jokers équipés</span>
          {jokers.length === 0 ? (
            <p className="t-body t-muted">Aucun joker. La boutique ouvre entre deux manches.</p>
          ) : (
            <ul className="joker-strip">
              {jokers.map((id) => {
                const joker = findJoker(id);
                if (!joker) return null;
                return (
                  <li key={id} className="joker-chip" title={joker.description}>
                    <Sprite name="club" size={16} palette={{ a: 'var(--brass-500)' }} />
                    <span>{joker.name}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="table-felt col" style={{ gap: 'var(--u4)' }}>
        <div className="poker-readout">
          {preview ? (
            <>
              <span className="t-label">{HAND_TABLE[preview.type].label}</span>
              <p className="score-line">
                <span className="score-line__chips">{preview.chips}</span>
                <span className="score-line__x">x</span>
                <span className="score-line__mult">{preview.mult}</span>
              </p>
            </>
          ) : lastPlay ? (
            <>
              <span className="t-label">{HAND_TABLE[lastPlay.hand.type].label} jouee</span>
              <p className="score-line">
                <span className="score-line__chips">{lastPlay.chips}</span>
                <span className="score-line__x">x</span>
                <span className="score-line__mult">{lastPlay.mult}</span>
                <span className="score-line__x">=</span>
                <span className="t-brass">{lastPlay.score}</span>
              </p>
              {lastPlay.notes.length > 0 ? (
                <ul className="note-list">
                  {lastPlay.notes.map((note) => (
                    <li key={note} className="t-body t-muted">
                      {note}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="t-body t-muted">Sélectionne jusqu&apos;à 5 cartes pour voir le score.</p>
          )}
        </div>

        <div className="hand">
          {hand.map((card, i) => (
            <PlayingCard
              key={card.id}
              card={card}
              dealing
              dealDelay={i * 55}
              selected={selected.includes(card.id)}
              onClick={() => toggleCard(card.id)}
              disabled={!selected.includes(card.id) && selected.length >= MAX_SELECTED}
            />
          ))}
        </div>
      </div>

      <div className="panel col">
        <div className="row row--wrap">
          <button
            type="button"
            className="btn btn--lg grow"
            disabled={selectedCards.length === 0 || handsLeft === 0}
            onClick={playHand}
          >
            Jouer la main
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--lg grow"
            disabled={selectedCards.length === 0 || discardsLeft === 0}
            onClick={discard}
          >
            Défausser ({discardsLeft})
          </button>
        </div>

        <div className="row row--wrap">
          <button
            type="button"
            className={`btn btn--sm grow${jokerCardArmed ? '' : ' btn--ghost'}`}
            disabled={inventory.jokerCard === 0 || jokerCardArmed}
            onClick={armJokerCard}
          >
            {jokerCardArmed
              ? 'Carte Joker armee : x1.5 sur la prochaine main'
              : `Carte Joker x${inventory.jokerCard}`}
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost grow"
            disabled={inventory.extraDiscard === 0}
            onClick={spendExtraDiscard}
          >
            Défausse Extra x{inventory.extraDiscard}
          </button>
          <button type="button" className="btn btn--sm btn--danger" onClick={quitRun}>
            Abandonner
          </button>
        </div>
      </div>

      {phase === 'gain' ? (
        <RoundEnd
          amount={reward}
          title={`ANTE ${ante} VALIDE`}
          detail={`${score} points sur ${config.target} demandés.`}
          onDone={openShop}
        />
      ) : null}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="tile">
      <span className="t-label">{label}</span>
      <span className="led" style={{ fontSize: 22 }}>
        {value}
      </span>
    </div>
  );
}
