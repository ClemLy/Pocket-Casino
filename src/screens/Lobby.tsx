import { formatMoney } from '../engine/economy';
import { TROPHIES } from '../engine/trophies';
import { useCasino } from '../store/useCasino';
import { sfxButton } from '../audio/sfx';
import { Sprite } from '../components/Sprite';
import type { SpriteName } from '../assets/sprites';

export type GameScreen = 'poker' | 'blackjack' | 'roulette';

interface ModeInfo {
  id: GameScreen;
  title: string;
  sprite: SpriteName;
  tagline: string;
  bullets: string[];
}

const MODES: readonly ModeInfo[] = [
  {
    id: 'poker',
    title: 'POKER ROGUELIKE',
    sprite: 'spade',
    tagline: 'Atteins le score cible en 4 mains. Achète des jokers. Recommence plus fort.',
    bullets: ['8 cartes en main', '3 défausses', 'Boutique entre les manches'],
  },
  {
    id: 'blackjack',
    title: 'BLACKJACK ARCADE',
    sprite: 'cards',
    tagline: "Le 21 classique, plus trois jetons d'avantage à équiper avant de jouer.",
    bullets: ['Split, Double, Assurance', 'Side bet Perfect Pairs', 'Jetons Peek, Burn, Shield'],
  },
  {
    id: 'roulette',
    title: 'TURBO ROULETTE',
    sprite: 'wheel',
    tagline: 'Européenne à 37 cases ou Turbo à 13 cases pour enchaîner les tours.',
    bullets: ['Presets de mise', 'Jeton Safety Net', 'Cotes affichées en direct'],
  },
];

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
    <div className="shell col" style={{ gap: 'var(--u6)' }}>
      <section className="marquee">
        <div className="bulbs" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="bulb" />
          ))}
        </div>
        <h1 className="marquee__title">POCKET CASINO</h1>
        <p className="marquee__sub">
          Trois tables, une banque, aucune pitié. Tu entres avec {formatMoney(bank)}.
        </p>
      </section>

      <section className="mode-grid">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className="mode-card"
            onClick={() => {
              sfxButton();
              onPlay(mode.id);
            }}
          >
            <div className="row">
              <Sprite name={mode.sprite} size={40} palette={{ a: 'var(--brass-500)' }} />
              <h2 className="mode-card__title">{mode.title}</h2>
            </div>
            <p className="mode-card__desc">{mode.tagline}</p>
            <ul className="stack-sm">
              {mode.bullets.map((line) => (
                <li key={line} className="t-body t-muted">
                  <span className="t-brass">+</span> {line}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </section>

      <section className="panel">
        <h2 className="panel__title">CARNET DE BORD</h2>
        <div className="tile-grid">
          <Stat label="Manches gagnées" value={String(stats.manchesGagnees)} />
          <Stat label="Plus gros gain" value={formatMoney(stats.plusGrosGain)} />
          <Stat label="Meilleure série x2" value={String(stats.meilleureSerieDouble)} />
          <Stat label="Meilleur ante poker" value={String(stats.meilleurAntePoker)} />
          <Stat label="Tours de roulette" value={String(stats.toursDeRoulette)} />
          <Stat label="Trophées" value={`${unlocked} / ${TROPHIES.length}`} />
        </div>
        <div className="row row--wrap" style={{ marginTop: 'var(--u4)' }}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              sfxButton();
              onOpenShop();
            }}
          >
            Magasin d'avantages
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              sfxButton();
              onOpenRules();
            }}
          >
            Casino Guide and Rules
          </button>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="tile">
      <span className="t-label">{label}</span>
      <span className="led" style={{ fontSize: 22 }}>
        {value}
      </span>
    </div>
  );
}
