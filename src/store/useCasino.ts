import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  applyMafiaTax,
  formatMoney,
  MAFIA_DEBT,
  MAFIA_LOAN,
  STARTING_BANK,
  WHEEL_COOLDOWN_MS,
} from '../engine/economy';
import { emptyInventory, ITEMS, type Inventory, type ItemId } from '../engine/items';
import type { BetPreset } from '../engine/roulette';
import { trophyById, type TrophyId } from '../engine/trophies';
import { sfxTrophy } from '../audio/sfx';
import { toast } from './useToasts';

export interface CasinoStats {
  manchesGagnees: number;
  plusGrosGain: number;
  meilleureSerieDouble: number;
  toursDeRoulette: number;
  meilleurAntePoker: number;
  mainsDePoker: number;
}

export interface CasinoState {
  bank: number;
  /** Dette restante envers la Mafia du Casino. 0 signifie libre. */
  debt: number;
  inventory: Inventory;
  /** Horodatage de deblocage, indexe par trophée. */
  trophies: Partial<Record<TrophyId, number>>;
  presets: BetPreset[];
  lastWheelAt: number | null;
  sound: boolean;
  reducedMotion: boolean;
  stats: CasinoStats;
  /** Plus haut solde atteint depuis l'ouverture de l'onglet. Non persiste. */
  sessionPeak: number;

  deposit(gross: number, label?: string): { net: number; tax: number };
  withdraw(amount: number): boolean;
  buyItem(id: ItemId): boolean;
  consumeItem(id: ItemId): boolean;
  unlock(id: TrophyId): boolean;
  takeLoan(): boolean;
  canSpinWheel(now?: number): boolean;
  claimWheel(amount: number): void;
  claimSideJob(amount: number): void;
  savePreset(preset: BetPreset): void;
  removePreset(id: string): void;
  recordStat<K extends keyof CasinoStats>(key: K, value: number, mode?: 'add' | 'max'): void;
  setSound(value: boolean): void;
  setReducedMotion(value: boolean): void;
  resetProgress(): void;
}

const initialStats: CasinoStats = {
  manchesGagnees: 0,
  plusGrosGain: 0,
  meilleureSerieDouble: 0,
  toursDeRoulette: 0,
  meilleurAntePoker: 0,
  mainsDePoker: 0,
};

