import type { CSSProperties } from 'react';
import { type Card } from '../engine/cards';
import { formatMoney } from '../engine/economy';
import { TROPHIES } from '../engine/trophies';
import { useCasino } from '../store/useCasino';
import { sfxButton } from '../audio/sfx';
import { ChipStack } from '../components/Chip';
import { PlayingCard } from '../components/PlayingCard';

export type GameScreen = 'poker' | 'blackjack' | 'roulette';

interface ModeInfo {
  id: GameScreen;
  kicker: string;
  title: string;
  tagline: string;
  facts: string[];
}

const MODES: readonly ModeInfo[] = [
  {
    id: 'poker',
    kicker: 'Roguelike',
    title: 'Poker',
    tagline: 'Atteins le score cible en 4 mains. Achète des jokers. Recommence plus fort.',
    facts: ['8 cartes', '3 défausses', 'Boutique'],
  },
  {
    id: 'blackjack',
    kicker: 'Arcade',
    title: 'Blackjack',
    tagline: "Le 21 classique, plus trois jetons d'avantage à équiper avant de jouer.",
    facts: ['Split', 'Double', 'Perfect Pairs'],
  },
  {
    id: 'roulette',
    kicker: 'Turbo',
    title: 'Roulette',
    tagline: 'Européenne à 37 cases ou Turbo à 13 cases pour enchaîner les tours.',
    facts: ['Presets', 'Safety Net', 'Cotes en direct'],
  },
];

const ROYAL: Card[] = (['10', 'J', 'Q', 'K', 'A'] as const).map((rank) => ({
  id: `lobby-${rank}H`,
  rank,
  suit: 'H',
}));

const BLACKJACK: Card[] = [
  { id: 'lobby-AS', rank: 'A', suit: 'S' },
  { id: 'lobby-KD', rank: 'K', suit: 'D' },
];

/** Nombre d'ampoules sur chaque bord de l'enseigne. */
const BULBS_X = 22;
const BULBS_Y = 5;

export interface LobbyProps {
  onPlay: (screen: GameScreen) => void;
  onOpenShop: () => void;
  onOpenRules: () => void;
}

export function Lobby({ onPlay, onOpenShop, onOpenRules }: LobbyProps) {
  const bank = useCasino((s) => s.bank);
  const stats = useCasino((s) => s.stats);
  const trophies = useCasino((s) => s.trophies);
  const unlocked = Object.keys(trophies).length;

  return (
    <div className="shell lobby">
      <section className="marquee" aria-labelledby="lobby-title">
        <Bulbs />
        <div className="marquee__plate">
          <p className="marquee__kicker">Ouvert toute la nuit</p>
          <h1 id="lobby-title" className="marquee__title">
            Pocket Casino
          </h1>
          <p className="marquee__sub">
            Trois tables, une banque, aucune pitié. Tu entres avec{' '}
            <span className="t-brass num">{formatMoney(bank)}</span>.
          </p>
        </div>
      </section>

      <section className="floor" aria-label="Choisir une table">
        {MODES.map((mode, index) => (
          <button
            key={mode.id}
            type="button"
            className={`door door--${mode.id}`}
            style={{ '--i': index } as CSSProperties}
            aria-label={`${mode.title} ${mode.kicker} : ${mode.tagline}`}
            onClick={() => {
              sfxButton();
              onPlay(mode.id);
            }}
          >
            <span className="door__scene" aria-hidden="true">
              <Scene id={mode.id} />
            </span>
            <span className="door__plaque">
              <span className="door__kicker">{mode.kicker}</span>
              <span className="door__title">{mode.title}</span>
              <span className="door__desc">{mode.tagline}</span>
              <span className="door__foot">
                <span className="door__facts">
                  {mode.facts.map((fact) => (
                    <span key={fact} className="door__fact">
                      {fact}
                    </span>
                  ))}
                </span>
                <span className="door__cta">S&apos;asseoir</span>
              </span>
            </span>
          </button>
        ))}
      </section>

      <section className="ledger" aria-labelledby="ledger-title">
        <div className="ledger__head">
          <h2 id="ledger-title" className="engraved grow">
            Carnet de bord
          </h2>
          <div className="row">
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                sfxButton();
                onOpenShop();
              }}
            >
              Magasin d&apos;avantages
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                sfxButton();
                onOpenRules();
              }}
            >
              Casino Guide and Rules
            </button>
          </div>
        </div>
        <dl className="ledger__stats">
          <Stat label="Manches gagnées" value={stats.manchesGagnees.toLocaleString('fr-FR')} />
          <Stat label="Plus gros gain" value={formatMoney(stats.plusGrosGain)} accent />
          <Stat label="Meilleure série x2" value={String(stats.meilleureSerieDouble)} />
          <Stat label="Meilleur ante" value={String(stats.meilleurAntePoker)} />
          <Stat label="Tours de roulette" value={stats.toursDeRoulette.toLocaleString('fr-FR')} />
          <Stat label="Trophées" value={`${unlocked} / ${TROPHIES.length}`} />
        </dl>
      </section>
    </div>
  );
}

