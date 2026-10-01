import { type CSSProperties, memo } from 'react';
import { sfxChip } from '../audio/sfx';
import { formatMoney } from '../engine/economy';

/** Valeurs faciales disponibles au tapis. */
export const CHIP_VALUES = [5, 25, 100, 500] as const;
export type ChipValue = (typeof CHIP_VALUES)[number];

/** Toutes les coupures, de la plus forte a la plus faible, pour les piles. */
const DENOMINATIONS = [1000, 500, 100, 25, 5] as const;

interface ChipStyle {
  face: string;
  deep: string;
  edge: string;
  ink: string;
}

const CHIP_STYLES: Record<number, ChipStyle> = {
  5: { face: '#d22a46', deep: '#7d1124', edge: '#fff4dc', ink: '#fffaf0' },
  25: { face: '#1f8a5a', deep: '#0d4a2f', edge: '#fff4dc', ink: '#fffaf0' },
  100: { face: '#24201c', deep: '#0b0907', edge: '#f5ecd7', ink: '#fffaf0' },
  500: { face: '#7448d8', deep: '#3a2080', edge: '#ffcd57', ink: '#fffaf0' },
  1000: { face: '#f4b53b', deep: '#8a520c', edge: '#1d1611', ink: '#1d1611' },
};

const FALLBACK: ChipStyle = { face: '#3b2d22', deep: '#140f0b', edge: '#cfc19f', ink: '#fffaf0' };

/** Un montant cumule (75 $) prend la couleur de la plus grosse coupure qu'il contient. */
function styleFor(value: number): ChipStyle {
  if (CHIP_STYLES[value]) return CHIP_STYLES[value];
  const denomination = DENOMINATIONS.find((d) => d <= value);
  return denomination ? CHIP_STYLES[denomination] : FALLBACK;
}

function chipVars(value: number): CSSProperties {
  const style = styleFor(value);
  return {
    '--chip-face': style.face,
    '--chip-deep': style.deep,
    '--chip-edge': style.edge,
    '--chip-ink': style.ink,
  } as CSSProperties;
}

/** Libelle court sur la pastille : 1000 devient 1K pour tenir dans le centre. */
function faceLabel(value: number): string {
  if (value < 1000) return String(value);
  if (value % 1000 === 0) return `${value / 1000}K`;
  return `${(value / 1000).toFixed(1).replace('.', ',')}K`;
}

export interface ChipProps {
  value: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  active?: boolean;
  disabled?: boolean;
  placed?: boolean;
  onClick?: () => void;
  label?: string;
}

function ChipBase({
  value,
  size = 'md',
  active = false,
  disabled = false,
  placed = false,
  onClick,
  label,
}: ChipProps) {
  const classes = ['chip', `chip--${size}`, active && 'chip--active', placed && 'chip--placed']
    .filter(Boolean)
    .join(' ');

  const content = (
    <span className="chip__body">
      <span className="chip__value">{faceLabel(value)}</span>
    </span>
  );

  if (!onClick) {
    return (
      <span
        className={classes}
        style={chipVars(value)}
        role="img"
        aria-label={label ?? `Jeton de ${formatMoney(value)}`}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      style={chipVars(value)}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label ?? `Miser ${formatMoney(value)}`}
      onClick={() => {
        sfxChip();
        onClick();
      }}
    >
      {content}
    </button>
  );
}

export const Chip = memo(ChipBase);

/** Decoupe un montant en jetons, de la plus forte coupure a la plus faible. */
function decompose(amount: number, cap = 10): number[] {
  const chips: number[] = [];
  let rest = Math.max(0, Math.floor(amount));
  for (const value of DENOMINATIONS) {
    while (rest >= value && chips.length < cap) {
      chips.push(value);
      rest -= value;
    }
  }
  // Reste sous 5 $ (rare) : un dernier jeton de 5 pour que la pile existe.
  if (chips.length === 0 && amount > 0) chips.push(5);
  return chips;
}

export interface ChipStackProps {
  amount: number;
  size?: 'xs' | 'sm' | 'md';
  /** Affiche le montant exact sous la pile. */
  showAmount?: boolean;
  className?: string;
}

/**
 * Pile de jetons posee sur le tapis : la mise devient un objet qu'on voit
 * grandir, plutot qu'un chiffre dans un coin.
 */
export function ChipStack({ amount, size = 'sm', showAmount = false, className }: ChipStackProps) {
  // Les grosses coupures en bas, comme le ferait un croupier.
  const chips = decompose(amount);
  return (
    <span
      className={`chip-stack chip-stack--${size}${className ? ` ${className}` : ''}`}
      style={{ '--count': chips.length } as CSSProperties}
      role="img"
      aria-label={`Mise de ${formatMoney(amount)}`}
    >
      {chips.map((value, i) => (
        <span
          key={`${i}-${value}`}
          className="chip-stack__chip"
          style={{ ...chipVars(value), '--i': i } as CSSProperties}
        >
          <span className="chip chip--stacked">
            <span className="chip__body">
              {i === chips.length - 1 ? (
                <span className="chip__value">{faceLabel(value)}</span>
              ) : null}
            </span>
          </span>
        </span>
      ))}
      {showAmount ? <span className="chip-stack__amount num">{formatMoney(amount)}</span> : null}
    </span>
  );
}
