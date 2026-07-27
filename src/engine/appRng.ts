import { createRng, seedFromLocation } from './rng';

/**
 * Générateur partage par toute l'application.
 *
 * Passer `?seed=1234` dans l'URL rend la session entierement reproductible :
 * c'est ce que fait scripts/screenshots.mjs pour obtenir des captures stables.
 */
export const appRng = createRng(seedFromLocation());
