import { memo, type CSSProperties, type PointerEvent, useMemo, useRef } from 'react';
import { type Card, cardLabel, isRed, type Rank, type Suit } from '../engine/cards';
import type { SpriteName } from '../assets/sprites';
import { PORTRAITS, type PortraitName } from '../assets/portraits';
import { Sprite } from './Sprite';

const SUIT_SPRITE: Record<Suit, SpriteName> = {
  S: 'spade',
  H: 'heart',
  D: 'diamond',
  C: 'club',
};

const FIGURE: Partial<Record<Rank, PortraitName>> = {
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

const PIP_PX: Record<CardSize, number> = { sm: 10, md: 14, lg: 17 };
const CORNER_PX: Record<CardSize, number> = { sm: 8, md: 10, lg: 12 };
const ACE_PX: Record<CardSize, number> = { sm: 26, md: 38, lg: 46 };
const FIGURE_PX: Record<CardSize, number> = { sm: 36, md: 54, lg: 66 };

const canHover =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

export interface PlayingCardProps {
  card: Card;
  faceDown?: boolean;
  size?: CardSize;
  /** Inclinaison en degrés : une main posée à la main n'est jamais alignée au pixel. */
  tilt?: number;
  selected?: boolean;
  /** Met la carte en avant quand elle compte dans la combinaison. */
  scoring?: boolean;
  /** Change de valeur pour faire sauter la carte (déclenchement de score). */
  pulse?: number;
  dimmed?: boolean;
  burned?: boolean;
  /** Arrive depuis le sabot, avec un léger décalage. */
  dealing?: boolean;
  dealDelay?: number;
  /** Arrive face cachée puis se retourne. */
  flipIn?: boolean;
  flipDelay?: number;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

function PlayingCardBase({
  card,
  faceDown = false,
  size = 'md',
  tilt,
  selected = false,
  scoring = false,
  pulse = 0,
  dimmed = false,
  burned = false,
  dealing = false,
  dealDelay = 0,
  flipIn = false,
  flipDelay = 0,
  onClick,
  disabled = false,
  className,
}: PlayingCardProps) {
  const liftRef = useRef<HTMLSpanElement>(null);
  const red = isRed(card);
  const ink = red ? 'var(--rouge-500)' : 'var(--noir-700)';
  const palette = useMemo(() => ({ a: ink }), [ink]);
  const interactive = Boolean(onClick) && !disabled;

  const classes = [
    'card',
    `card--${size}`,
    interactive && 'card--interactive',
    selected && 'card--selected',
    scoring && 'card--scoring',
    dimmed && 'card--dimmed',
    burned && 'card--burned',
    dealing && 'card--dealing',
    flipIn && 'card--flip-in',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const style = {
    '--tilt': `${tilt ?? naturalTilt(card.id)}deg`,
    '--deal-delay': `${dealDelay}ms`,
    '--flip-delay': `${flipDelay}ms`,
  } as CSSProperties;

  // L'inclinaison suit le pointeur directement sur l'element, sans re-render.
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const lift = liftRef.current;
    if (!lift || !canHover || !interactive) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width - 0.5;
    const ny = (event.clientY - rect.top) / rect.height - 0.5;
    lift.style.setProperty('--ry', `${(nx * 16).toFixed(2)}deg`);
    lift.style.setProperty('--rx', `${(-ny * 16).toFixed(2)}deg`);
    lift.style.setProperty('--gx', `${((nx + 0.5) * 100).toFixed(1)}%`);
    lift.style.setProperty('--gy', `${((ny + 0.5) * 100).toFixed(1)}%`);
  };

  const onPointerLeave = () => {
    const lift = liftRef.current;
    if (!lift) return;
    lift.style.setProperty('--ry', '0deg');
    lift.style.setProperty('--rx', '0deg');
  };

  const pips = PIP_LAYOUT[card.rank];
  const figure = FIGURE[card.rank];
  const suit = SUIT_SPRITE[card.suit];

  const corner = (position: 'tl' | 'br') => (
    <span className={`card__corner card__corner--${position}`} style={{ color: ink }}>
      <span className={`card__rank${card.rank === '10' ? ' card__rank--ten' : ''}`}>
        {card.rank}
      </span>
      <Sprite name={suit} size={CORNER_PX[size]} palette={palette} />
    </span>
  );

  const inner = (
    <>
      <span className="card__shadow" aria-hidden="true" />
      <span className="card__lift" ref={liftRef} key={pulse || undefined}>
        <span className={`card__flip${faceDown ? ' is-down' : ''}`}>
          <span className="card__face card__face--front">
            {corner('tl')}
            <span className="card__body">
              {pips ? (
                pips.map(([col, row], i) => (
                  <span
                    key={i}
                    className={`card__pip${row > 0.5 ? ' card__pip--flipped' : ''}`}
                    style={{ left: `${col * 50}%`, top: `${row * 100}%` }}
                  >
                    <Sprite name={suit} size={PIP_PX[size]} palette={palette} />
                  </span>
                ))
              ) : figure ? (
                <span className="card__figure" style={{ color: ink }}>
                  <Sprite data={PORTRAITS[figure]} size={FIGURE_PX[size]} palette={palette} />
                </span>
              ) : (
                <span className="card__ace">
                  <Sprite name={suit} size={ACE_PX[size]} palette={palette} />
                </span>
              )}
            </span>
            {corner('br')}
          </span>
          <span className="card__face card__face--back" aria-hidden="true">
            <span className="card__back-art" />
          </span>
        </span>
        <span className="card__glare" aria-hidden="true" />
      </span>
    </>
  );

  const label = faceDown ? 'Carte face cachée' : cardLabel(card);

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        style={style}
        onClick={onClick}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={label}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={classes} style={style} role="img" aria-label={label}>
      {inner}
    </div>
  );
}

export const PlayingCard = memo(PlayingCardBase);
