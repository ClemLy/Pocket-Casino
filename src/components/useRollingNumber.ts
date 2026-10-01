import { useEffect, useRef, useState } from 'react';
import { useCasino } from '../store/useCasino';

export interface RollingOptions {
  /** Duree minimale et maximale du defilement, en millisecondes. */
  min?: number;
  max?: number;
  /** Valeur de depart au montage. Par defaut, la cible : rien ne defile. */
  start?: number;
}

/**
 * Fait defiler un nombre vers sa nouvelle valeur au lieu de le remplacer.
 *
 * La duree s'allonge un peu avec l'ecart (un gros gain doit se sentir) mais
 * reste plafonnee : un compteur qui traine donne l'impression d'un jeu lent.
 */
export function useRollingNumber(
  target: number,
  { min = 260, max = 900, start }: RollingOptions = {},
): number {
  const reduced = useCasino((s) => s.reducedMotion);
  const [shown, setShown] = useState(start ?? target);
  const fromRef = useRef(start ?? target);
  const shownRef = useRef(start ?? target);

  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || prefersReduced) {
      setShown(target);
      return;
    }

    fromRef.current = shownRef.current;
    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) return;

    const duration = Math.min(max, min + Math.log10(Math.abs(delta) + 1) * 160);
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Sortie forte : la majorite du chemin est faite tout de suite.
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(Math.round(from + delta * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced, min, max]);

  return shown;
}
