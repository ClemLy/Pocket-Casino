import { formatMoney, MAFIA_DEBT } from '../engine/economy';
import { useCasino } from '../store/useCasino';
import { sfxButton } from '../audio/sfx';
import { Sprite } from './Sprite';

export interface TopBarProps {
  onBack?: () => void;
  onOpenShop: () => void;
  onOpenTrophies: () => void;
  onOpenRules: () => void;
}

export function TopBar({ onBack, onOpenShop, onOpenTrophies, onOpenRules }: TopBarProps) {
  const bank = useCasino((s) => s.bank);
  const debt = useCasino((s) => s.debt);
  const sound = useCasino((s) => s.sound);
  const setSound = useCasino((s) => s.setSound);

  const click = (fn: () => void) => () => {
    sfxButton();
    fn();
  };

  return (
    <>
      <header className="topbar">
        {onBack ? (
          <button
            type="button"
            className="icon-btn"
            onClick={click(onBack)}
            aria-label="Retour au hall"
          >
            <Sprite name="arrowLeft" size={20} palette={{ o: 'var(--bone-100)' }} />
          </button>
        ) : null}

        <div className="topbar__brand">
          <Sprite name="chip" size={22} />
          <span>POCKET CASINO</span>
        </div>

        <div className="topbar__bank">
          <span className="t-label">Banque</span>
          <span
            className={`led${bank === 0 ? ' led--red' : ''}`}
            aria-label={`Banque : ${formatMoney(bank)}`}
          >
            {formatMoney(bank)}
          </span>
        </div>

        <div className="topbar__actions">
          <button
            type="button"
            className="icon-btn"
            onClick={click(onOpenShop)}
            aria-label="Boutique"
          >
            <Sprite name="bag" size={22} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={click(onOpenTrophies)}
            aria-label="Trophées"
          >
            <Sprite name="trophy" size={22} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={click(onOpenRules)}
            aria-label="Carnet de règles"
          >
            <Sprite name="book" size={22} />
          </button>
          <button
            type="button"
            className={`icon-btn${sound ? ' icon-btn--on' : ''}`}
            onClick={() => setSound(!sound)}
            aria-label={sound ? 'Couper le son' : 'Activer le son'}
            aria-pressed={sound}
          >
            <Sprite
              name={sound ? 'soundOn' : 'soundOff'}
              size={22}
              palette={{ o: sound ? 'var(--ink-900)' : 'var(--bone-300)' }}
            />
          </button>
        </div>
      </header>

      {debt > 0 ? (
        <div className="debt-banner" role="status">
          <Sprite name="skull" size={16} palette={{ o: 'var(--ink-900)', w: 'var(--bone-100)' }} />
          <span>
            DETTE MAFIA {formatMoney(debt)} SUR {formatMoney(MAFIA_DEBT)} - TAXE 20 % SUR TES GAINS
          </span>
        </div>
      ) : null}
    </>
  );
}
