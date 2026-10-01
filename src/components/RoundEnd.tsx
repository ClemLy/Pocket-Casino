import { useState } from 'react';
import { formatMoney } from '../engine/economy';
import { useCasino } from '../store/useCasino';
import { useJuice } from '../store/useJuice';
import { sfxBigWin, sfxButton, sfxLose } from '../audio/sfx';
import { useRollingNumber } from './useRollingNumber';
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
  const won = amount > 0;
  const rolled = useRollingNumber(won ? amount : 0, { min: 500, max: 1100, start: 0 });

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

  return (
    <div className="stage-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`stage${won ? ' stage--won' : ' stage--lost'}`}>
        <div className="stage__emblem" aria-hidden="true">
          {won ? <span className="stage__rays" /> : null}
          <Sprite name={won ? 'coin' : 'skull'} size={72} />
        </div>
        <p className="stage__kicker">{won ? 'Manche gagnée' : 'Manche perdue'}</p>
        <h2 className="stage__title">{title}</h2>
        {detail ? <p className="stage__detail">{detail}</p> : null}

        <div className={`stage__amount num${won ? '' : ' is-zero'}`}>
          {won ? `+ ${formatMoney(rolled)}` : formatMoney(0)}
        </div>

        {won ? (
          <div className="stage__actions">
            <button
              type="button"
              className="doubler-call"
              onClick={() => {
                sfxButton();
                setGambling(true);
              }}
            >
              <span className="doubler-call__label">Quitte ou double</span>
              <span className="doubler-call__hint">Rouge ou noir, jusqu&apos;à x8</span>
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
          <div className="stage__actions">
            <button type="button" className="btn btn--lg btn--wide" onClick={() => finish(0)}>
              {continueLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
