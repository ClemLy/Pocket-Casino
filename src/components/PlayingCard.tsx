import { memo, useMemo } from 'react';
import { type Card, cardLabel, isRed, type Rank, type Suit } from '../engine/cards';
import type { SpriteName } from '../assets/sprites';
import { Sprite } from './Sprite';

const SUIT_SPRITE: Record<Suit, SpriteName> = {
  S: 'spade',
  H: 'heart',
  D: 'diamond',
  C: 'club',
};

const FIGURE_SPRITE: Partial<Record<Rank, SpriteName>> = {
  J: 'jack',
  Q: 'queen',
  K: 'king',
};

/**
 * Disposition des pips comme sur une vraie carte : 3 colonnes, les pips de la
 * moitié basse sont retournes a 180 degrés.
 * Chaque entrée est [colonne 0-2, position verticale 0-1].
 */
const PIP_LAYOUT: Partial<Record<Rank, ReadonlyArray<readonly [number, number]>>> = {
  '2': [
    [1, 0],
    [1, 1],
  ],
  '3': [
    [1, 0],
    [1, 0.5],
    [1, 1],
  ],
  '4': [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
  ],
  '5': [
    [0, 0],
    [2, 0],
    [1, 0.5],
    [0, 1],
    [2, 1],
  ],
  '6': [
    [0, 0],
    [2, 0],
    [0, 0.5],
    [2, 0.5],
    [0, 1],
    [2, 1],
  ],
  '7': [
    [0, 0],
    [2, 0],
    [1, 0.25],
    [0, 0.5],
    [2, 0.5],
    [0, 1],
    [2, 1],
  ],
  '8': [
    [0, 0],
    [2, 0],
    [1, 0.25],
    [0, 0.5],
    [2, 0.5],
    [1, 0.75],
    [0, 1],
    [2, 1],
  ],
  '9': [
    [0, 0],
    [2, 0],
    [0, 1 / 3],
    [2, 1 / 3],
    [1, 0.5],
    [0, 2 / 3],
    [2, 2 / 3],
    [0, 1],
    [2, 1],
  ],
  '10': [
    [0, 0],
    [2, 0],
    [1, 1 / 6],
    [0, 1 / 3],
    [2, 1 / 3],
    [0, 2 / 3],
    [2, 2 / 3],
    [1, 5 / 6],
    [0, 1],
    [2, 1],
  ],
};

/**
 * Inclinaison naturelle deduite de l'identifiant de la carte.
 *
 * Une main posée sur un tapis n'est jamais alignée au pixel. Le hash garantit
 * qu'une même carte garde toujours le même angle : ca bouge a la distribution,
 * pas a chaque rendu React.
 */
function naturalTilt(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 41) - 20) / 10;
}

export type CardSize = 'sm' | 'md' | 'lg';

export interface PlayingCardProps {
  card: Card;
  faceDown?: boolean;
  size?: CardSize;
  /** Inclinaison en degrés : une main posée à la main n'est jamais alignée au pixel. */
  tilt?: number;
  selected?: boolean;
  /** Met la carte en avant quand elle compte dans la combinaison. */
  scoring?: boolean;
  dimmed?: boolean;
  burned?: boolean;
  dealing?: boolean;
  dealDelay?: number;
  onClick?: () => void;
  disabled?: boolean;
}

function PlayingCardBase({
  card,
  faceDown = false,
  size = 'md',
  tilt,
  selected = false,
  scoring = false,
  dimmed = false,
  burned = false,
  dealing = false,
  dealDelay = 0,
  onClick,
  disabled = false,
}: PlayingCardProps) {
  const red = isRed(card);
  const ink = red ? 'var(--crimson-500)' : 'var(--ink-900)';
  const palette = useMemo(() => ({ a: ink, c: ink }), [ink]);

  const classes = [
    'card',
    size === 'sm' && 'card--sm',
    size === 'lg' && 'card--lg',
    faceDown && 'card--back',
    onClick && !disabled && 'card--interactive',
    selected && 'card--selected',
    scoring && 'card--scoring',
    dimmed && 'card--dimmed',
    burned && 'card--burned',
    dealing && 'card--dealing',
  ]
    .filter(Boolean)
    .join(' ');

  const style = {
    '--tilt': `${tilt ?? naturalTilt(card.id)}deg`,
    '--deal-delay': `${dealDelay}ms`,
  } as React.CSSProperties;

  if (faceDown) {
    return (
      <div className={classes} style={style} aria-label="Carte face cachée" role="img">
        <span className="card__back-art" />
      </div>
    );
  }

  const pipSize = size === 'sm' ? 9 : size === 'lg' ? 15 : 12;
  const cornerSize = size === 'sm' ? 7 : size === 'lg' ? 11 : 9;
  const pips = PIP_LAYOUT[card.rank];
  const figure = FIGURE_SPRITE[card.rank];

  const content = (
    <>
      <span className="card__corner card__corner--tl" style={{ color: ink }}>
        <span className={`card__rank${card.rank === '10' ? ' card__rank--ten' : ''}`}>
          {card.rank}
        </span>
        <Sprite name={SUIT_SPRITE[card.suit]} size={cornerSize} palette={palette} />
      </span>

      <span className="card__body">
        {pips ? (
          pips.map(([col, row], i) => (
            <span
              key={i}
              className={`card__pip${row > 0.5 ? ' card__pip--flipped' : ''}`}
              style={{ left: `${col * 50}%`, top: `${row * 100}%` }}
            >
              <Sprite name={SUIT_SPRITE[card.suit]} size={pipSize} palette={palette} />
            </span>
          ))
        ) : figure ? (
          <span className="card__figure" style={{ color: ink }}>
            <Sprite
              name={figure}
              size={size === 'sm' ? 30 : size === 'lg' ? 56 : 44}
              palette={palette}
            />
          </span>
        ) : (
          <span className="card__center">
            <Sprite
              name={SUIT_SPRITE[card.suit]}
              size={size === 'sm' ? 24 : size === 'lg' ? 44 : 34}
              palette={palette}
            />
          </span>
        )}
      </span>

      <span className="card__corner card__corner--br" style={{ color: ink }}>
        <span className={`card__rank${card.rank === '10' ? ' card__rank--ten' : ''}`}>
          {card.rank}
        </span>
        <Sprite name={SUIT_SPRITE[card.suit]} size={cornerSize} palette={palette} />
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        style={style}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={cardLabel(card)}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={classes} style={style} role="img" aria-label={cardLabel(card)}>
      {content}
    </div>
  );
}

export const PlayingCard = memo(PlayingCardBase);
