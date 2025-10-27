import { create } from 'zustand'

interface UIState {
  selectedNodeId: string | null
  highlightedNodeIds: string[]
  settingsOpen: boolean
  proposalsOpen: boolean
  setSelectedNodeId: (id: string | null) => void
  setHighlightedNodeIds: (ids: string[]) => void
  setSettingsOpen: (open: boolean) => void
  setProposalsOpen: (open: boolean) => void
  clearHighlights: () => void
}

export const useUI = create<UIState>((set) => ({
  selectedNodeId: null,
  highlightedNodeIds: [],
  settingsOpen: false,
  proposalsOpen: false,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setHighlightedNodeIds: (ids) => set({ highlightedNodeIds: ids }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setProposalsOpen: (open) => set({ proposalsOpen: open }),
  clearHighlights: () => set({ highlightedNodeIds: [] }),
}))
