import { create } from 'zustand'

interface UIState {
  selectedNodeId: string | null
  highlightedNodeIds: string[]
  settingsOpen: boolean
  setSelectedNodeId: (id: string | null) => void
  setHighlightedNodeIds: (ids: string[]) => void
  setSettingsOpen: (open: boolean) => void
  clearHighlights: () => void
}

export const useUI = create<UIState>((set) => ({
  selectedNodeId: null,
  highlightedNodeIds: [],
  settingsOpen: false,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setHighlightedNodeIds: (ids) => set({ highlightedNodeIds: ids }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  clearHighlights: () => set({ highlightedNodeIds: [] }),
}))
