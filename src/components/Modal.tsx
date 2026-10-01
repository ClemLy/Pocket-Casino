import { type ReactNode, useEffect, useRef } from 'react';
import { sfxButton } from '../audio/sfx';

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Contenu colle sous l'entete, hors zone scrollable (onglets par exemple). */
  subheader?: ReactNode;
  /** Ligne d'accroche sous le titre. */
  kicker?: string;
  wide?: boolean;
}

export function Modal({ title, onClose, children, subheader, kicker, wide = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Le focus part sur le panneau pour que la touche Echap et la lecture
    // d'écran atterrissent au bon endroit.
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`modal${wide ? ' modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="modal__head">
          <div className="modal__titles">
            {kicker ? <p className="modal__kicker">{kicker}</p> : null}
            <h2 className="modal__title">{title}</h2>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm modal__close"
            onClick={() => {
              sfxButton();
              onClose();
            }}
          >
            Fermer <span className="kbd">Esc</span>
          </button>
        </header>
        {subheader}
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
