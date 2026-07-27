/**
 * Sprites pixel art dessines a la main.
 *
 * Chaque sprite est une grille de caracteres. Un caractere = un pixel, `.` est
 * transparent. Les couleurs sont resolues au rendu via une palette, ce qui
 * permet de reutiliser le même dessin en rouge ou en noir (les enseignes de
 * cartes, par exemple).
 *
 * Cle de palette par defaut :
 *   o = contour       w = blanc / os      a = accent (or ou couleur d'enseigne)
 *   s = peau          h = cheveux         c = rouge tapis
 *   k = noir profond  g = vert feutrine   m = metal
 */

export type SpriteRows = readonly string[];

export interface Sprite {
  rows: SpriteRows;
  width: number;
  height: number;
}

function sprite(rows: SpriteRows): Sprite {
  return { rows, width: rows[0].length, height: rows.length };
}

/* -------------------------------------------------------------------------
   Enseignes
   ------------------------------------------------------------------------- */

export const SPRITE_SPADE = sprite([
  '................',
  '.......aa.......',
  '......aaaa......',
  '.....aaaaaa.....',
  '....aaaaaaaa....',
  '...aaaaaaaaaa...',
  '..aaaaaaaaaaaa..',
  '.aaaaaaaaaaaaaa.',
  '.aaaaaaaaaaaaaa.',
  '.aaaaaaaaaaaaaa.',
  '..aaaaa..aaaaa..',
  '......aaaa......',
  '.......aa.......',
  '......aaaa......',
  '.....aaaaaa.....',
  '................',
]);

export const SPRITE_HEART = sprite([
  '................',
  '..aaa.....aaa...',
  '.aaaaa...aaaaa..',
  'aaaaaaa.aaaaaaa.',
  'aaaaaaaaaaaaaaa.',
  'aaaaaaaaaaaaaaa.',
  'aaaaaaaaaaaaaaa.',
  '.aaaaaaaaaaaaa..',
  '..aaaaaaaaaaa...',
  '...aaaaaaaaa....',
  '....aaaaaaa.....',
  '.....aaaaa......',
  '......aaa.......',
  '.......a........',
  '................',
  '................',
]);

export const SPRITE_DIAMOND = sprite([
  '................',
  '.......aa.......',
  '......aaaa......',
  '.....aaaaaa.....',
  '....aaaaaaaa....',
  '...aaaaaaaaaa...',
  '..aaaaaaaaaaaa..',
  '.aaaaaaaaaaaaaa.',
  '.aaaaaaaaaaaaaa.',
  '..aaaaaaaaaaaa..',
  '...aaaaaaaaaa...',
  '....aaaaaaaa....',
  '.....aaaaaa.....',
  '......aaaa......',
  '.......aa.......',
  '................',
]);

export const SPRITE_CLUB = sprite([
  '................',
  '......aaaa......',
  '.....aaaaaa.....',
  '.....aaaaaa.....',
  '......aaaa......',
  '..aaa.aaaa.aaa..',
  '.aaaaaaaaaaaaaa.',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  '.aaaaaaaaaaaaaa.',
  '..aaaa.aa.aaaa..',
  '......aaaa......',
  '.......aa.......',
  '......aaaa......',
  '.....aaaaaa.....',
  '................',
]);

/* -------------------------------------------------------------------------
   Figures : valet, dame, roi
   ------------------------------------------------------------------------- */

export const SPRITE_JACK = sprite([
  '................',
  '........aaaa....',
  '...ooooooooa....',
  '..ohhhhhhhhho...',
  '..ooooooooooo...',
  '...ossssssso....',
  '...ososssoso....',
  '...ossssssso....',
  '...osswwwsso....',
  '...ossssssso....',
  '....ooooooo.....',
  '...aaaaaaaaa....',
  '..aaaaaaaaaaa...',
  '..aoooooooooa...',
  '..aoooooooooa...',
  '................',
]);

