import { memo } from 'react';
import { sfxChip } from '../audio/sfx';

/** Valeurs faciales disponibles au tapis. */
export const CHIP_VALUES = [5, 25, 100, 500] as const;
export type ChipValue = (typeof CHIP_VALUES)[number];

interface ChipStyle {
  face: string;
  edge: string;
  /** Vrai quand le fond est clair et que le texte doit passer en noir. */
  light?: boolean;
}

const CHIP_STYLES: Record<number, ChipStyle> = {
  5: { face: 'var(--crimson-500)', edge: 'var(--bone-100)' },
  25: { face: 'var(--felt-500)', edge: 'var(--bone-100)' },
  100: { face: 'var(--ink-700)', edge: 'var(--bone-100)' },
  500: { face: 'var(--violet-500)', edge: 'var(--brass-500)' },
  1000: { face: 'var(--brass-500)', edge: 'var(--ink-900)', light: true },
};

const FALLBACK: ChipStyle = { face: 'var(--felt-600)', edge: 'var(--bone-300)' };

export interface ChipProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
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
  const style = CHIP_STYLES[value] ?? FALLBACK;
  const classes = [
    'chip',
    size === 'sm' && 'chip--sm',
    size === 'lg' && 'chip--lg',
    style.light ? 'chip--light' : 'chip--dark',
    active && 'chip--active',
    placed && 'chip--placed',
  ]
    .filter(Boolean)
    .join(' ');

  const css = {
    '--chip-face': style.face,
    '--chip-edge': style.edge,
  } as React.CSSProperties;

  const content = <span className="chip__value">{value}</span>;

  if (!onClick) {
    return (
      <span className={classes} style={css} role="img" aria-label={label ?? `Jeton de ${value} $`}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      style={css}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label ?? `Miser ${value} $`}
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
