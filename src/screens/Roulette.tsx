import { type CSSProperties, useMemo, useState } from 'react';
import { formatMoney } from '../engine/economy';
import {
  type Bet,
  type BetKind,
  betDefinitions,
  betWins,
  colorOf,
  payoutOf,
  resolveSpin,
  WHEELS,
  type WheelKind,
} from '../engine/roulette';
import { appRng } from '../engine/appRng';
import { useCasino } from '../store/useCasino';
import { useRoundActive } from '../store/useJuice';
import { sfxButton, sfxChip, sfxWheelTick } from '../audio/sfx';
import { Chip, CHIP_VALUES } from '../components/Chip';
import { Counter } from '../components/Counter';
import { RoundEnd } from '../components/RoundEnd';
import { RouletteWheel } from '../components/RouletteWheel';

const SPIN_MS = 4200;

/** Nombre de tirages gardes dans l'historique affiche sous la roue. */
const HISTORY_SIZE = 12;

const SIMPLE_KINDS: readonly BetKind[] = ['manque', 'pair', 'rouge', 'noir', 'impair', 'passe'];

function sameBet(a: Bet, b: Bet): boolean {
  return a.kind === b.kind && (a.value ?? null) === (b.value ?? null);
}

interface BetTarget {
  kind: BetKind;
  value?: number;
}

