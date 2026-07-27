import { type ReactNode, useEffect, useRef } from 'react';
import { sfxButton } from '../audio/sfx';

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Contenu colle sous l'entete, hors zone scrollable (onglets par exemple). */
  subheader?: ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, subheader, wide = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Le focus part sur le panneau pour que la touche Echap et la lecture
    // d'écran atterrissent au bon endroit.
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
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
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={wide ? { width: 'min(980px, 100%)' } : undefined}
      >
        <header className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button
            type="button"
            className="btn btn--sm modal__close"
            onClick={() => {
              sfxButton();
              onClose();
            }}
          >
            Fermer
          </button>
        </header>
        {subheader}
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
