export type ItemId = 'peek' | 'burn' | 'shield' | 'jokerCard' | 'extraDiscard' | 'safetyNet';

export type ItemCategory = 'blackjack' | 'poker' | 'roulette';

export interface ItemDefinition {
  id: ItemId;
  name: string;
  category: ItemCategory;
  price: number;
  /** Une ligne pour la boutique. */
  short: string;
  /** Texte complet du carnet de règles. */
  long: string;
  /** Plafond de stock, pour éviter d'acheter 200 jetons Peek. */
  maxStack: number;
}

export const ITEMS: Record<ItemId, ItemDefinition> = {
  peek: {
    id: 'peek',
    name: 'Jeton Peek',
    category: 'blackjack',
    price: 150,
    short: 'Révèle la carte cachée du croupier.',
    long: "Consomme un jeton pour retourner la carte face cachée du croupier avant de décider. L'information reste affichée jusqu'à la fin de la main.",
    maxStack: 9,
  },
  burn: {
    id: 'burn',
    name: 'Jeton Burn',
    category: 'blackjack',
    price: 200,
    short: 'Annule la dernière carte tirée si tu sautes.',
    long: 'Utilisable uniquement quand ton total dépasse 21. La dernière carte tirée part à la poubelle et ton total revient à sa valeur précédente. Débloque le trophée Nettoyage de Printemps.',
    maxStack: 9,
  },
  shield: {
    id: 'shield',
    name: 'Insurance Shield',
    category: 'blackjack',
    price: 100,
    short: 'Rembourse 50 % de ta mise si le croupier fait Blackjack.',
    long: "Assurance automatique. Si le croupier retourne un Blackjack naturel, la moitié de ta mise principale te revient. Le jeton n'est consomme que s'il se déclenche.",
    maxStack: 9,
  },
  jokerCard: {
    id: 'jokerCard',
    name: 'Carte Joker',
    category: 'poker',
    price: 300,
    short: 'x1.5 sur le score de la prochaine main jouee.',
    long: 'Consommable de manche. Active la Carte Joker avant de poser tes cartes : le score final de cette main est multiplie par 1.5, jokers compris.',
    maxStack: 9,
  },
  extraDiscard: {
    id: 'extraDiscard',
    name: 'Défausse Extra',
    category: 'poker',
    price: 100,
    short: 'Ajoute une défausse à la manche en cours.',
    long: 'Rend une défausse supplementaire immédiatement. Cumulable, mais attention : le joker Compteur de Cartes gagne en valeur si tu gardes tes défausses.',
    maxStack: 9,
  },
  safetyNet: {
    id: 'safetyNet',
    name: 'Safety Net',
    category: 'roulette',
    price: 250,
    short: 'Sur un zéro, tu ne perds que 50 % de tes mises.',
    long: "Filet de sécurité pose sur la table avant le lancer. Si la bille tombe dans la case verte et qu'aucune de tes mises ne passe, la moitié du tapis t'est rendue.",
    maxStack: 9,
  },
};

export const ITEM_ORDER: readonly ItemId[] = [
  'peek',
  'burn',
  'shield',
  'jokerCard',
  'extraDiscard',
  'safetyNet',
];

export type Inventory = Record<ItemId, number>;

export function emptyInventory(): Inventory {
  return { peek: 0, burn: 0, shield: 0, jokerCard: 0, extraDiscard: 0, safetyNet: 0 };
}