export function Roulette() {
  const bank = useCasino((s) => s.bank);
  const inventory = useCasino((s) => s.inventory);
  const presets = useCasino((s) => s.presets);
  const withdraw = useCasino((s) => s.withdraw);
  const consumeItem = useCasino((s) => s.consumeItem);
  const savePreset = useCasino((s) => s.savePreset);
  const removePreset = useCasino((s) => s.removePreset);
  const recordStat = useCasino((s) => s.recordStat);
  const unlock = useCasino((s) => s.unlock);

  const [kind, setKind] = useState<WheelKind>('europeenne');
  const [chip, setChip] = useState<number>(25);
  const [bets, setBets] = useState<Bet[]>([]);
  const [rotation, setRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<number | null>(null);
  const [marker, setMarker] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [hovered, setHovered] = useState<BetTarget | null>(null);
  const [safetyNet, setSafetyNet] = useState(false);
  const [result, setResult] = useState<{ amount: number; title: string; detail: string } | null>(
    null,
  );

  useRoundActive(spinning || result !== null);

  const wheel = WHEELS[kind];
  const defs = useMemo(() => betDefinitions(wheel), [wheel]);
  const stake = bets.reduce((sum, b) => sum + b.amount, 0);
  const numbers = useMemo(() => Array.from({ length: wheel.max }, (_, i) => i + 1), [wheel.max]);
  const columns = wheel.max / 3;
  /** Sur mobile le tapis passe a la verticale : les douzaines occupent une colonne a gauche. */
  const side = wheel.hasDozens ? 1 : 0;

  /** Numéros couverts par le pari survolé : on voit ce qu'on achète avant de miser. */
  const covered = useMemo(() => {
    if (!hovered || hovered.kind === 'straight') return new Set<number>();
    const probe: Bet = { ...hovered, amount: 0 };
    return new Set([0, ...numbers].filter((n) => betWins(wheel, probe, n)));
  }, [hovered, numbers, wheel]);

  const place = (kindOfBet: BetKind, value?: number) => {
    if (spinning) return;
    if (bank < stake + chip) return;
    sfxChip();
    setMarker(null);
    const incoming: Bet = { kind: kindOfBet, value, amount: chip };
    setBets((prev) => {
      const found = prev.find((b) => sameBet(b, incoming));
      if (found)
        return prev.map((b) => (sameBet(b, incoming) ? { ...b, amount: b.amount + chip } : b));
      return [...prev, incoming];
    });
  };

  const amountOn = (kindOfBet: BetKind, value?: number) =>
    bets.find((b) => sameBet(b, { kind: kindOfBet, value, amount: 0 }))?.amount ?? 0;

  const isWinner = (target: BetTarget) =>
    marker !== null && betWins(wheel, { ...target, amount: 0 }, marker);

  const clear = () => {
    sfxButton();
    setBets([]);
  };

  const spin = () => {
    if (spinning || stake === 0) return;
    if (!withdraw(stake)) return;

    const netActive = safetyNet && inventory.safetyNet > 0 && consumeItem('safetyNet');
    setSpinning(true);
    setLanded(null);
    setMarker(null);
    setResult(null);

    const index = appRng.int(0, wheel.order.length - 1);
    const number = wheel.order[index];
    const step = 360 / wheel.order.length;
    // Cinq tours complets minimum, puis on aligne la case gagnante en haut.
    setRotation((prev) => {
      const settled = ((prev % 360) + 360) % 360;
      return prev - settled + 360 * 5 + (360 - index * step);
    });
    // La bille fait trois tours a contre-sens et finit en haut, sur la case.
    setBallRotation((prev) => prev - 360 * 3);

    // Cliquetis de la bille, de plus en plus espaces.
    let delay = 300;
    let gap = 90;
    while (delay < SPIN_MS - 200) {
      sfxWheelTick(delay / 1000);
      delay += gap;
      gap *= 1.14;
    }

    window.setTimeout(() => {
      const outcome = resolveSpin(wheel, bets, number, netActive);
      setSpinning(false);
      setLanded(number);
      setMarker(number);
      setHistory((prev) => [number, ...prev].slice(0, HISTORY_SIZE));
      recordStat('toursDeRoulette', 1);
      if (number === 0 && netActive) unlock('zero-absolu');

      const color = colorOf(wheel, number);
      const detail = outcome.safetyNetUsed
        ? `Le ${number} vert sort. Safety Net : la moitié du tapis revient.`
        : `Le ${number} ${color} sort. Mises posées : ${formatMoney(outcome.totalStake)}.`;

      window.setTimeout(() => {
        setResult({
          amount: outcome.payout,
          title: outcome.payout > 0 ? 'La bille est pour toi' : 'Rien ne passe',
          detail,
        });
      }, 900);
    }, SPIN_MS);
  };

  const applyPreset = (id: string) => {
    const preset = presets.find((p) => p.id === id);
    if (!preset || spinning) return;
    sfxChip();
    setKind(preset.wheel);
    setBets(preset.bets.map((b) => ({ ...b })));
  };

  const storePreset = () => {
    if (bets.length === 0) return;
    const name = bets
      .slice(0, 2)
      .map((b) => `${b.amount}$ ${b.kind === 'straight' ? `n${b.value}` : b.kind}`)
      .join(' + ');
    savePreset({
      id: `preset-${Date.now()}`,
      name: bets.length > 2 ? `${name} +${bets.length - 2}` : name,
      wheel: kind,
      bets: bets.map((b) => ({ ...b })),
    });
  };

  const closeRound = () => {
    setResult(null);
    setLanded(null);
    // Le tapis se nettoie entre deux tours : pour rejouer la même combinaison,
    // le bouton "Sauver ce preset" est la pour ca.
    setBets([]);
    if (inventory.safetyNet === 0) setSafetyNet(false);
  };

  const hoverProps = (target: BetTarget) => ({
    onPointerEnter: () => setHovered(target),
    onPointerLeave: () => setHovered(null),
    onFocus: () => setHovered(target),
    onBlur: () => setHovered(null),
  });

  const cellState = (n: number) =>
    [covered.has(n) && 'is-covered', marker === n && 'is-winner'].filter(Boolean).join(' ');

  const outsideLabel = (def: { kind: BetKind; label: string }) =>
    def.kind === 'manque' || def.kind === 'passe'
      ? def.label.replace(/^(Manque|Passe) /, '')
      : def.label;

  // Sur telephone la roue n'a pas sa place a cote du tapis : elle surgit en
  // grand le temps du lancer, puis s'efface quand le resultat est affiche.
  const wheelLive = spinning || (landed !== null && result === null);

  return (
    <div className="game roulette">
      <section className={`wheel-column${wheelLive ? ' is-live' : ''}`} aria-label="Roue">
        <RouletteWheel
          wheel={wheel}
          rotation={rotation}
          ballRotation={ballRotation}
          spinning={spinning}
          landed={landed}
          duration={SPIN_MS}
        />
      </section>

      <div className="history" aria-label="Derniers numéros sortis">
        <span className="t-label">Derniers numéros</span>
        <ol className="history__list">
          {history.length === 0 ? (
            <li className="history__empty">Aucun tirage pour l&apos;instant</li>
          ) : (
            history.map((n, i) => (
              <li
                key={`${history.length - i}-${n}`}
                className={`history__pill history__pill--${colorOf(wheel, n)}${i === 0 ? ' is-last' : ''}`}
              >
                {n}
              </li>
            ))
          )}
        </ol>
      </div>

      <div className="panel roulette-bar">
        <div className="segmented roulette-bar__type" role="radiogroup" aria-label="Type de roue">
          {(Object.keys(WHEELS) as WheelKind[]).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={kind === key}
              className={`segmented__btn${kind === key ? ' is-on' : ''}`}
              disabled={spinning}
              title={
                key === 'turbo'
                  ? 'Roue courte : 12 numéros plus le zéro, numéro plein à 11 contre 1.'
                  : 'Roue classique : 37 numéros, numéro plein à 35 contre 1.'
              }
              onClick={() => {
                sfxButton();
                setKind(key);
                setBets([]);
                setLanded(null);
                setMarker(null);
                setHistory([]);
              }}
            >
              <span className="segmented__name">
                {key === 'europeenne' ? (
                  <>
                    <span className="segmented__long">Européenne</span>
                    <span className="segmented__short">Europe</span>
                  </>
                ) : (
                  WHEELS[key].label
                )}
              </span>
              <span className="segmented__meta">{WHEELS[key].order.length} cases</span>
            </button>
          ))}
        </div>

        <div className="chip-rack roulette-bar__chips" role="group" aria-label="Jeton à poser">
          {CHIP_VALUES.map((value) => (
            <Chip
              key={value}
              value={value}
              active={chip === value}
              disabled={bank < value}
              onClick={() => setChip(value)}
              label={`Sélectionner le jeton de ${value} $`}
            />
          ))}
        </div>

        <div className="roulette-bar__stake">
          <span className="t-label">Mises posées</span>
          <span className="led roulette-bar__led">
            <Counter value={stake} money />
          </span>
        </div>

        <div className="roulette-bar__row">
          <label
            className="toggle roulette-bar__safety"
            title="Safety Net : sur un zéro, la moitié du tapis revient."
          >
            <input
              type="checkbox"
              checked={safetyNet}
              disabled={inventory.safetyNet === 0 || spinning}
              onChange={(event) => setSafetyNet(event.target.checked)}
            />
            <span className="toggle__track" aria-hidden="true">
              <span className="toggle__thumb" />
            </span>
            <span className="toggle__text">
              <span className="toggle__title">
                Safety<span className="roulette-bar__long"> Net</span> · {inventory.safetyNet}
              </span>
            </span>
          </label>

          <details className="presets roulette-bar__presets">
            <summary className="link-btn presets__summary">
              Presets{presets.length > 0 ? ` (${presets.length})` : ''}
            </summary>
            <div className="presets__menu">
              <button
                type="button"
                className="link-btn"
                disabled={bets.length === 0 || spinning}
                onClick={storePreset}
              >
                Sauver le tapis actuel
              </button>
              {presets.length === 0 ? (
                <p className="presets__empty">Aucun preset enregistré.</p>
              ) : null}
              {presets.map((preset) => (
                <span key={preset.id} className="preset">
                  <button
                    type="button"
                    className="preset__load"
                    onClick={() => applyPreset(preset.id)}
                    disabled={spinning}
                  >
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    className="preset__del"
                    onClick={() => removePreset(preset.id)}
                    aria-label={`Supprimer le preset ${preset.name}`}
                  >
                    <span aria-hidden="true" className="preset__cross" />
                  </button>
                </span>
              ))}
            </div>
          </details>

          <div className="roulette-bar__go">
            <button
              type="button"
              className="btn btn--ghost btn--lg"
              disabled={spinning}
              onClick={clear}
            >
              Effacer
            </button>
            <button
              type="button"
              className="btn btn--lg grow"
              disabled={spinning || stake === 0 || bank < stake}
              onClick={spin}
            >
              {spinning ? 'La bille tourne…' : 'Lancer la bille'}
            </button>
          </div>
        </div>
      </div>

      {/* Tapis de mise, disposé comme une vraie table */}
      <section className={`layout layout--${kind}`} aria-label="Tapis de mise">
        <div className="layout__grid" style={{ '--cols': columns } as CSSProperties}>
          <button
            type="button"
            className={`board__cell board__cell--zero ${cellState(0)}`}
            onClick={() => place('straight', 0)}
            disabled={spinning}
            aria-label="Numéro 0"
          >
            <span>0</span>
            {amountOn('straight', 0) > 0 ? (
              <Chip value={amountOn('straight', 0)} size="xs" placed />
            ) : null}
          </button>

          {numbers.map((n) => (
            <button
              key={n}
              type="button"
              className={`board__cell board__cell--${colorOf(wheel, n)} ${cellState(n)}`}
              style={
                {
                  '--c': Math.ceil(n / 3) + 1,
                  '--r': 3 - ((n - 1) % 3),
                  '--vc': ((n - 1) % 3) + 1 + side,
                  '--vr': Math.ceil(n / 3) + 1,
                } as CSSProperties
              }
              onClick={() => place('straight', n)}
              disabled={spinning}
            >
              <span>{n}</span>
              {amountOn('straight', n) > 0 ? (
                <Chip value={amountOn('straight', n)} size="xs" placed />
              ) : null}
            </button>
          ))}

          {wheel.hasDozens
            ? [1, 2, 3].map((v) => (
                <OutsideCell
                  key={`col-${v}`}
                  className={`outside__cell--colonne${isWinner({ kind: 'colonne', value: v }) ? ' is-winner' : ''}`}
                  style={
                    {
                      '--c': columns + 2,
                      '--r': 4 - v,
                      '--vc': v + side,
                      '--vr': columns + 2,
                    } as CSSProperties
                  }
                  label="2:1"
                  title={`Colonne ${v} : paye 2 contre 1`}
                  amount={amountOn('colonne', v)}
                  disabled={spinning}
                  onClick={() => place('colonne', v)}
                  hover={hoverProps({ kind: 'colonne', value: v })}
                  ariaLabel={`Colonne ${v}`}
                />
              ))
            : null}

          {wheel.hasDozens
            ? [1, 2, 3].map((v) => (
                <OutsideCell
                  key={`dz-${v}`}
                  className={`outside__cell--douzaine${isWinner({ kind: 'douzaine', value: v }) ? ' is-winner' : ''}`}
                  style={
                    {
                      '--c': `${(v - 1) * 4 + 2} / span 4`,
                      '--r': 4,
                      '--vc': 1,
                      '--vr': `${(v - 1) * 4 + 2} / span 4`,
                    } as CSSProperties
                  }
                  label={`${['1re', '2e', '3e'][v - 1]} douzaine`}
                  odds="2:1"
                  title={`Douzaine ${v} : paye 2 contre 1`}
                  amount={amountOn('douzaine', v)}
                  disabled={spinning}
                  onClick={() => place('douzaine', v)}
                  hover={hoverProps({ kind: 'douzaine', value: v })}
                  ariaLabel={`Douzaine ${v}`}
                />
              ))
            : null}
        </div>

        <div className="layout__simples">
          {SIMPLE_KINDS.map((k) => {
            const def = defs.find((d) => d.kind === k);
            if (!def) return null;
            return (
              <OutsideCell
                key={k}
                className={`outside__cell--${k}${isWinner({ kind: k }) ? ' is-winner' : ''}`}
                label={outsideLabel(def)}
                odds={`${def.payout}:1`}
                title={`${def.hint} : paye ${def.payout} contre 1`}
                amount={amountOn(k)}
                disabled={spinning}
                onClick={() => place(k)}
                hover={hoverProps({ kind: k })}
                ariaLabel={def.label}
              />
            );
          })}
        </div>

        <p className="layout__note">
          Numéro plein {payoutOf(wheel, 'straight')} contre 1. Le zéro fait tomber toutes les
          chances simples.
        </p>
      </section>

      {result ? (
        <RoundEnd
          amount={result.amount}
          title={result.title}
          detail={result.detail}
          onDone={closeRound}
          continueLabel="Reposer des mises"
        />
      ) : null}
    </div>
  );
}

interface OutsideCellProps {
  className: string;
  label: string;
  odds?: string;
  title: string;
  amount: number;
  disabled: boolean;
  onClick: () => void;
  hover: Record<string, () => void>;
  ariaLabel: string;
  style?: CSSProperties;
}

function OutsideCell({
  className,
  label,
  odds,
  title,
  amount,
  disabled,
  onClick,
  hover,
  ariaLabel,
  style,
}: OutsideCellProps) {
  return (
    <button
      type="button"
      className={`outside__cell ${className}`}
      style={style}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={`${ariaLabel}, ${title}`}
      {...hover}
    >
      {className.includes('--rouge') || className.includes('--noir') ? (
        <span className="outside__diamond" aria-hidden="true" />
      ) : null}
      <span className="outside__label">{label}</span>
      {odds ? <span className="outside__odds">{odds}</span> : null}
      {amount > 0 ? <Chip value={amount} size="xs" placed /> : null}
    </button>
  );
}
