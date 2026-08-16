import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameId } from './lib/games';
import type { Ticket } from './lib/constraints';

export interface SavedTicket extends Ticket {
  id: string;
  game: GameId;
  savedAt: string;
  label: string;
  seed: string | null;
  bias: number;
}

interface Controls {
  /** -100 (cold) .. 0 (fair) .. 100 (hot). */
  bias: number;
  /**
   * 0 (all history counts equally) .. 100 (only the last few dozen draws matter).
   * Sets the half-life of the recency decay applied to the counts.
   */
  recency: number;
  pinned: number[];
  excluded: number[];
  pinnedSpecial: number | null;
  oddCount: number | null;
  sumRange: [number, number] | null;
  seed: string | null;
  ticketCount: number;
}

interface State {
  game: GameId;
  controls: Controls;
  tickets: Ticket[];
  vault: SavedTicket[];
  setGame: (g: GameId) => void;
  patch: (c: Partial<Controls>) => void;
  toggle: (kind: 'pinned' | 'excluded', ball: number) => void;
  resetControls: () => void;
  setTickets: (t: Ticket[]) => void;
  save: (t: SavedTicket) => void;
  remove: (id: string) => void;
  rename: (id: string, label: string) => void;
}

const DEFAULT_CONTROLS: Controls = {
  bias: 0,
  recency: 0,
  pinned: [],
  excluded: [],
  pinnedSpecial: null,
  oddCount: null,
  sumRange: null,
  seed: null,
  ticketCount: 1,
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      game: 'powerball',
      controls: DEFAULT_CONTROLS,
      tickets: [],
      vault: [],

      // Pins and exclusions are per-game number sets, so switching games clears them.
      setGame: (game) =>
        set((s) => ({
          game,
          tickets: [],
          controls: { ...s.controls, pinned: [], excluded: [], pinnedSpecial: null, sumRange: null },
        })),

      patch: (c) => set((s) => ({ controls: { ...s.controls, ...c } })),

      toggle: (kind, ball) =>
        set((s) => {
          const other = kind === 'pinned' ? 'excluded' : 'pinned';
          const list = s.controls[kind];
          const next = list.includes(ball)
            ? list.filter((b) => b !== ball)
            : [...list, ball].sort((a, b) => a - b);
          return {
            controls: {
              ...s.controls,
              [kind]: next,
              // A number cannot be pinned and excluded at once.
              [other]: s.controls[other].filter((b) => b !== ball),
            },
          };
        }),

      resetControls: () => set({ controls: DEFAULT_CONTROLS, tickets: [] }),
      setTickets: (tickets) => set({ tickets }),
      save: (t) => set((s) => ({ vault: [t, ...s.vault].slice(0, 200) })),
      remove: (id) => set((s) => ({ vault: s.vault.filter((t) => t.id !== id) })),
      rename: (id, label) =>
        set((s) => ({ vault: s.vault.map((t) => (t.id === id ? { ...t, label } : t)) })),
    }),
    {
      name: 'orrery',
      // Generated-but-unsaved tickets are deliberately not persisted.
      partialize: (s) => ({ game: s.game, controls: s.controls, vault: s.vault }),
      // The default merge replaces `controls` wholesale, so anyone with settings
      // saved before a new control existed would load it as undefined. Fill from
      // the defaults first.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...p,
          controls: { ...DEFAULT_CONTROLS, ...(p.controls ?? {}) },
        };
      },
    },
  ),
);
