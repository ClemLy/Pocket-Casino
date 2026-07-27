import { useMemo, useState } from 'react';
import { basicStrategy, type BasicAction } from '../engine/blackjack';
import { type Card, type Rank, type Suit } from '../engine/cards';
import { formatMoney, MAFIA_DEBT, MAFIA_LOAN, MAFIA_TAX_RATE } from '../engine/economy';
import { ITEM_ORDER, ITEMS } from '../engine/items';
import { JOKERS, RARITY_LABEL } from '../engine/jokers';
import { HAND_ORDER, HAND_TABLE, handAtLevel } from '../engine/poker';
import { betDefinitions, WHEELS } from '../engine/roulette';
import { PlayingCard } from '../components/PlayingCard';
import { Sprite } from '../components/Sprite';

export type RuleTab = 'poker' | 'blackjack' | 'roulette' | 'avantages';

const TABS: ReadonlyArray<{ id: RuleTab; label: string }> = [
  { id: 'poker', label: 'POKER' },
  { id: 'blackjack', label: 'BLACKJACK' },
  { id: 'roulette', label: 'ROULETTE' },
  { id: 'avantages', label: 'TRICHE ET AVANTAGES' },
];

function card(rank: Rank, suit: Suit, tag = 'rb'): Card {
  return { id: `${tag}-${rank}${suit}`, rank, suit };
}

/** Un exemple concret par type de main, monte avec de vraies cartes. */
const HAND_EXAMPLES: Record<string, Card[]> = {
  ROYAL_FLUSH: [
    card('10', 'H', 'rf'),
    card('J', 'H', 'rf'),
    card('Q', 'H', 'rf'),
    card('K', 'H', 'rf'),
    card('A', 'H', 'rf'),
  ],
  STRAIGHT_FLUSH: [
    card('5', 'S', 'sf'),
    card('6', 'S', 'sf'),
    card('7', 'S', 'sf'),
    card('8', 'S', 'sf'),
    card('9', 'S', 'sf'),
  ],
  FOUR_KIND: [
    card('Q', 'S', 'fk'),
    card('Q', 'H', 'fk'),
    card('Q', 'D', 'fk'),
    card('Q', 'C', 'fk'),
    card('3', 'S', 'fk'),
  ],
  FULL_HOUSE: [
    card('8', 'S', 'fh'),
    card('8', 'H', 'fh'),
    card('8', 'D', 'fh'),
    card('K', 'C', 'fh'),
    card('K', 'S', 'fh'),
  ],
  FLUSH: [
    card('2', 'D', 'fl'),
    card('6', 'D', 'fl'),
    card('9', 'D', 'fl'),
    card('J', 'D', 'fl'),
    card('K', 'D', 'fl'),
  ],
  STRAIGHT: [
    card('4', 'C', 'st'),
    card('5', 'H', 'st'),
    card('6', 'S', 'st'),
    card('7', 'D', 'st'),
    card('8', 'C', 'st'),
  ],
  THREE_KIND: [
    card('7', 'S', 'tk'),
    card('7', 'H', 'tk'),
    card('7', 'C', 'tk'),
    card('2', 'D', 'tk'),
    card('9', 'S', 'tk'),
  ],
  TWO_PAIR: [
    card('J', 'S', 'tp'),
    card('J', 'D', 'tp'),
    card('4', 'C', 'tp'),
    card('4', 'H', 'tp'),
    card('A', 'S', 'tp'),
  ],
  PAIR: [
    card('A', 'S', 'pa'),
    card('A', 'C', 'pa'),
    card('5', 'H', 'pa'),
    card('9', 'D', 'pa'),
    card('K', 'S', 'pa'),
  ],
  HIGH_CARD: [
    card('K', 'S', 'hc'),
    card('9', 'H', 'hc'),
    card('7', 'D', 'hc'),
    card('4', 'C', 'hc'),
    card('2', 'S', 'hc'),
  ],
};

