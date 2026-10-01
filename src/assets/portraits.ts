/**
 * Portraits des figures, en 18 pixels de large.
 *
 * Plus fins que les pictos 16x16 : ce sont eux qu'on regarde le plus souvent
 * sur la table. Meme convention de palette que `sprites.ts`, avec deux cles en
 * plus :
 *   y = laiton (couronnes, galons)    d = ombre de peau
 * La cle `a` prend la couleur de l'enseigne de la carte (rouge ou noir).
 */

import type { Sprite } from './sprites';

function portrait(rows: readonly string[]): Sprite {
  return { rows, width: rows[0].length, height: rows.length };
}

/** Le roi tient un sceptre, barbe et col d'hermine. */
export const PORTRAIT_KING = portrait([
  '................yy',
  '...y....yy....y.yy',
  '..oyo..oyyo..oyo.y',
  '..oyyoyyyyyyoyyo.y',
  '..oyyyyyaayyyyyo.y',
  '..oooooooooooooo.y',
  '..ohssssssssssho.y',
  '..ohsswossowssho.y',
  '..ohssssddssssho.y',
  '..ohdssssssssdho.y',
  '..ohhhhhoohhhhho.y',
  '...ohhhhhhhhhho..y',
  '....ohhhhhhhho...y',
  '..oyyoohhhhooyyo.y',
  '.oaayyoohhooyyaaoy',
  '.oaaaayywwyyaaaaoy',
  '.oaaaaaywwyaaaaaoy',
  '.oaaaaaayyaaaaaaoy',
  '.oaaaaaayyaaaaaaoy',
  '.oaaaaaayyaaaaaaoy',
  '.oooooooooooooooo.',
]);

/** La dame porte un diademe et une rose, cheveux longs. */
export const PORTRAIT_QUEEN = portrait([
  '..................',
  '......y.yy.y......',
  '.....oyoyyoyo.....',
  '....ohyyyyyyho....',
  '..ohhoooooooohho..',
  '..ohssssssssssho..',
  '..ohsswossowssho..',
  '..ohssssddssssho..',
  '..ohssssaassssho..',
  '..ohhossssssohho..',
  'aaohhhoooooohhho..',
  'a.ohhhowwwwohhho..',
  'gohhaaowwwwoaahho.',
  'gohaaaaowwoaaaaho.',
  '.oaaaaayyyyaaaaao.',
  '.oaaaaayaayaaaaao.',
  '.oaaaaaayyaaaaaao.',
  '.oaaaaayaayaaaaao.',
  '.oaaaaaayyaaaaaao.',
  '.oooooooooooooooo.',
]);

/** Le valet, toque a plume et epee courte. */
export const PORTRAIT_JACK = portrait([
  '..................',
  '............yy....',
  '...........yyo....',
  '....oooooooyo....m',
  '...oaaaaaaaao....m',
  '..oaaaaaaaaaaoo..m',
  '..oyyyyyyyyyyyyo.m',
  '..ohssssssssssho.m',
  '..ohsswossowssho.m',
  '..ohssssddssssho.m',
  '..ohsssoooosssho.m',
  '...ohssssssssho..m',
  '....oooowwoooo...m',
  '...oaaaowwoaaaoyyy',
  '..oaaaaawwaaaaao.k',
  '.oaayaaaaaaaayaaok',
  '.oaayaaaaaaaayaaok',
  '.oaayaaayyaaayaao.',
  '.oaayaaaaaaaayaao.',
  '.oooooooooooooooo.',
]);

export const PORTRAITS = {
  jack: PORTRAIT_JACK,
  queen: PORTRAIT_QUEEN,
  king: PORTRAIT_KING,
} as const;

export type PortraitName = keyof typeof PORTRAITS;
