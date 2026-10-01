import { useEffect, useRef, useState } from 'react';
import { formatMoney, MAFIA_DEBT } from '../engine/economy';
import { useCasino } from '../store/useCasino';
import { sfxButton } from '../audio/sfx';
import { Counter } from './Counter';
import { Sprite } from './Sprite';
import type { SpriteName } from '../assets/sprites';

export interface TopBarProps {
  /** Nom de la table en cours, absent dans le hall. */
  place?: string;
  onBack?: () => void;
  onOpenShop: () => void;
  onOpenTrophies: () => void;
  onOpenRules: () => void;
}

interface Delta {
  id: number;
  amount: number;
}

/**
 * Montants qui s'envolent de la banque a chaque mouvement d'argent : on voit
 * ce qu'on vient de gagner ou de payer, meme quand l'oeil est sur la table.
 */
function useBankDeltas(bank: number): Delta[] {
  const [deltas, setDeltas] = useState<Delta[]>([]);
  const previous = useRef(bank);
  const nextId = useRef(1);

  useEffect(() => {
    const diff = bank - previous.current;
    previous.current = bank;
    if (diff === 0) return;
    const id = nextId.current++;
    setDeltas((list) => [...list.slice(-3), { id, amount: diff }]);
    const timer = window.setTimeout(
      () => setDeltas((list) => list.filter((d) => d.id !== id)),
      1300,
    );
    return () => window.clearTimeout(timer);
  }, [bank]);

  return deltas;
}

export function TopBar({ place, onBack, onOpenShop, onOpenTrophies, onOpenRules }: TopBarProps) {
  const bank = useCasino((s) => s.bank);
  const debt = useCasino((s) => s.debt);
  const sound = useCasino((s) => s.sound);
  const setSound = useCasino((s) => s.setSound);
  const deltas = useBankDeltas(bank);

  const click = (fn: () => void) => () => {
    sfxButton();
    fn();
  };

  return (
    <>
      <header className={`rail${onBack ? ' rail--game' : ''}`}>
        <div className="rail__inner">
          {onBack ? (
            <button
              type="button"
              className="rail-btn rail-btn--square"
              onClick={click(onBack)}
              aria-label="Retour au hall"
            >
              <Sprite name="arrowLeft" size={22} palette={{ o: 'var(--ivory-100)' }} />
            </button>
          ) : null}

          <div className="brand">
            <span className="brand__mark" aria-hidden="true">
              <Sprite name="chip" size={26} palette={{ o: 'var(--ebony-950)' }} />
            </span>
            <span className="brand__name">Pocket Casino</span>
            {place ? <span className="brand__place">{place}</span> : null}
          </div>

          <div className="bank" aria-live="polite">
            <span className="bank__label">Banque</span>
            <span className={`led bank__led${bank === 0 ? ' led--red' : ''}`}>
              <Counter value={bank} money />
            </span>
            <span className="bank__deltas" aria-hidden="true">
              {deltas.map((d) => (
                <span
                  key={d.id}
                  className={`bank__delta ${d.amount > 0 ? 'bank__delta--gain' : 'bank__delta--loss'}`}
                >
                  {d.amount > 0 ? '+' : '-'} {formatMoney(Math.abs(d.amount))}
                </span>
              ))}
            </span>
          </div>

          <nav className="rail__actions" aria-label="Menu du casino">
            <RailButton icon="bag" label="Boutique" onClick={click(onOpenShop)} />
            <RailButton icon="trophy" label="Trophées" onClick={click(onOpenTrophies)} />
            <RailButton
              icon="book"
              label="Règles"
              ariaLabel="Carnet de règles"
              onClick={click(onOpenRules)}
            />
            <button
              type="button"
              className={`rail-btn rail-btn--square${sound ? ' is-on' : ''}`}
              onClick={() => setSound(!sound)}
              aria-label={sound ? 'Couper le son' : 'Activer le son'}
              aria-pressed={sound}
            >
              <Sprite
                name={sound ? 'soundOn' : 'soundOff'}
                size={24}
                palette={{
                  o: sound ? 'var(--brass-300)' : 'var(--ivory-400)',
                  a: 'var(--brass-300)',
                  c: 'var(--rouge-400)',
                }}
              />
            </button>
          </nav>
        </div>
      </header>

      {debt > 0 ? (
        <div className="debt-banner" role="status">
          <Sprite
            name="skull"
            size={18}
            palette={{ o: 'var(--ebony-950)', w: 'var(--ivory-50)' }}
          />
          <span>
            Dette mafia <strong className="num">{formatMoney(debt)}</strong> sur{' '}
            {formatMoney(MAFIA_DEBT)}. Taxe de 20 % sur tes gains.
          </span>
        </div>
      ) : null}
    </>
  );
}

function RailButton({
  icon,
  label,
  ariaLabel,
  onClick,
}: {
  icon: SpriteName;
  label: string;
  ariaLabel?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="rail-btn" onClick={onClick} aria-label={ariaLabel ?? label}>
      <Sprite name={icon} size={24} palette={{ o: 'var(--ebony-950)' }} />
      <span className="rail-btn__label">{label}</span>
    </button>
  );
}
