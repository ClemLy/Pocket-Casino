import { useEffect, useRef, useState } from 'react';
import { type Card, createDeck, isRed } from '../engine/cards';
import { formatMoney } from '../engine/economy';
import { appRng } from '../engine/appRng';
import { useCasino } from '../store/useCasino';
import { useJuice } from '../store/useJuice';
import { sfxBigWin, sfxButton, sfxCardFlip, sfxLose, sfxSuspense, sfxWin } from '../audio/sfx';
import { useRollingNumber } from './useRollingNumber';
import { PlayingCard } from './PlayingCard';
import { Sprite } from './Sprite';

/** Trois tentatives maximum : x2, x4, x8. */
export const MAX_STREAK = 3;

/** Temps de suspense avant de retourner la carte, en millisecondes. */
const SUSPENSE_MS = 650;

export interface DoubleOrNothingProps {
  /** Gain de la manche mis en jeu. */
  amount: number;
  /** Appele une seule fois, avec le montant final a crediter. */
  onSettle: (finalAmount: number, streak: number) => void;
}

type Phase = 'choix' | 'suspense' | 'reveal';

const DECK = createDeck('dbl');

export function DoubleOrNothing({ amount, onSettle }: DoubleOrNothingProps) {
  const [pot, setPot] = useState(amount);
  const [streak, setStreak] = useState(0);
  const [phase, setPhase] = useState<Phase>('choix');
  const [card, setCard] = useState<Card>(DECK[0]);
  const [won, setWon] = useState(false);
  const timers = useRef<number[]>([]);
  const unlock = useCasino((s) => s.unlock);
  const reduced = useCasino((s) => s.reducedMotion);
  const juice = useJuice();
  const shownPot = useRollingNumber(pot, { min: 300, max: 700 });

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, reduced ? ms * 0.25 : ms));
  };

  const guess = (choice: 'rouge' | 'noir') => {
    if (phase !== 'choix') return;
    sfxSuspense();
    const drawn = appRng.pick(DECK);
    const success = (choice === 'rouge') === isRed(drawn);

    // La carte est choisie tout de suite, mais ne se montre qu'apres le suspense.
    setCard(drawn);
    setWon(success);
    setPhase('suspense');

    later(() => {
      setPhase('reveal');
      sfxCardFlip();

      if (success) {
        const nextStreak = streak + 1;
        setPot((p) => p * 2);
        setStreak(nextStreak);
        later(() => {
          sfxWin();
          juice.rain(24);
        }, 260);
        if (nextStreak >= MAX_STREAK) {
          unlock('acrobate-du-risk');
          later(() => sfxBigWin(), 420);
        }
      } else {
        setPot(0);
        later(() => {
          sfxLose();
          juice.shake();
        }, 260);
      }
    }, SUSPENSE_MS);
  };

  const cashOut = () => {
    sfxButton();
    onSettle(pot, streak);
  };

  const again = () => {
    sfxButton();
    setPhase('choix');
  };

  const exhausted = streak >= MAX_STREAK;
  const revealed = phase === 'reveal';

  return (
    <div className="stage-backdrop" role="dialog" aria-modal="true" aria-label="Quitte ou Double">
      <div className="stage stage--double">
        <p className="stage__kicker">Mise en jeu</p>
        <h2 className="stage__title">Quitte ou double</h2>

        <div className={`stage__amount num${pot === 0 ? ' is-zero' : ''}`}>
          {formatMoney(shownPot)}
        </div>

        <ol className="ladder" aria-label={`Série : ${streak} sur ${MAX_STREAK}`}>
          {Array.from({ length: MAX_STREAK }, (_, i) => {
            const state =
              i < streak ? 'is-done' : i === streak && pot > 0 && !revealed ? 'is-current' : '';
            return (
              <li key={i} className={`ladder__step ${state}`}>
                <span className="num">x{2 ** (i + 1)}</span>
              </li>
            );
          })}
        </ol>

        <div className={`double-stage${phase === 'suspense' ? ' is-tense' : ''}`}>
          <PlayingCard card={card} size="lg" tilt={0} faceDown={!revealed} />
        </div>

        {phase === 'reveal' ? (
          <>
            <p className={`stage__verdict ${won ? 't-gain' : 't-perte'}`} aria-live="polite">
              {won
                ? exhausted
                  ? 'Trois de suite. La maison applaudit, en grinçant des dents.'
                  : 'Gagné. Tu peux encaisser ou repartir pour un tour.'
                : 'Perdu. Le croupier ramasse tout sans un mot.'}
            </p>
            <div className="stage__actions stage__actions--row">
              {won && !exhausted ? (
                <button type="button" className="btn btn--lg" onClick={again}>
                  Rejouer x2
                </button>
              ) : null}
              <button
                type="button"
                className={`btn btn--lg ${won ? 'btn--ghost' : ''}`}
                onClick={cashOut}
              >
                {pot > 0 ? `Encaisser ${formatMoney(pot)}` : 'Retour à la table'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="stage__detail">Rouge ou noir ? Bonne réponse et la mise double.</p>
            <div className="guess">
              <button
                type="button"
                className="guess-btn guess-btn--rouge"
                disabled={phase !== 'choix'}
                onClick={() => guess('rouge')}
              >
                <span className="guess-btn__suits" aria-hidden="true">
                  <Sprite name="heart" size={22} palette={{ a: 'var(--ivory-50)' }} />
                  <Sprite name="diamond" size={22} palette={{ a: 'var(--ivory-50)' }} />
                </span>
                Rouge
              </button>
              <button
                type="button"
                className="guess-btn guess-btn--noir"
                disabled={phase !== 'choix'}
                onClick={() => guess('noir')}
              >
                <span className="guess-btn__suits" aria-hidden="true">
                  <Sprite name="spade" size={22} palette={{ a: 'var(--ivory-50)' }} />
                  <Sprite name="club" size={22} palette={{ a: 'var(--ivory-50)' }} />
                </span>
                Noir
              </button>
            </div>
            <button
              type="button"
              className="link-btn stage__escape"
              disabled={phase !== 'choix'}
              onClick={cashOut}
            >
              Encaisser {formatMoney(pot)} et partir
            </button>
          </>
        )}
      </div>
    </div>
  );
}
