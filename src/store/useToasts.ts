import { create } from 'zustand';

export type ToastKind = 'info' | 'gain' | 'perte' | 'trophée';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  /** Duree d'affichage en millisecondes. */
  ttl: number;
}

interface ToastState {
  toasts: Toast[];
  push(toast: Omit<Toast, 'id' | 'ttl'> & { ttl?: number }): number;
  dismiss(id: number): void;
  clear(): void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: ({ ttl = 3600, ...rest }) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, ttl, ...rest }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Raccourci utilisable hors composant React. */
export const toast = {
  info: (title: string, detail?: string) =>
    useToasts.getState().push({ kind: 'info', title, detail }),
  gain: (title: string, detail?: string) =>
    useToasts.getState().push({ kind: 'gain', title, detail }),
  perte: (title: string, detail?: string) =>
    useToasts.getState().push({ kind: 'perte', title, detail }),
  trophée: (title: string, detail?: string) =>
    useToasts.getState().push({ kind: 'trophée', title, detail, ttl: 5200 }),
};
