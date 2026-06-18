import { create } from 'zustand';

// Minimal UI store for Phase 1 — exists to prove Zustand is wired in.
// Real state (physical config, sources, timeline, layers) is added later.
interface UiState {
  previewOpenCount: number;
  registerPreviewOpen: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  previewOpenCount: 0,
  registerPreviewOpen: () =>
    set((s) => ({ previewOpenCount: s.previewOpenCount + 1 })),
}));
