import { useState } from 'react';
import { formatMoney } from '../engine/economy';
import { useCasino } from '../store/useCasino';
import { useJuice } from '../store/useJuice';
import { sfxBigWin, sfxButton, sfxLose } from '../audio/sfx';
import { DoubleOrNothing } from './DoubleOrNothing';
import { Sprite } from './Sprite';

export interface RoundEndProps {
  /** Retour total de la manche, mise comprise. 0 signifie manche perdue. */
  amount: number;
  title: string;
  detail?: string;
  /** Ferme le panneau et rend la main à la table. */
  onDone: () => void;
  /** Libelle du bouton de sortie. */
  continueLabel?: string;
}

/**
 * Panneau de fin de manche commun aux trois modes.
 *
 * C'est ici que vit le bouton signature : après chaque gain, le joueur peut
 * remettre la totalité du retour de la manche en jeu au Quitte ou Double.
 */
export function RoundEnd({
  amount,
  title,
  detail,
  onDone,
  continueLabel = 'Continuer',
}: RoundEndProps) {
  const [gambling, setGambling] = useState(false);
  const [settled, setSettled] = useState(false);
  const deposit = useCasino((s) => s.deposit);
  const recordStat = useCasino((s) => s.recordStat);
  const unlock = useCasino((s) => s.unlock);
  const juice = useJuice();

  const finish = (finalAmount: number) => {
    if (settled) return;
    setSettled(true);
    if (finalAmount > 0) {
      deposit(finalAmount);
      recordStat('manchesGagnees', 1);
      unlock('premier-jeton');
      if (finalAmount >= 500) {
        sfxBigWin();
        juice.rain(Math.min(90, 30 + Math.floor(finalAmount / 40)));
      }
    } else {
      sfxLose();
      juice.shake();
    }
    onDone();
  };

  if (gambling) {
    return <DoubleOrNothing amount={amount} onSettle={(final) => finish(final)} />;
  }

  const won = amount > 0;

  return (
    <div className="doubler-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="doubler">
        <div className="result-panel">
          <Sprite
            name={won ? 'coin' : 'skull'}
            size={64}
            title={won ? 'Gain' : 'Perte'}
            className="center"
            palette={{ o: 'var(--ink-900)' }}
          />
          <h2 className="doubler__title" style={{ marginTop: 'var(--u4)' }}>
            {title}
          </h2>
          {detail ? (
            <p className="t-body t-muted" style={{ marginTop: 'var(--u2)' }}>
              {detail}
            </p>
          ) : null}

          <div className={`led result-panel__amount${won ? ' led--green' : ' led--red'}`}>
            {won ? `+ ${formatMoney(amount)}` : formatMoney(0)}
          </div>

          {won ? (
            <div className="col">
              <button
                type="button"
                className="doubler-call blink"
                onClick={() => {
                  sfxButton();
                  setGambling(true);
                }}
              >
                QUITTE OU DOUBLE
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--wide"
                onClick={() => finish(amount)}
              >
                Encaisser {formatMoney(amount)}
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--wide" onClick={() => finish(0)}>
              {continueLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
