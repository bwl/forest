import { useState } from 'react'
import { GraphCanvas } from './components/GraphCanvas'
import { CommandPalette } from './components/CommandPalette'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { HUDLayer } from './components/hud/HUDLayer'
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
    <HUDLayer>
      <div className="app-container">
        <GraphCanvas onNodeClick={setSelectedNode} highlightedNodes={highlightedNodes} />
      </div>

      <CommandPalette
        onSearch={handleSearch}
        onNodeCreated={handleNodeCreated}
        onOpenSettings={() => setShowSettings(true)}
      />

      {selectedNode && (
        <NodeDetailPanel nodeId={selectedNode} onClose={() => setSelectedNode(null)} />
      )}

      {showSettings && (
        <div className="app-settings-overlay">
          <div className="app-settings-card">
            <h2>Settings</h2>
            <p>Settings panel coming soon!</p>
            <button onClick={() => setShowSettings(false)} className="forest-button">
              Close
            </button>
          </div>
        </div>
      )}
    </HUDLayer>
  )
}

export default App
