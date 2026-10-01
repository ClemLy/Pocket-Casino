import { useEffect } from 'react';
import { useToasts } from '../store/useToasts';
import { Sprite } from './Sprite';
import type { SpriteName } from '../assets/sprites';

const ICON: Record<string, SpriteName> = {
  info: 'chip',
  gain: 'coin',
  perte: 'skull',
  trophée: 'trophy',
};

/** Pile de notifications en bas a droite, avec disparition automatique. */
export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => window.setTimeout(() => dismiss(t.id), t.ttl));
    return () => timers.forEach(window.clearTimeout);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.slice(-4).map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast toast--${t.kind === 'trophée' ? 'trophee' : t.kind}`}
          onClick={() => dismiss(t.id)}
          aria-label={`Masquer : ${t.title}`}
        >
          <span className="toast__icon" aria-hidden="true">
            <Sprite name={ICON[t.kind] ?? 'chip'} size={24} />
          </span>
          <span className="toast__text">
            <span className="toast__title">{t.title}</span>
            {t.detail ? <span className="toast__detail">{t.detail}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
