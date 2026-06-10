import { create } from "zustand";

/**
 * Example Zustand store. One store per concern (*.store.ts), for CLIENT-ONLY
 * UI state (modals, sidebar, filters). Server data belongs in TanStack Query,
 * not here.
 */
interface UiState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
