import { useState } from 'react';
import { type Card, createDeck, isRed } from '../engine/cards';
import { formatMoney } from '../engine/economy';
import { appRng } from '../engine/appRng';
import { useCasino } from '../store/useCasino';
import { useJuice } from '../store/useJuice';
import { sfxBigWin, sfxButton, sfxCardFlip, sfxLose, sfxSuspense, sfxWin } from '../audio/sfx';
import { PlayingCard } from './PlayingCard';

/** Trois tentatives maximum : x2, x4, x8. */
export const MAX_STREAK = 3;

export interface DoubleOrNothingProps {
  /** Gain de la manche mis en jeu. */
  amount: number;
  /** Appele une seule fois, avec le montant final a crediter. */
  onSettle: (finalAmount: number, streak: number) => void;
}

type Phase = 'choix' | 'reveal';

const DECK = createDeck('dbl');

export function DoubleOrNothing({ amount, onSettle }: DoubleOrNothingProps) {
  const [pot, setPot] = useState(amount);
  const [streak, setStreak] = useState(0);
  const [phase, setPhase] = useState<Phase>('choix');
  const [card, setCard] = useState<Card | null>(null);
  const [won, setWon] = useState(false);
  const unlock = useCasino((s) => s.unlock);
  const juice = useJuice();

  const guess = (choice: 'rouge' | 'noir') => {
    sfxSuspense();
    const drawn = appRng.pick(DECK);
    const success = (choice === 'rouge') === isRed(drawn);

    setCard(drawn);
    setPhase('reveal');
    setWon(success);

    window.setTimeout(() => sfxCardFlip(), 120);

    if (success) {
      const next = pot * 2;
      const nextStreak = streak + 1;
      setPot(next);
      setStreak(nextStreak);
      window.setTimeout(() => {
        sfxWin();
        juice.rain(24);
      }, 260);
      if (nextStreak >= MAX_STREAK) {
        unlock('acrobate-du-risk');
        window.setTimeout(() => sfxBigWin(), 400);
      }
    } else {
      setPot(0);
      window.setTimeout(() => {
        sfxLose();
        juice.shake();
      }, 260);
    }
  };

  const cashOut = () => {
    sfxButton();
    onSettle(pot, streak);
  };

  const again = () => {
    sfxButton();
    setPhase('choix');
    setCard(null);
  };

  const exhausted = streak >= MAX_STREAK;

  return (
    <div className="doubler-backdrop" role="dialog" aria-modal="true" aria-label="Quitte ou Double">
      <div className="doubler">
        <p className="doubler__kicker">MISE EN JEU</p>
        <h2 className="doubler__title">QUITTE OU DOUBLE</h2>

        <div className={`led doubler__pot${pot === 0 ? ' led--red' : ''}`}>{formatMoney(pot)}</div>

        <div className="doubler__streak" aria-label={`Série : ${streak} sur ${MAX_STREAK}`}>
          {Array.from({ length: MAX_STREAK }, (_, i) => {
            const multiplier = 2 ** (i + 1);
            const state =
              i < streak
                ? ' doubler__step--done'
                : i === streak && phase === 'choix' && pot > 0
                  ? ' doubler__step--current'
                  : '';
            return (
              <span key={i} className={`doubler__step${state}`}>
                x{multiplier}
              </span>
            );
          })}
        </div>

        <div className="doubler__stage">
          {card ? (
            <PlayingCard card={card} size="lg" tilt={appRng.int(-3, 3)} />
          ) : (
            <PlayingCard card={DECK[0]} size="lg" faceDown />
          )}
        </div>

        {phase === 'choix' ? (
          <>
            <p className="t-body t-muted" style={{ marginBottom: 'var(--u4)' }}>
              Rouge ou Noir ? Bonne réponse et la mise double.
            </p>
            <div className="doubler__choices">
              <button
                type="button"
                className="guess-btn guess-btn--rouge"
                onClick={() => guess('rouge')}
              >
                ROUGE
              </button>
              <button
                type="button"
                className="guess-btn guess-btn--noir"
                onClick={() => guess('noir')}
              >
                NOIR
              </button>
            </div>
            <div className="doubler__actions">
              <button type="button" className="btn btn--ghost" onClick={cashOut}>
                Encaisser
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={`doubler__verdict ${won ? 't-gain' : 't-perte'}`}>
              {won
                ? exhausted
                  ? 'Trois de suite. La maison applaudit, en grincant des dents.'
                  : 'Gagne. Tu peux encaisser ou repartir pour un tour.'
                : 'Perdu. Le croupier ramasse tout sans un mot.'}
            </p>
            <div className="doubler__actions">
              {won && !exhausted ? (
                <button type="button" className="btn" onClick={again}>
                  Rejouer x2
                </button>
              ) : null}
              <button type="button" className="btn btn--ghost" onClick={cashOut}>
                {pot > 0 ? `Encaisser ${formatMoney(pot)}` : 'Retour à la table'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
