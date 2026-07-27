import { useMemo } from 'react';
import { colorOf, type WheelConfig } from '../engine/roulette';

const POCKET_FILL: Record<string, string> = {
  rouge: '#d7263d',
  noir: '#12100d',
  vert: '#2f8049',
};

export interface RouletteWheelProps {
  wheel: WheelConfig;
  /** Rotation cumulee en degrés, pilotee par l'écran de jeu. */
  rotation: number;
  spinning: boolean;
  /** Numéro sorti, affiche au centre une fois la bille posée. */
  landed: number | null;
}

/**
 * Roue dessinee en SVG : un secteur par case, numéro grave dessus.
 *
 * La roue tourne, la bille contre-tourne moins vite : c'est ce décalage qui
 * donne l'impression que la bille glisse sur la piste avant de tomber.
 */
export function RouletteWheel({ wheel, rotation, spinning, landed }: RouletteWheelProps) {
  const pockets = wheel.order;
  const step = 360 / pockets.length;

  const sectors = useMemo(
    () =>
      pockets.map((n, i) => {
        const start = (i * step - 90) * (Math.PI / 180);
        const end = ((i + 1) * step - 90) * (Math.PI / 180);
        const r = 48;
        const x1 = 50 + r * Math.cos(start);
        const y1 = 50 + r * Math.sin(start);
        const x2 = 50 + r * Math.cos(end);
        const y2 = 50 + r * Math.sin(end);
        const mid = ((i + 0.5) * step - 90) * (Math.PI / 180);
        return {
          n,
          path: `M50,50 L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`,
          fill: POCKET_FILL[colorOf(wheel, n)],
          labelX: 50 + 38 * Math.cos(mid),
          labelY: 50 + 38 * Math.sin(mid),
          labelAngle: (i + 0.5) * step,
        };
      }),
    [pockets, step, wheel],
  );

  const fontSize = pockets.length > 20 ? 4.4 : 7;

  return (
    <div className="wheel">
      <div
        className="wheel__disc"
        style={{
          transform: `rotate(${rotation}deg)`,
          transitionDuration: spinning ? '4200ms' : '0ms',
        }}
      >
        <svg viewBox="0 0 100 100" role="img" aria-label={`Roue ${wheel.label}`}>
          <circle cx="50" cy="50" r="49.5" fill="#2a1509" />
          {sectors.map((s) => (
            <g key={s.n}>
              <path d={s.path} fill={s.fill} stroke="#050807" strokeWidth="0.35" />
              <text
                x={s.labelX}
                y={s.labelY}
                fill="#f4ecd8"
                fontSize={fontSize}
                fontFamily="VT323, monospace"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${s.labelAngle} ${s.labelX} ${s.labelY})`}
              >
                {s.n}
              </text>
            </g>
          ))}
          <circle cx="50" cy="50" r="20" fill="#4a2712" stroke="#050807" strokeWidth="1" />
          <circle cx="50" cy="50" r="12" fill="#6d3b1c" stroke="#050807" strokeWidth="0.8" />
        </svg>
      </div>

      {/* La bille reste dans le repere fixe et remonte doucement vers le centre. */}
      <div
        className="wheel__ball-track"
        style={{
          transform: `rotate(${-rotation * 0.42}deg)`,
          transitionDuration: spinning ? '4200ms' : '0ms',
        }}
      >
        <span className={`wheel__ball${spinning ? ' wheel__ball--spinning' : ''}`} />
      </div>

      <div className="wheel__readout" aria-live="polite">
        {landed === null ? (
          <span className="t-body t-brass">Prêt</span>
        ) : (
          <span className={`wheel__number wheel__number--${colorOf(wheel, landed)}`}>{landed}</span>
        )}
      </div>
    </div>
  );
}
