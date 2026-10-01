import { formatMoney } from '../engine/economy';
import { TROPHIES } from '../engine/trophies';
import { useCasino } from '../store/useCasino';
import { Sprite } from '../components/Sprite';

/** Vitrine des succès. Chaque deblocage verse une prime directement en banque. */
export function Trophies() {
  const trophies = useCasino((s) => s.trophies);
  const unlocked = TROPHIES.filter((t) => trophies[t.id]).length;
  const totalReward = TROPHIES.reduce((sum, t) => sum + t.reward, 0);
  const earned = TROPHIES.filter((t) => trophies[t.id]).reduce((sum, t) => sum + t.reward, 0);

  return (
    <div className="showcase">
      <div className="showcase__summary">
        <div className="showcase__count">
          <span className="num showcase__big">{unlocked}</span>
          <span className="t-muted"> / {TROPHIES.length} trophées</span>
        </div>
        <div className="showcase__meter">
          <div className="meter">
            <div
              className="meter__fill"
              style={{ width: `${(unlocked / TROPHIES.length) * 100}%` }}
            />
          </div>
          <span className="t-label">
            Primes touchées <span className="t-brass num">{formatMoney(earned)}</span> sur{' '}
            {formatMoney(totalReward)}
          </span>
        </div>
      </div>

      <div className="tile-grid">
        {TROPHIES.map((trophy) => {
          const at = trophies[trophy.id];
          return (
            <article
              key={trophy.id}
              className={`tile trophy${at ? ' tile--gold' : ' tile--locked'}`}
            >
              <div className="tile__head">
                <span className={`trophy__medal${at ? ' is-won' : ''}`} aria-hidden="true">
                  <Sprite name={trophy.icon} size={30} />
                </span>
                <span className="tile__name">{trophy.name}</span>
              </div>
              <p className="tile__desc">{trophy.condition}</p>
              <div className="tile__foot">
                <span className={`badge${at ? ' badge--gold' : ''}`}>
                  {at ? 'Débloqué' : 'À faire'}
                </span>
                <span className="price">+ {formatMoney(trophy.reward)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