export function RuleBookTabs({
  tab,
  onChange,
}: {
  tab: RuleTab;
  onChange: (tab: RuleTab) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          className={`tab${tab === t.id ? ' tab--active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function RuleBook({ tab }: { tab: RuleTab }) {
  if (tab === 'poker') return <PokerRules />;
  if (tab === 'blackjack') return <BlackjackRules />;
  if (tab === 'roulette') return <RouletteRules />;
  return <PerksRules />;
}

/* ------------------------------------------------------------------ poker */

function PokerRules() {
  const [open, setOpen] = useState<string | null>('ROYAL_FLUSH');

  return (
    <div className="col" style={{ gap: 'var(--u4)' }}>
      <p className="t-body">
        Le score d&apos;une main vaut <span className="score-line__chips">jetons</span>{' '}
        <span className="score-line__x">x</span>{' '}
        <span className="score-line__mult">multiplicateur</span>. Les jetons viennent de la
        combinaison plus la valeur de chaque carte qui marque (l&apos;As vaut 11, les figures 10).
        Seules les cartes de la combinaison rapportent : dans une paire, les trois autres cartes ne
        comptent pas.
      </p>

      <ul className="col" style={{ gap: 'var(--u2)' }}>
        {HAND_ORDER.map((type) => {
          const def = HAND_TABLE[type];
          const base = handAtLevel(type, 1);
          const isOpen = open === type;
          return (
            <li key={type} className="rule-row">
              <button
                type="button"
                className="rule-row__head"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : type)}
              >
                <Sprite name="spade" size={16} palette={{ a: 'var(--brass-500)' }} />
                <span className="tile__name grow">{def.label}</span>
                <span className="score-line">
                  <span className="score-line__chips">{base.chips}</span>
                  <span className="score-line__x">x</span>
                  <span className="score-line__mult">{base.mult}</span>
                </span>
              </button>
              {isOpen ? (
                <div className="rule-row__body">
                  <div className="hand hand--tight" style={{ paddingTop: 0 }}>
                    {HAND_EXAMPLES[type].map((c) => (
                      <PlayingCard key={c.id} card={c} size="sm" />
                    ))}
                  </div>
                  <p className="t-body t-muted">
                    Amélioration en boutique : {formatMoney(def.upgradeCost)} au niveau 1, puis +
                    {def.chipsPerLevel} jetons et +{def.multPerLevel} de multiplicateur par niveau.
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- blackjack */

const DEALER_UPS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

const ACTION_CLASS: Record<BasicAction, string> = {
  Tirer: 'strat--hit',
  Rester: 'strat--stand',
  Doubler: 'strat--double',
  Splitter: 'strat--split',
};

const ACTION_SHORT: Record<BasicAction, string> = {
  Tirer: 'T',
  Rester: 'R',
  Doubler: 'D',
  Splitter: 'S',
};

interface StrategyRow {
  label: string;
  hand: Card[];
}

function buildRows(): StrategyRow[] {
  const rows: StrategyRow[] = [];

  // Mains dures : on force un 10 plus le complément pour éviter tout As.
  // Le second membre est toujours un 2 sous 12 et un 10 au-dela : jamais deux
  // cartes identiques, sinon la ligne basculerait a tort sur un conseil de split.
  for (let total = 17; total >= 8; total--) {
    const hand =
      total >= 12
        ? [card('10', 'S', 'h'), card(String(total - 10) as Rank, 'H', 'h')]
        : [card(String(total - 2) as Rank, 'S', 'h'), card('2', 'H', 'h')];
    rows.push({ label: `Dur ${total}`, hand });
  }

  // Mains souples : As plus une carte.
  for (let kicker = 9; kicker >= 2; kicker--) {
    rows.push({
      label: `A + ${kicker}`,
      hand: [card('A', 'S', 's'), card(String(kicker) as Rank, 'H', 's')],
    });
  }

  // Paires.
  for (const rank of ['A', '10', '9', '8', '7', '6', '5', '4', '3', '2'] as Rank[]) {
    rows.push({ label: `${rank} ${rank}`, hand: [card(rank, 'S', 'p'), card(rank, 'H', 'p')] });
  }

  return rows;
}

function BlackjackRules() {
  // La table est calculee par la même fonction que celle documentee : elle ne
  // peut pas mentir sur ce que le moteur conseille.
  const rows = useMemo(buildRows, []);

  return (
    <div className="col" style={{ gap: 'var(--u4)' }}>
      <p className="t-body">
        Le croupier tire jusqu&apos;à 16 et reste dès 17, y compris sur un 17 souple. Un blackjack
        naturel paye 3 pour 2, une victoire simple paye 1 pour 1, l&apos;égalité rembourse la mise.
      </p>

      <div className="col" style={{ gap: 'var(--u2)' }}>
        <h3 className="t-label">Les coups spéciaux</h3>
        <p className="t-body t-muted">
          <span className="t-brass">Doubler</span> : uniquement sur tes deux premières cartes. Tu
          doubles la mise et tu recois exactement une carte.
        </p>
        <p className="t-body t-muted">
          <span className="t-brass">Splitter</span> : deux cartes de même valeur se separent en deux
          mains, chacune avec sa propre mise. Jusqu&apos;à quatre mains.
        </p>
        <p className="t-body t-muted">
          <span className="t-brass">Assurance</span> : ici elle passe par le jeton Insurance Shield.
          Si le croupier retourne un blackjack, il rembourse la moitié de ta mise principale et ne
          se consomme que dans ce cas.
        </p>
        <p className="t-body t-muted">
          <span className="t-brass">Perfect Pairs</span> : pari secondaire à 10 $. Paire mixte x6,
          paire de même couleur x12, paire parfaite x25.
        </p>
      </div>

      <h3 className="t-label">Table de stratégie de base</h3>
      <div className="strat-scroll">
        <table className="strat">
          <thead>
            <tr>
              <th scope="col">Ta main</th>
              {DEALER_UPS.map((up) => (
                <th key={up} scope="col">
                  {up}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {DEALER_UPS.map((up) => {
                  const action = basicStrategy(row.hand, card(up, 'C', 'up'));
                  return (
                    <td key={up} className={ACTION_CLASS[action]} title={action}>
                      {ACTION_SHORT[action]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row row--wrap">
        <span className="badge strat--hit">T Tirer</span>
        <span className="badge strat--stand">R Rester</span>
        <span className="badge strat--double">D Doubler</span>
        <span className="badge strat--split">S Splitter</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- roulette */

function RouletteRules() {
  return (
    <div className="col" style={{ gap: 'var(--u5)' }}>
      {(['europeenne', 'turbo'] as const).map((key) => {
        const wheel = WHEELS[key];
        return (
          <section key={key} className="col" style={{ gap: 'var(--u2)' }}>
            <h3 className="t-label row">
              <Sprite name="wheel" size={18} />
              Roulette {wheel.label} : {wheel.order.length} cases
            </h3>
            <table className="strat strat--odds">
              <thead>
                <tr>
                  <th scope="col">Mise</th>
                  <th scope="col">Cote</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {betDefinitions(wheel).map((def) => (
                  <tr key={def.kind}>
                    <th scope="row">{def.label}</th>
                    <td className="t-brass">{def.payout}:1</td>
                    <td>{def.hint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
      <p className="t-body t-muted">
        La case verte 0 n&apos;est ni rouge ni noire, ni paire ni impaire : elle fait tomber toutes
        les chances simples. C&apos;est la que le jeton Safety Net devient intéressant.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- avantages */

function PerksRules() {
  return (
    <div className="col" style={{ gap: 'var(--u5)' }}>
      <section className="col" style={{ gap: 'var(--u3)' }}>
        <h3 className="t-label">Jetons spéciaux</h3>
        {ITEM_ORDER.map((id) => {
          const item = ITEMS[id];
          return (
            <div key={id} className="rule-row__body">
              <div className="row row--between">
                <span className="tile__name">{item.name}</span>
                <span className="badge badge--gold">{formatMoney(item.price)}</span>
              </div>
              <p className="t-body t-muted">{item.long}</p>
            </div>
          );
        })}
      </section>

      <section className="col" style={{ gap: 'var(--u3)' }}>
        <h3 className="t-label">Jokers du mode poker</h3>
        <div className="tile-grid">
          {JOKERS.map((joker) => (
            <div key={joker.id} className="tile">
              <div className="tile__head">
                <span className="tile__name grow">{joker.name}</span>
                <span className={`badge${joker.rarity === 'legendaire' ? ' badge--gold' : ''}`}>
                  {RARITY_LABEL[joker.rarity]}
                </span>
              </div>
              <p className="tile__desc">{joker.description}</p>
              <span className="led" style={{ fontSize: 17 }}>
                {formatMoney(joker.price)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="col" style={{ gap: 'var(--u2)' }}>
        <h3 className="t-label">Quitte ou Double</h3>
        <p className="t-body t-muted">
          Après chaque manche gagnée, la totalité du retour de la manche peut être remise en jeu :
          une carte face cachée, rouge ou noir. Bonne réponse, le montant double. Mauvaise réponse,
          tout part. Trois tentatives d&apos;affilée au maximum, soit x2, x4 puis x8.
        </p>
      </section>

      <section className="col" style={{ gap: 'var(--u2)' }}>
        <h3 className="t-label">Quand la banque tombe à zéro</h3>
        <p className="t-body t-muted">
          La Roue de la Dernière Chance rend de 100 $ à 500 $, une fois toutes les 20 heures. La
          Mafia du Casino avance {formatMoney(MAFIA_LOAN)} contre {formatMoney(MAFIA_DEBT)} a rendre
          via une taxe de {Math.round(MAFIA_TAX_RATE * 100)} % sur chaque gain. Le job
          d&apos;appoint rapporte 5 $ par piece ramassee en dix secondes.
        </p>
      </section>
    </div>
  );
}
