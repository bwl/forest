import { GameViewport } from './components/3d/GameViewport'
import { CommandPalette } from './components/CommandPalette'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { EdgeProposals } from './components/EdgeProposals'
import { CaptureForm } from './components/CaptureForm'
import { StatsDisplay } from './components/StatsDisplay'
import { FooterBar } from './components/FooterBar'
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
  const clearHighlights = useUI((s) => s.clearHighlights)
  const settingsOpen = useUI((s) => s.settingsOpen)
  const setSettingsOpen = useUI((s) => s.setSettingsOpen)
  const proposalsOpen = useUI((s) => s.proposalsOpen)
  const setProposalsOpen = useUI((s) => s.setProposalsOpen)
  const captureOpen = useUI((s) => s.captureOpen)
  const setCaptureOpen = useUI((s) => s.setCaptureOpen)
  const statsOpen = useUI((s) => s.statsOpen)
  const setStatsOpen = useUI((s) => s.setStatsOpen)

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

        <div className="fixed top-0 left-0 right-0 z-50">
          <ErrorBoundary level="component">
            <CommandPalette
              onSearch={handleSearch}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenProposals={() => setProposalsOpen(true)}
            />
          </ErrorBoundary>
        </div>

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

        {captureOpen && (
          <ErrorBoundary level="component">
            <HUDWindow
              id="capture-form"
              title="Create Note"
              initialX={20}
              initialY={80}
              onClose={() => setCaptureOpen(false)}
            >
              <CaptureForm onNodeCreated={() => setCaptureOpen(false)} />
            </HUDWindow>
          </ErrorBoundary>
        )}

        {statsOpen && (
          <ErrorBoundary level="component">
            <HUDWindow
              id="stats-display"
              title="Statistics"
              initialX={20}
              initialY={200}
              onClose={() => setStatsOpen(false)}
            >
              <StatsDisplay />
            </HUDWindow>
          </ErrorBoundary>
        )}

        <FooterBar
          onCreateNote={() => setCaptureOpen(!captureOpen)}
          onSearch={() => {
            // Focus on command palette input
            const input = document.querySelector('.input') as HTMLInputElement
            if (input) input.focus()
          }}
          onProposals={() => setProposalsOpen(!proposalsOpen)}
          onSettings={() => setSettingsOpen(!settingsOpen)}
          onStats={() => setStatsOpen(!statsOpen)}
          onClear={() => {
            clearHighlights()
            setSelectedNodeId(null)
          }}
          captureOpen={captureOpen}
          proposalsOpen={proposalsOpen}
          settingsOpen={settingsOpen}
          statsOpen={statsOpen}
        />
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
