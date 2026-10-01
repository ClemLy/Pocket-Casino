import { useMemo } from 'react';
import { colorOf, type WheelConfig } from '../engine/roulette';

const POCKET_FILL: Record<string, string> = {
  rouge: '#c8243f',
  noir: '#171411',
  vert: '#1f8a5a',
};

export interface RouletteWheelProps {
  wheel: WheelConfig;
  /** Rotation cumulee en degrés, pilotee par l'écran de jeu. */
  rotation: number;
  /**
   * Rotation cumulee de la bille. Toujours un multiple de 360 : la case
   * gagnante est alignee en haut, la bille doit donc finir en haut elle aussi.
   */
  ballRotation: number;
  spinning: boolean;
  /** Numéro sorti, affiche au centre une fois la bille posée. */
  landed: number | null;
  /** Duree du lancer, en millisecondes. */
  duration: number;
}

function polar(r: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
}

/**
 * Roue dessinee en SVG : bol en bois, cases numerotees, frettes en laiton et
 * tourelle centrale.
 *
 * La roue tourne, la bille contre-tourne moins vite : c'est ce décalage qui
 * donne l'impression que la bille glisse sur la piste avant de tomber dans
 * la case gagnante, toujours en haut, sous le repère.
 */
export function RouletteWheel({
  wheel,
  rotation,
  ballRotation,
  spinning,
  landed,
  duration,
}: RouletteWheelProps) {
  const pockets = wheel.order;
  const step = 360 / pockets.length;

  const sectors = useMemo(
    () =>
      pockets.map((n, i) => {
        const outer = 44;
        const inner = 31;
        const [x1, y1] = polar(outer, i * step);
        const [x2, y2] = polar(outer, (i + 1) * step);
        const [x3, y3] = polar(inner, (i + 1) * step);
        const [x4, y4] = polar(inner, i * step);
        const [lx, ly] = polar(39.6, (i + 0.5) * step);
        const [fx1, fy1] = polar(outer, i * step);
        const [fx2, fy2] = polar(27, i * step);
        return {
          n,
          path: `M${x1.toFixed(2)},${y1.toFixed(2)} A${outer},${outer} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${x3.toFixed(2)},${y3.toFixed(2)} A${inner},${inner} 0 0 0 ${x4.toFixed(2)},${y4.toFixed(2)} Z`,
          fill: POCKET_FILL[colorOf(wheel, n)],
          labelX: lx,
          labelY: ly,
          labelAngle: (i + 0.5) * step,
          fret: `M${fx1.toFixed(2)},${fy1.toFixed(2)} L${fx2.toFixed(2)},${fy2.toFixed(2)}`,
        };
      }),
    [pockets, step, wheel],
  );

  const fontSize = pockets.length > 20 ? 4.6 : 7;
  const timing = spinning ? `${duration}ms` : '0ms';

  return (
    <div className="wheel">
      <svg className="wheel__bowl" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <radialGradient id="wheel-wood" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#5a3a22" />
            <stop offset="70%" stopColor="#3a2416" />
            <stop offset="100%" stopColor="#1e120a" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="#0b0806" />
        <circle cx="50" cy="50" r="49" fill="url(#wheel-wood)" />
        <circle cx="50" cy="50" r="46.6" fill="none" stroke="#a3620f" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="45.6" fill="#0d0a08" />
      </svg>

      <div
        className="wheel__disc"
        style={{ transform: `rotate(${rotation}deg)`, transitionDuration: timing }}
      >
        <svg viewBox="0 0 100 100" role="img" aria-label={`Roue ${wheel.label}`}>
          {sectors.map((s) => (
            <g key={s.n}>
              <path d={s.path} fill={s.fill} />
              <text
                x={s.labelX}
                y={s.labelY}
                fill="#fff6e2"
                fontSize={fontSize}
                fontFamily="'Jersey 10', monospace"
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${s.labelAngle} ${s.labelX} ${s.labelY})`}
              >
                {s.n}
              </text>
            </g>
          ))}
          {sectors.map((s) => (
            <path key={`f-${s.n}`} d={s.fret} stroke="#d68e1f" strokeWidth="0.55" />
          ))}
          <circle cx="50" cy="50" r="44" fill="none" stroke="#d68e1f" strokeWidth="0.6" />
          <circle cx="50" cy="50" r="31" fill="none" stroke="#d68e1f" strokeWidth="0.6" />
          {/* Cone central et tourelle en croix */}
          <circle cx="50" cy="50" r="27" fill="#2a1d14" />
          <circle cx="50" cy="50" r="22" fill="#3b2a1d" />
          <circle cx="50" cy="50" r="15" fill="#54402f" />
          <path
            d="M50,33 L52.4,47.6 L67,50 L52.4,52.4 L50,67 L47.6,52.4 L33,50 L47.6,47.6 Z"
            fill="#f4b53b"
            stroke="#613608"
            strokeWidth="0.6"
          />
          <circle cx="50" cy="50" r="4.2" fill="#ffe08a" stroke="#613608" strokeWidth="0.6" />
        </svg>
      </div>

      {/* La bille reste dans le repere fixe et descend vers les cases. */}
      <div
        className="wheel__ball-track"
        style={{ transform: `rotate(${ballRotation}deg)`, transitionDuration: timing }}
      >
        <span
          className={`wheel__ball${spinning ? ' wheel__ball--spinning' : ''}`}
          style={{ transitionDuration: timing }}
        />
      </div>

      <span className="wheel__marker" aria-hidden="true" />

      <div className="wheel__readout" aria-live="polite">
        {landed === null ? null : (
          <span className={`wheel__number wheel__number--${colorOf(wheel, landed)}`}>{landed}</span>
        )}
      </div>
    </div>
  );
}
