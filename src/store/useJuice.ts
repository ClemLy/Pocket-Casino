import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Petit bus d'effets "game juice" : pluie de jetons et tremblement d'écran.
 * Les écrans déclenchent, les composants de rendu ecoutent, personne ne se
 * refile de refs.
 */
interface JuiceState {
  /** Incremente a chaque déclenchement, sert de signal aux effets React. */
  rainToken: number;
  rainCount: number;
  shakeToken: number;
  /**
   * Vrai tant qu'une manche est en cours quelque part. L'écran anti-banqueroute
   * s'appuie dessus pour ne jamais surgir au milieu d'un coup.
   */
  roundActive: boolean;
  rain(count?: number): void;
  shake(): void;
  setRoundActive(value: boolean): void;
}

export const useJuice = create<JuiceState>((set) => ({
  rainToken: 0,
  rainCount: 40,
  shakeToken: 0,
  roundActive: false,
  rain: (count = 40) => set((s) => ({ rainToken: s.rainToken + 1, rainCount: count })),
  shake: () => set((s) => ({ shakeToken: s.shakeToken + 1 })),
  setRoundActive: (value) => set({ roundActive: value }),
}));

/** Declare qu'une manche est en cours, et la libère au démontage de l'écran. */
export function useRoundActive(active: boolean): void {
  useEffect(() => {
    useJuice.getState().setRoundActive(active);
    return () => useJuice.getState().setRoundActive(false);
  }, [active]);
}
