import { useMemo } from 'react';
import {
  DEFAULT_PALETTE,
  SPRITES,
  type Sprite as SpriteData,
  type SpriteName,
} from '../assets/sprites';

interface Run {
  x: number;
  y: number;
  width: number;
  color: string;
}

/**
 * Compresse la grille en segments horizontaux : une ligne de 8 pixels de la
 * même couleur donne 1 rect au lieu de 8. Ca divise par 4 a 6 le nombre de
 * noeuds SVG, ce qui compte quand une main affiche 8 cartes animees.
 */
function toRuns(data: SpriteData, palette: Record<string, string>): Run[] {
  const runs: Run[] = [];
  data.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x];
      if (char === '.') {
        x++;
        continue;
      }
      let width = 1;
      while (x + width < row.length && row[x + width] === char) width++;
      const color = palette[char];
      if (color) runs.push({ x, y, width, color });
      x += width;
    }
  });
  return runs;
}

export interface SpriteProps {
  /** Picto du catalogue 16x16. Ignore si `data` est fourni. */
  name?: SpriteName;
  /** Grille brute, pour les dessins hors catalogue (portraits de figures). */
  data?: SpriteData;
  /** Cote du rendu en pixels CSS (le plus grand des deux cotes). */
  size?: number;
  /** Surcharges de palette, par exemple `{ a: 'var(--rouge-500)' }`. */
  palette?: Record<string, string>;
  className?: string;
  /** Renseigne pour un picto porteur de sens, laisse vide pour un decor. */
  title?: string;
  /** Occupe tout le conteneur en etirant le motif. Ignore alors `size`. */
  fill?: boolean;
}

export function Sprite({
  name,
  data,
  size = 16,
  palette,
  className,
  title,
  fill = false,
}: SpriteProps) {
  const sprite = data ?? SPRITES[name ?? 'chip'];
  const colors = useMemo(() => ({ ...DEFAULT_PALETTE, ...palette }), [palette]);
  const runs = useMemo(() => toRuns(sprite, colors), [sprite, colors]);

  // Les portraits ne sont pas carres : on garde leurs proportions.
  const ratio = sprite.width / sprite.height;
  const width = ratio >= 1 ? size : Math.round(size * ratio);
  const height = ratio >= 1 ? Math.round(size / ratio) : size;

  return (
    <svg
      className={className}
      width={fill ? '100%' : width}
      height={fill ? '100%' : height}
      viewBox={`0 0 ${sprite.width} ${sprite.height}`}
      preserveAspectRatio={fill ? 'none' : 'xMidYMid meet'}
      shapeRendering="crispEdges"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {runs.map((run) => (
        <rect
          key={`${run.x}-${run.y}`}
          x={run.x}
          y={run.y}
          width={run.width}
          height={1}
          fill={run.color}
        />
      ))}
    </svg>
  );
}