export const useCasino = create<CasinoState>()(
  persist(
    (set, get) => ({
      bank: STARTING_BANK,
      debt: 0,
      inventory: emptyInventory(),
      trophies: {},
      presets: [],
      lastWheelAt: null,
      sound: true,
      reducedMotion: false,
      stats: { ...initialStats },
      sessionPeak: STARTING_BANK,

      deposit: (gross, label) => {
        if (gross <= 0) return { net: 0, tax: 0 };
        const { debt } = get();
        const taxed = applyMafiaTax(Math.round(gross), debt);
        const wasIndebted = debt > 0;

        set((state) => ({
          bank: state.bank + taxed.net,
          debt: taxed.debtLeft,
          sessionPeak: Math.max(state.sessionPeak, state.bank + taxed.net),
        }));

        if (taxed.tax > 0) {
          toast.perte('La Mafia se sert', `${formatMoney(taxed.tax)} prélevés sur ton gain.`);
        }
        if (wasIndebted && taxed.debtLeft === 0) get().unlock('dette-payee');
        if (get().bank >= 10_000) get().unlock('casse-la-banque');
        if (label && taxed.net > 0) toast.gain(label, `+ ${formatMoney(taxed.net)}`);

        get().recordStat('plusGrosGain', taxed.net, 'max');
        return { net: taxed.net, tax: taxed.tax };
      },

      withdraw: (amount) => {
        const rounded = Math.round(amount);
        if (rounded <= 0) return true;
        if (get().bank < rounded) return false;
        set((state) => ({ bank: state.bank - rounded }));
        if (get().bank === 0 && get().sessionPeak >= 5000) get().unlock('du-striker-au-clochard');
        return true;
      },

      buyItem: (id) => {
        const item = ITEMS[id];
        const state = get();
        if (state.inventory[id] >= item.maxStack) {
          toast.info('Stock plein', `${item.name} est déjà au maximum.`);
          return false;
        }
        if (!state.withdraw(item.price)) {
          toast.perte('Fonds insuffisants', `Il te faut ${formatMoney(item.price)}.`);
          return false;
        }
        set((s) => ({ inventory: { ...s.inventory, [id]: s.inventory[id] + 1 } }));
        toast.info(`${item.name} achete`, `- ${formatMoney(item.price)}`);
        return true;
      },

      consumeItem: (id) => {
        if (get().inventory[id] <= 0) return false;
        set((s) => ({ inventory: { ...s.inventory, [id]: s.inventory[id] - 1 } }));
        return true;
      },

      unlock: (id) => {
        if (get().trophies[id]) return false;
        const trophy = trophyById(id);
        set((state) => ({
          trophies: { ...state.trophies, [id]: Date.now() },
          // La prime de trophée echappe a la taxe Mafia : c'est un cadeau du casino.
          bank: state.bank + trophy.reward,
          sessionPeak: Math.max(state.sessionPeak, state.bank + trophy.reward),
        }));
        sfxTrophy();
        toast.trophée(`Trophée : ${trophy.name}`, `+ ${formatMoney(trophy.reward)}`);
        return true;
      },

      takeLoan: () => {
        if (get().debt > 0) {
          toast.perte('Déjà endette', 'Rembourse ta dette avant de retenter ta chance.');
          return false;
        }
        set((state) => ({
          bank: state.bank + MAFIA_LOAN,
          debt: MAFIA_DEBT,
          sessionPeak: Math.max(state.sessionPeak, state.bank + MAFIA_LOAN),
        }));
        toast.info('Emprunt accorde', `+ ${formatMoney(MAFIA_LOAN)}, taxe de 20 % sur tes gains.`);
        return true;
      },

      canSpinWheel: (now = Date.now()) => {
        const last = get().lastWheelAt;
        if (last === null) return true;
        return now - last >= WHEEL_COOLDOWN_MS;
      },

      claimWheel: (amount) => {
        set((state) => ({
          bank: state.bank + amount,
          lastWheelAt: Date.now(),
          sessionPeak: Math.max(state.sessionPeak, state.bank + amount),
        }));
      },

      claimSideJob: (amount) => {
        if (amount <= 0) return;
        set((state) => ({
          bank: state.bank + amount,
          sessionPeak: Math.max(state.sessionPeak, state.bank + amount),
        }));
      },

      savePreset: (preset) => {
        set((state) => ({
          presets: [...state.presets.filter((p) => p.id !== preset.id), preset].slice(-8),
        }));
        toast.info('Preset sauvegarde', preset.name);
      },

      removePreset: (id) => set((state) => ({ presets: state.presets.filter((p) => p.id !== id) })),

      recordStat: (key, value, mode = 'add') =>
        set((state) => ({
          stats: {
            ...state.stats,
            [key]: mode === 'add' ? state.stats[key] + value : Math.max(state.stats[key], value),
          },
        })),

      setSound: (value) => set({ sound: value }),
      setReducedMotion: (value) => set({ reducedMotion: value }),

      resetProgress: () =>
        set({
          bank: STARTING_BANK,
          debt: 0,
          inventory: emptyInventory(),
          trophies: {},
          presets: [],
          lastWheelAt: null,
          stats: { ...initialStats },
          sessionPeak: STARTING_BANK,
        }),
    }),
    {
      name: 'pocket-casino/v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // sessionPeak est volontairement recalcule a chaque ouverture : le trophée
      // "Du Striker au Clochard" récompense une chute dans une même session.
      partialize: ({ sessionPeak: _sessionPeak, ...rest }) => rest as CasinoState,
      onRehydrateStorage: () => (state) => {
        if (state) state.sessionPeak = state.bank;
      },
    },
  ),
);

/** Selecteurs prets a l'emploi, pour éviter de re-render sur tout le store. */
export const selectBank = (s: CasinoState) => s.bank;
export const selectDebt = (s: CasinoState) => s.debt;
export const selectInventory = (s: CasinoState) => s.inventory;
