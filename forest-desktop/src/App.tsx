import { GameViewport } from './components/3d/GameViewport'
import { CommandPalette } from './components/CommandPalette'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { EdgeProposals } from './components/EdgeProposals'
import { ErrorBoundary } from './components/ErrorBoundary'
import { HUDLayer } from './components/hud/HUDLayer'
import { HUDWindow } from './components/hud/HUDWindow'
import { SettingsPanel } from './components/SettingsPanel'
import { ForestEventsBridge } from './hooks/useForestEvents'
import { useUI } from './store/ui'
import { useSearchNodes } from './queries/forest'

function AppContent() {
  const selectedNodeId = useUI((s) => s.selectedNodeId)
  const setSelectedNodeId = useUI((s) => s.setSelectedNodeId)
  const setHighlightedNodeIds = useUI((s) => s.setHighlightedNodeIds)
  const settingsOpen = useUI((s) => s.settingsOpen)
  const setSettingsOpen = useUI((s) => s.setSettingsOpen)
  const proposalsOpen = useUI((s) => s.proposalsOpen)
  const setProposalsOpen = useUI((s) => s.setProposalsOpen)

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

        <ErrorBoundary level="component">
          <HUDWindow id="command-palette" title="Command" initialX={20} initialY={20}>
            <CommandPalette
              onSearch={handleSearch}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenProposals={() => setProposalsOpen(true)}
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

        {proposalsOpen && (
          <ErrorBoundary level="component">
            <HUDWindow
              id="edge-proposals"
              title="Edge Proposals"
              initialX={20}
              initialY={120}
              onClose={() => setProposalsOpen(false)}
            >
              <EdgeProposals />
            </HUDWindow>
          </ErrorBoundary>
        )}

        {settingsOpen && (
          <ErrorBoundary level="component">
            <SettingsPanel onClose={() => setSettingsOpen(false)} />
          </ErrorBoundary>
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
