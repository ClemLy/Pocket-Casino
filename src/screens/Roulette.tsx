import { useMemo, useState } from 'react';
import { formatMoney } from '../engine/economy';
import {
  type Bet,
  type BetKind,
  betDefinitions,
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
import { RoundEnd } from '../components/RoundEnd';
import { RouletteWheel } from '../components/RouletteWheel';
import { Sprite } from '../components/Sprite';

const SPIN_MS = 4200;

function sameBet(a: Bet, b: Bet): boolean {
  return a.kind === b.kind && (a.value ?? null) === (b.value ?? null);
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
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<number | null>(null);
  const [safetyNet, setSafetyNet] = useState(false);
  const [result, setResult] = useState<{ amount: number; title: string; detail: string } | null>(
    null,
  );

  useRoundActive(spinning || result !== null);

  const wheel = WHEELS[kind];
  const defs = useMemo(() => betDefinitions(wheel), [wheel]);
  const stake = bets.reduce((sum, b) => sum + b.amount, 0);
  const numbers = useMemo(() => Array.from({ length: wheel.max }, (_, i) => i + 1), [wheel.max]);

  const place = (kindOfBet: BetKind, value?: number) => {
    if (spinning) return;
    if (bank < stake + chip) return;
    sfxChip();
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
    setResult(null);

    const index = appRng.int(0, wheel.order.length - 1);
    const number = wheel.order[index];
    const step = 360 / wheel.order.length;
    // Cinq tours complets minimum, puis on aligne la case gagnante en haut.
    const target = 360 * 5 + (360 - index * step);
    setRotation((prev) => prev + target);

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
      recordStat('toursDeRoulette', 1);
      if (number === 0 && netActive) unlock('zero-absolu');

      const color = colorOf(wheel, number);
      const detail = outcome.safetyNetUsed
        ? `Le ${number} vert sort. Safety Net : la moitié du tapis revient.`
        : `Le ${number} ${color} sort. Mises posées : ${formatMoney(outcome.totalStake)}.`;

      window.setTimeout(() => {
        setResult({
          amount: outcome.payout,
          title: outcome.payout > 0 ? 'LA BILLE EST POUR TOI' : 'RIEN NE PASSE',
          detail,
        });
      }, 550);
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

  return (
    <div className="shell col" style={{ gap: 'var(--u4)' }}>
      <div className="roulette-top">
        <RouletteWheel wheel={wheel} rotation={rotation} spinning={spinning} landed={landed} />

        <div className="panel col grow">
          <h2 className="panel__title">TABLE</h2>
          <div className="row row--wrap">
            {(Object.keys(WHEELS) as WheelKind[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`btn btn--sm${kind === key ? '' : ' btn--ghost'}`}
                disabled={spinning}
                onClick={() => {
                  sfxButton();
                  setKind(key);
                  setBets([]);
                  setLanded(null);
                }}
              >
                {WHEELS[key].label} ({WHEELS[key].order.length} cases)
              </button>
            ))}
          </div>

          <p className="t-body t-muted">
            {wheel.kind === 'turbo'
              ? 'Roue courte : 12 numéros plus le zero, numéro plein à 11 contre 1. Les tours vont vite.'
              : 'Roue classique : 37 numéros, numéro plein à 35 contre 1, douzaines et colonnes ouvertes.'}
          </p>

          <div className="row row--between">
            <span className="t-label">Mises posées</span>
            <span className="led" style={{ fontSize: 22 }}>
              {formatMoney(stake)}
            </span>
          </div>

          <div className="chip-rack">
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

          <label className="bj-sidebet">
            <input
              type="checkbox"
              checked={safetyNet}
              disabled={inventory.safetyNet === 0 || spinning}
              onChange={(event) => setSafetyNet(event.target.checked)}
            />
            <span className="t-body">
              Poser un Safety Net ({inventory.safetyNet} en stock) : sur un zéro, tu récupères 50 %
              du tapis.
            </span>
          </label>

          <div className="row row--wrap">
            <button
              type="button"
              className="btn btn--lg grow"
              disabled={spinning || stake === 0 || bank < stake}
              onClick={spin}
            >
              {spinning ? 'La bille tourne...' : 'Lancer la bille'}
            </button>
            <button type="button" className="btn btn--ghost" disabled={spinning} onClick={clear}>
              Effacer
            </button>
          </div>

          <div className="row row--wrap">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={bets.length === 0 || spinning}
              onClick={storePreset}
            >
              <Sprite name="chip" size={14} />
              Sauver ce preset
            </button>
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
                  x
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tapis de mise */}
      <div className="table-felt">
        <div className={`board board--${kind}`}>
          <button
            type="button"
            className="board__cell board__cell--zero"
            onClick={() => place('straight', 0)}
            disabled={spinning}
          >
            <span>0</span>
            {amountOn('straight', 0) > 0 ? (
              <Chip value={amountOn('straight', 0)} size="sm" placed />
            ) : null}
          </button>

          <div className="board__numbers">
            {numbers.map((n) => (
              <button
                key={n}
                type="button"
                className={`board__cell board__cell--${colorOf(wheel, n)}`}
                onClick={() => place('straight', n)}
                disabled={spinning}
              >
                <span>{n}</span>
                {amountOn('straight', n) > 0 ? (
                  <Chip value={amountOn('straight', n)} size="sm" placed />
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="outside">
          {defs
            .filter((d) => d.kind !== 'straight')
            .flatMap((d) =>
              d.kind === 'douzaine' || d.kind === 'colonne'
                ? [1, 2, 3].map((v) => ({ ...d, value: v, label: `${d.label} ${v}` }))
                : [{ ...d, value: undefined as number | undefined }],
            )
            .map((d) => (
              <button
                key={`${d.kind}-${d.value ?? 'x'}`}
                type="button"
                className={`outside__cell outside__cell--${d.kind}`}
                onClick={() => place(d.kind, d.value)}
                disabled={spinning}
                title={`${d.hint} - paye ${d.payout} contre 1`}
              >
                <span className="outside__label">{d.label}</span>
                <span className="outside__odds">{d.payout}:1</span>
                {amountOn(d.kind, d.value) > 0 ? (
                  <Chip value={amountOn(d.kind, d.value)} size="sm" placed />
                ) : null}
              </button>
            ))}
        </div>

        <p className="t-body t-muted center" style={{ marginTop: 'var(--u3)' }}>
          Numéro plein {payoutOf(wheel, 'straight')} contre 1. Le zéro fait tomber toutes les
          chances simples.
        </p>
      </div>

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
