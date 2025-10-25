import { useState } from 'react'
import { GameViewport } from './components/GameViewport'
import { CommandPalette } from './components/CommandPalette'
import { NodeDetailPanel } from './components/NodeDetailPanel'
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
    <div className="app-container">
      <GameViewport
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
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
        }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '8px' }}>
            <h2>Settings</h2>
            <p>Settings panel coming soon!</p>
            <button onClick={() => setShowSettings(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
