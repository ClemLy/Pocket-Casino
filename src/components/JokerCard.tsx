import type { SpriteName } from '../assets/sprites';
import { type Joker, RARITY_LABEL } from '../engine/jokers';
import { Sprite } from './Sprite';

/** Un picto par joker, pour les reconnaitre d'un coup d'oeil sur le rail. */
const JOKER_ICON: Record<string, SpriteName> = {
  videur: 'fist',
  'croupier-vereux': 'bill',
  'coeur-de-pique': 'heart',
  'porte-bonheur': 'coin',
  'dame-de-carreau': 'diamond',
  'main-lourde': 'vault',
  'compteur-de-cartes': 'cards',
  'vieux-briscard': 'skull',
  'machine-a-sous': 'wheel',
  flambeur: 'bolt',
};

const ICON_PALETTE: Partial<Record<string, Record<string, string>>> = {
  'coeur-de-pique': { a: 'var(--rouge-500)' },
  'dame-de-carreau': { a: 'var(--rouge-500)' },
};

export interface JokerCardProps {
  joker: Joker;
  size?: 'sm' | 'md';
  /** Change de valeur a chaque declenchement pour faire sauter la carte. */
  pulse?: number;
  /** Affiche la description en infobulle au survol. */
  tooltip?: boolean;
}

export function JokerCard({ joker, size = 'md', pulse = 0, tooltip = false }: JokerCardProps) {
  return (
    <span
      className={`joker joker--${joker.rarity} joker--${size}`}
      tabIndex={tooltip ? 0 : undefined}
      aria-label={`${joker.name}, ${RARITY_LABEL[joker.rarity]} : ${joker.description}`}
      role="img"
    >
      <span className={`joker__card${pulse ? ' joker__card--pulse' : ''}`} key={pulse}>
        <span className="joker__art" aria-hidden="true">
          <Sprite
            name={JOKER_ICON[joker.id] ?? 'spade'}
            size={size === 'sm' ? 30 : 40}
            palette={ICON_PALETTE[joker.id]}
          />
        </span>
        <span className="joker__name">{joker.name}</span>
      </span>
      {tooltip ? (
        <span className="joker__tip" role="tooltip">
          <span className="joker__tip-name">{joker.name}</span>
          <span className="joker__tip-rarity">{RARITY_LABEL[joker.rarity]}</span>
          <span className="joker__tip-desc">{joker.description}</span>
        </span>
      ) : null}
    </span>
  );
}
