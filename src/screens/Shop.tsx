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
    <div className="counter-shop">
      <p className="t-body t-muted">
        Les jetons se consomment à l&apos;usage. Le stock est partagé entre toutes les tables.
      </p>

      {(['blackjack', 'poker', 'roulette'] as ItemCategory[]).map((category) => (
        <section key={category} className="counter-shop__section">
          <h3 className="engraved">
            <Sprite
              name={CATEGORY_SPRITE[category]}
              size={20}
              palette={{ a: 'var(--brass-400)' }}
            />
            {CATEGORY_LABEL[category]}
          </h3>
          <div className="tile-grid">
            {ITEM_ORDER.filter((id) => ITEMS[id].category === category).map((id) => {
              const item = ITEMS[id];
              const owned = inventory[id];
              const full = owned >= item.maxStack;
              const affordable = bank >= item.price;
              return (
                <article key={id} className="tile item-tile">
                  <div className="tile__head">
                    <span className="item-tile__coin" aria-hidden="true">
                      <Sprite name="chip" size={24} />
                    </span>
                    <span className="tile__name">{item.name}</span>
                  </div>
                  <p className="tile__desc">{item.short}</p>
                  <div className="tile__foot">
                    <span className="item-tile__price">
                      <span className={`price${affordable ? '' : ' price--short'}`}>
                        {formatMoney(item.price)}
                      </span>
                      <span className={`item-tile__stock${owned > 0 ? ' is-stocked' : ''}`}>
                        En stock {owned} / {item.maxStack}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn btn--sm"
                      disabled={!affordable || full}
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
