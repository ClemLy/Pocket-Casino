import { useCallback, useEffect, useRef, useState } from 'react';
import {
  formatMoney,
  MAFIA_DEBT,
  MAFIA_LOAN,
  SIDE_JOB_DURATION_MS,
  SIDE_JOB_REWARD,
  spinWheel,
  WHEEL_SLICES,
} from '../engine/economy';
import { appRng } from '../engine/appRng';
import { useCasino } from '../store/useCasino';
import { useJuice } from '../store/useJuice';
import { sfxButton, sfxCoin, sfxWheelTick, sfxWin } from '../audio/sfx';
import { Sprite } from '../components/Sprite';

type Mode = 'menu' | 'roue' | 'job';

interface Coin {
  id: number;
  /** Position horizontale en pourcentage de la largeur. */
  x: number;
  /** Duree de chute en millisecondes. */
  fall: number;
  value: number;
}

const COIN_VALUE = 5;
const SPIN_MS = 3400;

/**
 * Écran anti-banqueroute : il s'ouvre tout seul quand la banque tombe à zéro.
 * Trois portes de sortie, chacune avec son coût cache.
 */
export function Broke({ onRecovered }: { onRecovered: () => void }) {
  const [mode, setMode] = useState<Mode>('menu');
  const canSpinWheel = useCasino((s) => s.canSpinWheel);
  const claimWheel = useCasino((s) => s.claimWheel);
  const claimSideJob = useCasino((s) => s.claimSideJob);
  const takeLoan = useCasino((s) => s.takeLoan);
  const debt = useCasino((s) => s.debt);
  const juice = useJuice();

  const wheelAvailable = canSpinWheel();

  if (mode === 'roue') {
    return (
      <LastChanceWheel
        onDone={(amount) => {
          claimWheel(amount);
          juice.rain(30);
          onRecovered();
        }}
        onCancel={() => setMode('menu')}
      />
    );
  }

  if (mode === 'job') {
    return (
      <SideJob
        onDone={(amount) => {
          claimSideJob(amount);
          onRecovered();
        }}
        onCancel={() => setMode('menu')}
      />
    );
  }

  return (
    <div className="stage-backdrop">
      <div className="stage broke">
        <div className="stage__emblem">
          <Sprite name="skull" size={72} title="Banque vide" />
        </div>
        <p className="stage__kicker t-perte">Banque vide</p>
        <h2 className="stage__title">Plus un jeton</h2>
        <p className="stage__detail">
          Le videur te regarde de travers. Trois façons de remonter sur la table.
        </p>

        <div className="broke__options">
          <button
            type="button"
            className="broke__option"
            disabled={!wheelAvailable}
            onClick={() => {
              sfxButton();
              setMode('roue');
            }}
          >
            <span className="broke__icon">
              <Sprite name="wheel" size={36} />
            </span>
            <span className="broke__name">Roue de la Dernière Chance</span>
            <span className="broke__desc">
              {wheelAvailable
                ? 'De 100 $ à 500 $. Une rotation par tranche de 20 heures.'
                : 'Déjà utilisée. Reviens dans quelques heures.'}
            </span>
          </button>

          <button
            type="button"
            className="broke__option"
            disabled={debt > 0}
            onClick={() => {
              sfxButton();
              if (takeLoan()) onRecovered();
            }}
          >
            <span className="broke__icon">
              <Sprite name="bill" size={36} />
            </span>
            <span className="broke__name">Mafia du Casino</span>
            <span className="broke__desc">
              {debt > 0
                ? `Tu dois déjà ${formatMoney(debt)}. Pas de deuxième avance.`
                : `${formatMoney(MAFIA_LOAN)} tout de suite, ${formatMoney(MAFIA_DEBT)} a rendre via une taxe de 20 % sur tes gains.`}
            </span>
          </button>

          <button
            type="button"
            className="broke__option"
            onClick={() => {
              sfxButton();
              setMode('job');
            }}
          >
            <span className="broke__icon">
              <Sprite name="coin" size={36} />
            </span>
            <span className="broke__name">Job d&apos;appoint</span>
            <span className="broke__desc">
              Dix secondes pour ramasser les pièces tombées sous les machines. Jusqu&apos;à{' '}
              {formatMoney(SIDE_JOB_REWARD)}.
            </span>
          </button>
        </div>

        <button
          type="button"
          className="link-btn stage__escape"
          onClick={() => {
            sfxButton();
            onRecovered();
          }}
        >
          Plus tard, je regarde les tables
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function LastChanceWheel({
  onDone,
  onCancel,
}: {
  onDone: (amount: number) => void;
  onCancel: () => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const slice = 360 / WHEEL_SLICES.length;

  const spin = () => {
    if (spinning || amount !== null) return;
    setSpinning(true);
    const outcome = spinWheel(appRng);
    setRotation((prev) => prev + 360 * 4 + (360 - outcome.index * slice));

    let delay = 250;
    let gap = 100;
    while (delay < SPIN_MS - 200) {
      sfxWheelTick(delay / 1000);
      delay += gap;
      gap *= 1.16;
    }

    window.setTimeout(() => {
      setSpinning(false);
      setAmount(outcome.amount);
      sfxWin();
    }, SPIN_MS);
  };

  return (
    <div className="stage-backdrop">
      <div className="stage">
        <p className="stage__kicker">Sur le comptoir</p>
        <h2 className="stage__title">Roue de la dernière chance</h2>

        <div className="lastchance">
          <div
            className="lastchance__disc"
            style={{
              transform: `rotate(${rotation}deg)`,
              transitionDuration: spinning ? `${SPIN_MS}ms` : '0ms',
            }}
          >
            <svg viewBox="0 0 100 100" role="img" aria-label="Roue de la dernière chance">
              {WHEEL_SLICES.map((s, i) => {
                const start = (i * slice - 90) * (Math.PI / 180);
                const end = ((i + 1) * slice - 90) * (Math.PI / 180);
                const x1 = 50 + 48 * Math.cos(start);
                const y1 = 50 + 48 * Math.sin(start);
                const x2 = 50 + 48 * Math.cos(end);
                const y2 = 50 + 48 * Math.sin(end);
                const mid = ((i + 0.5) * slice - 90) * (Math.PI / 180);
                return (
                  <g key={s.amount}>
                    <path
                      d={`M50,50 L${x1.toFixed(2)},${y1.toFixed(2)} A48,48 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`}
                      fill={i % 2 === 0 ? '#1e6c51' : '#1b1815'}
                      stroke="#d68e1f"
                      strokeWidth="0.5"
                    />
                    <text
                      x={50 + 33 * Math.cos(mid)}
                      y={50 + 33 * Math.sin(mid)}
                      fill="#ffcd57"
                      fontSize="9"
                      fontFamily="'Jersey 10', monospace"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${(i + 0.5) * slice} ${50 + 33 * Math.cos(mid)} ${50 + 33 * Math.sin(mid)})`}
                    >
                      {s.amount}
                    </text>
                  </g>
                );
              })}
              <circle cx="50" cy="50" r="12" fill="#3b2a1d" stroke="#d68e1f" strokeWidth="1" />
              <circle cx="50" cy="50" r="5" fill="#ffe08a" />
            </svg>
          </div>
          <span className="lastchance__needle" aria-hidden="true" />
        </div>

        {amount === null ? (
          <div className="stage__actions stage__actions--row">
            <button type="button" className="btn btn--lg grow" disabled={spinning} onClick={spin}>
              {spinning ? 'Elle tourne...' : 'Lancer la roue'}
            </button>
            <button type="button" className="btn btn--ghost" disabled={spinning} onClick={onCancel}>
              Retour
            </button>
          </div>
        ) : (
          <>
            <div className="stage__amount num">+ {formatMoney(amount)}</div>
            <button type="button" className="btn btn--lg btn--wide" onClick={() => onDone(amount)}>
              Empocher et retourner jouer
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function SideJob({ onDone, onCancel }: { onDone: (amount: number) => void; onCancel: () => void }) {
  const [running, setRunning] = useState(false);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [earned, setEarned] = useState(0);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(SIDE_JOB_DURATION_MS);
  const nextId = useRef(1);

  const catchCoin = useCallback((coin: Coin) => {
    sfxCoin();
    setCoins((prev) => prev.filter((c) => c.id !== coin.id));
    setEarned((prev) => Math.min(SIDE_JOB_REWARD, prev + coin.value));
  }, []);

  useEffect(() => {
    if (!running) return;

    const spawner = window.setInterval(() => {
      const coin: Coin = {
        id: nextId.current++,
        x: appRng.int(4, 92),
        fall: appRng.int(1500, 2400),
        value: COIN_VALUE,
      };
      setCoins((prev) => [...prev, coin]);
      // Nettoyage : la piece disparait si elle touche le sol.
      window.setTimeout(() => setCoins((prev) => prev.filter((c) => c.id !== coin.id)), coin.fall);
    }, 380);

    const ticker = window.setInterval(() => setTimeLeft((t) => Math.max(0, t - 100)), 100);
    const ender = window.setTimeout(() => {
      setRunning(false);
      setFinished(true);
      setCoins([]);
    }, SIDE_JOB_DURATION_MS);

    return () => {
      window.clearInterval(spawner);
      window.clearInterval(ticker);
      window.clearTimeout(ender);
    };
  }, [running]);

  return (
    <div className="stage-backdrop">
      <div className="stage sidejob">
        <p className="stage__kicker">Sous les machines</p>
        <h2 className="stage__title">Job d&apos;appoint</h2>

        <div className="sidejob__hud">
          <span className="led led--green sidejob__led">{formatMoney(earned)}</span>
          <span className="led sidejob__led">
            {(timeLeft / 1000).toFixed(1).replace('.', ',')} s
          </span>
        </div>

        <div className="sidejob__arena">
          {coins.map((coin) => (
            <button
              key={coin.id}
              type="button"
              className="sidejob__coin"
              style={{ left: `${coin.x}%`, animationDuration: `${coin.fall}ms` }}
              onClick={() => catchCoin(coin)}
              aria-label={`Ramasser ${coin.value} $`}
            >
              <Sprite name="coin" size={30} />
            </button>
          ))}
          {!running && !finished ? (
            <p className="t-body sidejob__hint">
              Clique sur les pièces avant qu&apos;elles ne touchent le sol.
            </p>
          ) : null}
          {finished ? <p className="t-body sidejob__hint">Service termine.</p> : null}
        </div>

        <div className="stage__actions stage__actions--row">
          {finished ? (
            <button type="button" className="btn btn--lg grow" onClick={() => onDone(earned)}>
              Encaisser {formatMoney(earned)}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn--lg grow"
                disabled={running}
                onClick={() => {
                  sfxButton();
                  setRunning(true);
                }}
              >
                {running ? 'Ramasse !' : 'Commencer'}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={running}
                onClick={onCancel}
              >
                Retour
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
