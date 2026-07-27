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
    <div className="col" style={{ gap: 'var(--u4)' }}>
      <div className="row row--between row--wrap">
        <p className="t-body">
          {unlocked} trophée{unlocked > 1 ? 's' : ''} sur {TROPHIES.length}.
        </p>
        <span className="led" style={{ fontSize: 20 }}>
          {formatMoney(earned)} / {formatMoney(totalReward)}
        </span>
      </div>

      <div className="meter">
        <div className="meter__fill" style={{ width: `${(unlocked / TROPHIES.length) * 100}%` }} />
        <span className="meter__label">
          {unlocked} / {TROPHIES.length}
        </span>
      </div>

      <div className="tile-grid">
        {TROPHIES.map((trophy) => {
          const at = trophies[trophy.id];
          return (
            <article key={trophy.id} className={`tile${at ? ' tile--gold' : ' tile--locked'}`}>
              <div className="tile__head">
                <Sprite name={trophy.icon} size={28} title={trophy.name} />
                <span className="tile__name">{trophy.name}</span>
              </div>
              <p className="tile__desc">{trophy.condition}</p>
              <div className="tile__foot">
                <span className={`badge${at ? ' badge--gold' : ''}`}>
                  {at ? 'DEBLOQUE' : 'A FAIRE'}
                </span>
                <span className="led" style={{ fontSize: 18 }}>
                  + {formatMoney(trophy.reward)}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