export const SPRITE_QUEEN = sprite([
  '................',
  '....a.a.a.a.....',
  '....aaaaaaa.....',
  '...ooooooooo....',
  '..ohsssssssho...',
  '..ohsosssosho...',
  '..ohsssssssho...',
  '..ohsswwwssho...',
  '..ohhsssssho....',
  '...ohhhhhhho....',
  '....ooooooo.....',
  '...aaaaaaaaa....',
  '..aaaaaaaaaaa...',
  '..aoooooooooa...',
  '..aoooooooooa...',
  '................',
]);

export const SPRITE_KING = sprite([
  '................',
  '...a.a.a.a.a....',
  '...aaaaaaaaa....',
  '...ooooooooo....',
  '...ossssssso....',
  '...ososssoso....',
  '...ossssssso....',
  '...oswwwwwso....',
  '...oswwwwwso....',
  '....owwwwwo.....',
  '.....owwwo......',
  '......ooo.......',
  '..aaaaaaaaaaa...',
  '..aoooooooooa...',
  '..aoooooooooa...',
  '................',
]);

/* -------------------------------------------------------------------------
   Pictos d'interface et de trophées
   ------------------------------------------------------------------------- */

export const SPRITE_CROWN = sprite([
  '................',
  '................',
  '..o....o....o...',
  '..oo..ooo..oo...',
  '..oaaaaaaaaao...',
  '..oaawaaawaao...',
  '..oaaaaaaaaao...',
  '..ooooooooooo...',
  '..oaaaaaaaaao...',
  '..ooooooooooo...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]);

export const SPRITE_SKULL = sprite([
  '................',
  '....oooooooo....',
  '...owwwwwwwwo...',
  '..owwwwwwwwwwo..',
  '..owwwwwwwwwwo..',
  '..owwoowwoowwo..',
  '..owwoowwoowwo..',
  '..owwwwwwwwwwo..',
  '..owwwwoowwwwo..',
  '...owwwwwwwwo...',
  '....owwwwwwo....',
  '....owowowowo...',
  '....oooooooo....',
  '................',
  '................',
  '................',
]);

export const SPRITE_BOLT = sprite([
  '................',
  '.........oo.....',
  '........oao.....',
  '.......oaao.....',
  '......oaaao.....',
  '.....oaaaooo....',
  '....oaaaaaao....',
  '....oaaaaaaao...',
  '....oooaaaoo....',
  '.......oaao.....',
  '......oaao......',
  '......oao.......',
  '.....oao........',
  '.....oo.........',
  '................',
  '................',
]);

export const SPRITE_BROOM = sprite([
  '................',
  '...........o....',
  '..........oho...',
  '.........oho....',
  '........oho.....',
  '.......oho......',
  '......oho.......',
  '.....oho........',
  '...ooooo........',
  '..oaaaaao.......',
  '..oaaaaaao......',
  '.oaaaaaaao......',
  '.oa.a.a.ao......',
  '.o.o.o.o.o......',
  '................',
  '................',
]);

export const SPRITE_COIN = sprite([
  '................',
  '................',
  '.....oooooo.....',
  '...oooaaaaooo...',
  '..ooaaaaaaaaoo..',
  '..oaaawaaaaaao..',
  '.oaaawwaaaaaaao.',
  '.oaaawaaaaaaaao.',
  '.oaaawaaaaaaaao.',
  '.oaaawwwaaaaaao.',
  '..oaaaaaaaaaao..',
  '..ooaaaaaaaaoo..',
  '...oooaaaaooo...',
  '.....oooooo.....',
  '................',
  '................',
]);

export const SPRITE_CHIP = sprite([
  '................',
  '................',
  '.....oooooo.....',
  '...ooccwwccoo...',
  '..occcwwwwccco..',
  '..owccccccccwo..',
  '.owwccccccccwwo.',
  '.owccccccccccwo.',
  '.owccccccccccwo.',
  '.owwccccccccwwo.',
  '..owccccccccwo..',
  '..occcwwwwccco..',
  '...ooccwwccoo...',
  '.....oooooo.....',
  '................',
  '................',
]);

export const SPRITE_ZERO = sprite([
  '................',
  '................',
  '.....oooooo.....',
  '...ooggggggoo...',
  '..oggggggggggo..',
  '..oggwwwwwwggo..',
  '.oggwwggggwwggo.',
  '.oggwwggggwwggo.',
  '.oggwwggggwwggo.',
  '.oggwwggggwwggo.',
  '..oggwwwwwwggo..',
  '..oggggggggggo..',
  '...ooggggggoo...',
  '.....oooooo.....',
  '................',
  '................',
]);

export const SPRITE_VAULT = sprite([
  '................',
  '................',
  '..oooooooooooo..',
  '..ommmmmmmmmmo..',
  '..ommooooommmo..',
  '..ommoaaaommmo..',
  '..ommoaoaommmo..',
  '..ommoaaaommmo..',
  '..ommooaoommmo..',
  '..ommmmammmmmo..',
  '..ommmmmmmmmmo..',
  '..oooooooooooo..',
  '...o........o...',
  '................',
  '................',
  '................',
]);

export const SPRITE_BILL = sprite([
  '................',
  '................',
  '................',
  '................',
  '..oooooooooooo..',
  '..oggggggggggo..',
  '..ogggoooogggo..',
  '..oggoaaaaoggo..',
  '..oggoaaaaoggo..',
  '..ogggoooogggo..',
  '..oggggggggggo..',
  '..oooooooooooo..',
  '................',
  '................',
  '................',
  '................',
]);

export const SPRITE_FIST = sprite([
  '................',
  '................',
  '................',
  '....oooooo......',
  '...osssssso.....',
  '..osssssssso....',
  '..ososososso....',
  '..osssssssso....',
  '..osssssssso....',
  '..osssssssso....',
  '...osssssso.....',
  '...oooooooo.....',
  '....oooooo......',
  '................',
  '................',
  '................',
]);

export const SPRITE_BOOK = sprite([
  '................',
  '................',
  '..oooooooooooo..',
  '..occccoocccco..',
  '..ocwwcoocwwco..',
  '..ocwwcoocwwco..',
  '..ocwwcoocwwco..',
  '..ocwwcoocwwco..',
  '..occccoocccco..',
  '..oooooooooooo..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]);

export const SPRITE_TROPHY = sprite([
  '................',
  '................',
  '...oooooooooo...',
  '..oaaaaaaaaaao..',
  '.ooaaaaaaaaaaoo.',
  '.o.oaaaaaaaao.o.',
  '.o.oaaaaaaaao.o.',
  '.oo.oaaaaaao.oo.',
  '....oaaaaaao....',
  '.....oaaaao.....',
  '......oaao......',
  '......oaao......',
  '....oooaaooo....',
  '...oaaaaaaaao...',
  '...oooooooooo...',
  '................',
]);

export const SPRITE_WHEEL = sprite([
  '................',
  '................',
  '.....oooooo.....',
  '...oocckkkcco...',
  '..occkkkccckko..',
  '..ockkkcccwkko..',
  '.occkkkcccckkco.',
  '.okkcccooccckko.',
  '.occkkkoookkcco.',
  '.okkcccccckkkco.',
  '..occkkkccckko..',
  '..ockkccckkcco..',
  '...oockkcccoo...',
  '.....oooooo.....',
  '................',
  '................',
]);

export const SPRITE_CARDS = sprite([
  '................',
  '................',
  '................',
  '...oooooo.......',
  '...owwwwo.......',
  '...owccwoooooo..',
  '...owccwowwwwo..',
  '...owwwwowkkwo..',
  '...owwwwowkkwo..',
  '...oooooowwwwo..',
  '........owwwwo..',
  '........oooooo..',
  '................',
  '................',
  '................',
  '................',
]);

export const SPRITE_BAG = sprite([
  '................',
  '................',
  '................',
  '.....oo..oo.....',
  '.....o....o.....',
  '...oooooooooo...',
  '..oaaaaaaaaaao..',
  '..oaaaaaaaaaao..',
  '..oaaoaaaaoaao..',
  '..oaaaooooaaao..',
  '..oaaaaaaaaaao..',
  '..oaaaaaaaaaao..',
  '...oooooooooo...',
  '................',
  '................',
  '................',
]);

export const SPRITE_SOUND_ON = sprite([
  '................',
  '................',
  '................',
  '................',
  '......oo........',
  '.....ooo..a.....',
  '..oooooo.a.a....',
  '..ooooooo.a.a...',
  '..ooooooo.a.a...',
  '..oooooo.a.a....',
  '.....ooo..a.....',
  '......oo........',
  '................',
  '................',
  '................',
  '................',
]);

export const SPRITE_SOUND_OFF = sprite([
  '................',
  '................',
  '................',
  '................',
  '......oo........',
  '.....ooo........',
  '..oooooo.c...c..',
  '..ooooooo.c.c...',
  '..ooooooo..c....',
  '..oooooo..c.c...',
  '.....ooo.c...c..',
  '......oo........',
  '................',
  '................',
  '................',
  '................',
]);

export const SPRITE_ARROW_LEFT = sprite([
  '................',
  '................',
  '................',
  '................',
  '.....o..........',
  '....oo..........',
  '...ooooooooo....',
  '..oooooooooo....',
  '...ooooooooo....',
  '....oo..........',
  '.....o..........',
  '................',
  '................',
  '................',
  '................',
  '................',
]);

/** Dos de carte : motif de losanges facon jeu de cartes de bistrot. */
export const SPRITE_CARD_BACK = sprite([
  'cccccccccccccccc',
  'cakccccakccccakc',
  'ckakcckakcckakcc',
  'cckakckakckakccc',
  'cccakkakkakkcccc',
  'ccckakakakakcccc',
  'cccckakakakccccc',
  'ccccckakakcccccc',
  'cccckakakakccccc',
  'ccckakakakakcccc',
  'cccakkakkakkcccc',
  'cckakckakckakccc',
  'ckakcckakcckakcc',
  'cakccccakccccakc',
  'cccccccccccccccc',
  'cccccccccccccccc',
]);

export const SPRITES = {
  spade: SPRITE_SPADE,
  heart: SPRITE_HEART,
  diamond: SPRITE_DIAMOND,
  club: SPRITE_CLUB,
  jack: SPRITE_JACK,
  queen: SPRITE_QUEEN,
  king: SPRITE_KING,
  crown: SPRITE_CROWN,
  skull: SPRITE_SKULL,
  bolt: SPRITE_BOLT,
  broom: SPRITE_BROOM,
  coin: SPRITE_COIN,
  chip: SPRITE_CHIP,
  zero: SPRITE_ZERO,
  vault: SPRITE_VAULT,
  bill: SPRITE_BILL,
  fist: SPRITE_FIST,
  book: SPRITE_BOOK,
  trophy: SPRITE_TROPHY,
  wheel: SPRITE_WHEEL,
  cards: SPRITE_CARDS,
  bag: SPRITE_BAG,
  soundOn: SPRITE_SOUND_ON,
  soundOff: SPRITE_SOUND_OFF,
  arrowLeft: SPRITE_ARROW_LEFT,
  cardBack: SPRITE_CARD_BACK,
} as const;

export type SpriteName = keyof typeof SPRITES;

export const DEFAULT_PALETTE: Record<string, string> = {
  o: '#050807',
  w: '#f4ecd8',
  a: '#f2c14e',
  s: '#e8b48c',
  h: '#7a4a22',
  c: '#d7263d',
  k: '#12100d',
  g: '#24492f',
  m: '#8a8f98',
};
