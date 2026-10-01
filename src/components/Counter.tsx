import { formatMoney } from '../engine/economy';
import { useRollingNumber } from './useRollingNumber';

export interface CounterProps {
  value: number;
  money?: boolean;
  className?: string;
}

function format(value: number, money: boolean): string {
  return money ? formatMoney(value) : value.toLocaleString('fr-FR');
}

/**
 * Nombre qui roule. A placer dans un `.led` ou un `.num`.
 *
 * Les valeurs intermediaires sont cachees aux lecteurs d'ecran (elles seraient
 * annoncees a chaque image) : seule la valeur finale est lue.
 */
export function Counter({ value, money = false, className }: CounterProps) {
  const shown = useRollingNumber(value);
  return (
    <>
      <span className={className} aria-hidden="true">
        {format(shown, money)}
      </span>
      <span className="sr-only">{format(value, money)}</span>
    </>
  );
}
