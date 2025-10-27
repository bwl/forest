import { create } from 'zustand'

interface UIState {
  selectedNodeId: string | null
  highlightedNodeIds: string[]
  settingsOpen: boolean
  proposalsOpen: boolean
  captureOpen: boolean
  statsOpen: boolean
  setSelectedNodeId: (id: string | null) => void
  setHighlightedNodeIds: (ids: string[]) => void
  setSettingsOpen: (open: boolean) => void
  setProposalsOpen: (open: boolean) => void
  setCaptureOpen: (open: boolean) => void
  setStatsOpen: (open: boolean) => void
  clearHighlights: () => void
}

export const useUI = create<UIState>((set) => ({
  selectedNodeId: null,
  highlightedNodeIds: [],
  settingsOpen: false,
  proposalsOpen: false,
  captureOpen: false,
  statsOpen: false,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setHighlightedNodeIds: (ids) => set({ highlightedNodeIds: ids }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setProposalsOpen: (open) => set({ proposalsOpen: open }),
  setCaptureOpen: (open) => set({ captureOpen: open }),
  setStatsOpen: (open) => set({ statsOpen: open }),
  clearHighlights: () => set({ highlightedNodeIds: [] }),
}))
