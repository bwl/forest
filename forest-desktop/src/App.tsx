import { GameViewport } from './components/3d/GameViewport'
import { CommandPalette } from './components/CommandPalette'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { RenderBudgetOverlay } from './components/RenderBudgetOverlay'
import { ErrorBoundary } from './components/ErrorBoundary'
import { HUDLayer } from './components/hud/HUDLayer'
import { HUDWindow } from './components/hud/HUDWindow'
import { ForestEventsBridge } from './hooks/useForestEvents'
import { useUI } from './store/ui'
import { useSearchNodes } from './queries/forest'

function AppContent() {
  const selectedNodeId = useUI((s) => s.selectedNodeId)
  const setSelectedNodeId = useUI((s) => s.setSelectedNodeId)
  const setHighlightedNodeIds = useUI((s) => s.setHighlightedNodeIds)
  const settingsOpen = useUI((s) => s.settingsOpen)
  const setSettingsOpen = useUI((s) => s.setSettingsOpen)

  const searchMutation = useSearchNodes()

  async function handleSearch(query: string) {
    try {
      const results = await searchMutation.mutateAsync({ query, limit: 10 })
      const nodeIds = results.map((r) => r.id)
      setHighlightedNodeIds(nodeIds)
    } catch (err) {
      console.error('Search failed', err)
    }
  }

  return (
    <>
      <ForestEventsBridge />
      <HUDLayer>
        <div className="app-container">
          <ErrorBoundary level="component">
            <GameViewport onNodeClick={setSelectedNodeId} />
          </ErrorBoundary>
        </div>

        <RenderBudgetOverlay />

        <ErrorBoundary level="component">
          <HUDWindow id="command-palette" title="Command" initialX={20} initialY={20}>
            <CommandPalette
              onSearch={handleSearch}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </HUDWindow>
        </ErrorBoundary>

        {selectedNodeId && (
          <ErrorBoundary level="component">
            <HUDWindow id="node-detail" title="Node Detail" initialX={400} initialY={20}>
              {/* key prop resets component state when node changes - no useEffect needed! */}
              <NodeDetailPanel
                key={selectedNodeId}
                nodeId={selectedNodeId}
                onClose={() => setSelectedNodeId(null)}
              />
            </HUDWindow>
          </ErrorBoundary>
        )}

        {settingsOpen && (
          <div className="hud-overlay">
            <div className="glass-panel rounded-2xl p-8 max-w-md">
              <h2 className="text-2xl font-bold mb-4">Settings</h2>
              <p className="text-slate-300 mb-6">Settings panel coming soon!</p>
              <button className="btn-primary" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </HUDLayer>
    </>
  )
}

function App() {
  return (
    <ErrorBoundary level="root">
      <AppContent />
    </ErrorBoundary>
  )
}

export default App
