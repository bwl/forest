import { useState } from 'react'
import { GraphCanvas } from './components/GraphCanvas'
import { CommandPalette } from './components/CommandPalette'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { RenderBudgetOverlay } from './components/RenderBudgetOverlay'
import { WebGLScene } from './components/WebGLScene'
import { searchNodes } from './lib/tauri-commands'

function App() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([])
  const [showSettings, setShowSettings] = useState(false)

  async function handleSearch(query: string) {
    try {
      const results = await searchNodes(query, 10)
      const nodeIds = results.map((r) => r.id)
      setHighlightedNodes(nodeIds)
      console.log(`Search results: ${results.length} nodes found for "${query}"`)
    } catch (err) {
      console.error('Search failed:', err)
    }
  }

  function handleNodeCreated() {
    // Reload graph
    window.location.reload()
  }

  return (
    <div className="app-shell">
      <div className="scene-layer">
        <WebGLScene highlightedNodes={highlightedNodes} />
      </div>

      <div className="hud-layer">
        <GraphCanvas
          onNodeClick={setSelectedNode}
          highlightedNodes={highlightedNodes}
        />

        <CommandPalette
          onSearch={handleSearch}
          onNodeCreated={handleNodeCreated}
          onOpenSettings={() => setShowSettings(true)}
        />

        {selectedNode && (
          <NodeDetailPanel
            nodeId={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}

        {showSettings && (
          <div className="glass-modal">
            <div className="glass-surface">
              <h2>Settings</h2>
              <p>Settings panel coming soon!</p>
              <button className="glass-button" onClick={() => setShowSettings(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      <RenderBudgetOverlay />
    </div>
  )
}

export default App
