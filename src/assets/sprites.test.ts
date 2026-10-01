import { describe, expect, it } from 'vitest';
import { PORTRAITS } from './portraits';
import { DEFAULT_PALETTE, SPRITES } from './sprites';

describe('sprites pixel art', () => {
  it('a toutes ses lignes de largeur identique', () => {
    for (const [name, sprite] of Object.entries(SPRITES)) {
      const widths = new Set(sprite.rows.map((row) => row.length));
      expect(widths, `sprite "${name}" a des lignes de largeurs différentes`).toHaveLength(1);
      expect(sprite.width, `sprite "${name}"`).toBe(sprite.rows[0].length);
      expect(sprite.height, `sprite "${name}"`).toBe(sprite.rows.length);
    }
  });

  it("n'utilise que des couleurs déclarées dans la palette", () => {
    for (const [name, sprite] of Object.entries(SPRITES)) {
      for (const row of sprite.rows) {
        for (const char of row) {
          if (char === '.') continue;
          expect(
            DEFAULT_PALETTE[char],
            `sprite "${name}" utilise la couleur inconnue "${char}"`,
          ).toBeDefined();
        }
      }
    }
  });

  it('tient dans une grille carree de 16 pixels', () => {
    for (const [name, sprite] of Object.entries(SPRITES)) {
      expect(sprite.width, `sprite "${name}"`).toBe(16);
      expect(sprite.height, `sprite "${name}"`).toBe(16);
    }
  });

  it('dessine des portraits de figures reguliers et dans la palette', () => {
    for (const [name, portrait] of Object.entries(PORTRAITS)) {
      const widths = new Set(portrait.rows.map((row) => row.length));
      expect(widths, `portrait "${name}"`).toHaveLength(1);
      for (const row of portrait.rows) {
        for (const char of row) {
          if (char === '.') continue;
          expect(DEFAULT_PALETTE[char], `portrait "${name}" : couleur "${char}"`).toBeDefined();
        }
      }
    }
  });
});
