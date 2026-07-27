import { useEffect } from 'react';
import { useToasts } from '../store/useToasts';

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
          className={`toast toast--${t.kind}`}
          onClick={() => dismiss(t.id)}
          aria-label={`Masquer : ${t.title}`}
        >
          <div className="toast__title">{t.title}</div>
          {t.detail ? <div className="toast__detail">{t.detail}</div> : null}
        </button>
      ))}
    </div>
  );
}
