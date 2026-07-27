import { formatMoney } from '../engine/economy';
import { ITEM_ORDER, ITEMS, type ItemCategory } from '../engine/items';
import { useCasino } from '../store/useCasino';
import { Sprite } from '../components/Sprite';
import type { SpriteName } from '../assets/sprites';

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  blackjack: 'Blackjack',
  poker: 'Poker',
  roulette: 'Roulette',
};

const CATEGORY_SPRITE: Record<ItemCategory, SpriteName> = {
  blackjack: 'cards',
  poker: 'spade',
  roulette: 'wheel',
};

/**
 * Magasin d'avantages.
 *
 * Les bonus s'achetent avec l'argent de la banque, avant ou pendant la partie :
 * c'est ce qui évite de pouvoir tricher gratuitement et rend chaque jeton
 * special un vrai arbitrage economique.
 */
export function Shop() {
  const bank = useCasino((s) => s.bank);
  const inventory = useCasino((s) => s.inventory);
  const buyItem = useCasino((s) => s.buyItem);

  return (
    <div className="col" style={{ gap: 'var(--u5)' }}>
      <div className="row row--between">
        <p className="t-body t-muted">
          Les jetons se consomment à l&apos;usage. Le stock est partagé entre toutes les tables.
        </p>
        <span className="led" style={{ fontSize: 22 }}>
          {formatMoney(bank)}
        </span>
      </div>

      {(['blackjack', 'poker', 'roulette'] as ItemCategory[]).map((category) => (
        <section key={category} className="col" style={{ gap: 'var(--u3)' }}>
          <h3 className="t-label row">
            <Sprite
              name={CATEGORY_SPRITE[category]}
              size={18}
              palette={{ a: 'var(--brass-500)' }}
            />
            {CATEGORY_LABEL[category]}
          </h3>
          <div className="tile-grid">
            {ITEM_ORDER.filter((id) => ITEMS[id].category === category).map((id) => {
              const item = ITEMS[id];
              const owned = inventory[id];
              const full = owned >= item.maxStack;
              return (
                <article key={id} className="tile">
                  <div className="tile__head">
                    <Sprite name="chip" size={20} />
                    <span className="tile__name">{item.name}</span>
                    {owned > 0 ? <span className="badge badge--green">x{owned}</span> : null}
                  </div>
                  <p className="tile__desc">{item.short}</p>
                  <div className="tile__foot">
                    <span className="led" style={{ fontSize: 18 }}>
                      {formatMoney(item.price)}
                    </span>
                    <button
                      type="button"
                      className="btn btn--sm"
                      disabled={bank < item.price || full}
                      onClick={() => buyItem(id)}
                    >
                      {full ? 'Stock plein' : 'Acheter'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