/** Guirlande d'ampoules en chenillard autour de l'enseigne. */
function Bulbs() {
  const edge = (count: number, side: string) =>
    Array.from({ length: count }, (_, i) => (
      <span key={`${side}-${i}`} className="bulb" style={{ '--b': i } as CSSProperties} />
    ));
  return (
    <span className="marquee__bulbs" aria-hidden="true">
      <span className="bulbs bulbs--top">{edge(BULBS_X, 't')}</span>
      <span className="bulbs bulbs--right">{edge(BULBS_Y, 'r')}</span>
      <span className="bulbs bulbs--bottom">{edge(BULBS_X, 'b')}</span>
      <span className="bulbs bulbs--left">{edge(BULBS_Y, 'l')}</span>
    </span>
  );
}

function Scene({ id }: { id: GameScreen }) {
  if (id === 'poker') {
    return (
      <span className="scene scene--fan">
        {ROYAL.map((card, i) => (
          <span key={card.id} className="scene__fan-card" style={{ '--k': i - 2 } as CSSProperties}>
            <PlayingCard card={card} size="sm" tilt={0} />
          </span>
        ))}
      </span>
    );
  }

  if (id === 'blackjack') {
    return (
      <span className="scene scene--bj">
        <span className="scene__bj-cards">
          {BLACKJACK.map((card, i) => (
            <PlayingCard key={card.id} card={card} size="sm" tilt={i === 0 ? -8 : 6} />
          ))}
        </span>
        <span className="scene__bj-stack">
          <ChipStack amount={760} size="sm" />
        </span>
        <span className="scene__bj-print">Le blackjack paye 3 pour 2</span>
      </span>
    );
  }

  return (
    <span className="scene scene--wheel">
      <MiniWheel />
    </span>
  );
}

/** Roue decorative : seize cases, elle tourne doucement au survol de la table. */
function MiniWheel() {
  const pockets = 16;
  const step = 360 / pockets;
  return (
    <svg className="mini-wheel" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="49" fill="#2a1c12" />
      <circle cx="50" cy="50" r="46" fill="#140e0a" />
      <g className="mini-wheel__disc">
        {Array.from({ length: pockets }, (_, i) => {
          const a1 = ((i * step - 90) * Math.PI) / 180;
          const a2 = (((i + 1) * step - 90) * Math.PI) / 180;
          const r = 43;
          const fill = i === 0 ? '#1f8a5a' : i % 2 ? '#d22a46' : '#1b1815';
          return (
            <path
              key={i}
              d={`M50,50 L${50 + r * Math.cos(a1)},${50 + r * Math.sin(a1)} A${r},${r} 0 0 1 ${
                50 + r * Math.cos(a2)
              },${50 + r * Math.sin(a2)} Z`}
              fill={fill}
              stroke="#0b0806"
              strokeWidth="0.8"
            />
          );
        })}
        <circle cx="50" cy="50" r="24" fill="#3b2d22" stroke="#0b0806" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="17" fill="#54402f" />
        <path d="M50,30 L52,48 L70,50 L52,52 L50,70 L48,52 L30,50 L48,48 Z" fill="#f4b53b" />
        <circle cx="50" cy="50" r="4" fill="#ffe08a" />
      </g>
      <circle cx="50" cy="12" r="3.2" fill="#fffaf0" />
    </svg>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="ledger__stat">
      <dt className="t-label">{label}</dt>
      <dd className={`ledger__value num${accent ? ' t-brass' : ''}`}>{value}</dd>
    </div>
  );
}
