export type TrophyId =
  | 'roi-du-bluff'
  | 'poissard-legendaire'
  | 'acrobate-du-risk'
  | 'nettoyage-de-printemps'
  | 'du-striker-au-clochard'
  | 'premier-jeton'
  | 'zero-absolu'
  | 'casse-la-banque'
  | 'dette-payee'
  | 'main-de-fer';

/** Nom du picto pixel art associe, voir components/PixelIcon.tsx. */
export type TrophyIcon =
  'crown' | 'skull' | 'bolt' | 'broom' | 'coin' | 'chip' | 'zero' | 'vault' | 'bill' | 'fist';

export interface Trophy {
  id: TrophyId;
  name: string;
  icon: TrophyIcon;
  condition: string;
  reward: number;
}

export const TROPHIES: readonly Trophy[] = [
  {
    id: 'roi-du-bluff',
    name: 'Roi du Bluff',
    icon: 'crown',
    condition: 'Obtenir une Quinte Flush au poker.',
    reward: 1000,
  },
  {
    id: 'poissard-legendaire',
    name: 'Poissard Légendaire',
    icon: 'skull',
    condition: 'Perdre un blackjack avec 20 face à un 21 du croupier.',
    reward: 200,
  },
  {
    id: 'acrobate-du-risk',
    name: 'Acrobate du Risk',
    icon: 'bolt',
    condition: "Réussir 3 Quitte ou Double d'affilée.",
    reward: 500,
  },
  {
    id: 'nettoyage-de-printemps',
    name: 'Nettoyage de Printemps',
    icon: 'broom',
    condition: 'Utiliser le jeton Burn pour éviter de sauter au blackjack.',
    reward: 100,
  },
  {
    id: 'du-striker-au-clochard',
    name: 'Du Striker au Clochard',
    icon: 'skull',
    condition: 'Passer de 5 000 $ à 0 $ dans une seule session.',
    reward: 300,
  },
  {
    id: 'premier-jeton',
    name: 'Premier Jeton',
    icon: 'chip',
    condition: 'Remporter ta toute première manche.',
    reward: 50,
  },
  {
    id: 'zero-absolu',
    name: 'Le Zéro Absolu',
    icon: 'zero',
    condition: 'Voir la bille tomber sur le zero avec un Safety Net pose.',
    reward: 250,
  },
  {
    id: 'casse-la-banque',
    name: 'Casse la Banque',
    icon: 'vault',
    condition: 'Faire monter la banque à 10 000 $.',
    reward: 2000,
  },
  {
    id: 'dette-payee',
    name: 'Dette Payée',
    icon: 'bill',
    condition: 'Rembourser intégralement la Mafia du Casino.',
    reward: 400,
  },
  {
    id: 'main-de-fer',
    name: 'Main de Fer',
    icon: 'fist',
    condition: 'Valider une manche de poker sans utiliser une seule défausse.',
    reward: 300,
  },
];

export function trophyById(id: TrophyId): Trophy {
  const found = TROPHIES.find((t) => t.id === id);
  if (!found) throw new Error(`Trophée inconnu : ${id}`);
  return found;
}
