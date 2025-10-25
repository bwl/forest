import { useEffect, useMemo, useState } from 'react'
import { GraphCanvas } from './components/GraphCanvas'
import { CommandPalette } from './components/CommandPalette'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { GameViewport } from './components/GameViewport'
import { SceneIntroOverlay } from './components/SceneIntroOverlay'
import {
  SceneStateProvider,
  useSceneMode,
  useSceneSend,
  useSceneValue,
} from './lib/sceneState'
import { searchNodes } from './lib/tauri-commands'

function AppContent() {
  const send = useSceneSend()
  const mode = useSceneMode()
  const settingsOpen = useSceneValue((state) => state.context.settingsOpen)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([])
  const [reloadingGraph, setReloadingGraph] = useState(false)

  async function handleSearch(query: string) {
    try {
      const results = await searchNodes(query, 10)
      const nodeIds = results.map((r) => r.id)
      setHighlightedNodes(nodeIds)
      send({ type: 'ENTER_EXPLORE' })
      console.log(`Search results: ${results.length} nodes found for "${query}"`)
    } catch (err) {
      console.error('Search failed:', err)
    }
  }

  function handleNodeCreated() {
    send({ type: 'ENTER_BUILD' })
    setReloadingGraph(true)
    // Give the backend a brief moment before reloading the graph dataset.
    window.setTimeout(() => {
      window.location.reload()
    }, 400)
  }

  const hudClassName = useMemo(() => {
    return ['hud-layer', `hud-layer--${mode}`].join(' ')
  }, [mode])

  useEffect(() => {
    if (!reloadingGraph) return
    const timeout = window.setTimeout(() => {
      setReloadingGraph(false)
      send({ type: 'ENTER_EXPLORE' })
    }, 1200)
    return () => window.clearTimeout(timeout)
  }, [reloadingGraph, send])

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId)
    send({ type: 'ENTER_FOCUS', nodeId })
  }

  const handleCloseNode = () => {
    setSelectedNode(null)
    send({ type: 'EXIT_FOCUS' })
  }

  const handlePaletteExpanded = (expanded: boolean) => {
    send({ type: expanded ? 'OPEN_COMMAND' : 'CLOSE_COMMAND' })
  }

  const handleOpenSettings = () => {
    send({ type: 'OPEN_SETTINGS' })
  }

  const handleCloseSettings = () => {
    send({ type: 'CLOSE_SETTINGS' })
  }

  return (
    <div className={`app-container scene-mode-${mode}`}>
      <GameViewport />
      <div className="graph-layer">
        <GraphCanvas
          onNodeClick={handleNodeClick}
          highlightedNodes={highlightedNodes}
        />
      </div>
      <SceneIntroOverlay />
      <div className={hudClassName}>
        <CommandPalette
          onSearch={handleSearch}
          onNodeCreated={handleNodeCreated}
          onOpenSettings={handleOpenSettings}
          onExpandedChange={handlePaletteExpanded}
        />

        {selectedNode && (
          <div className="hud-window hud-window--detail">
            <NodeDetailPanel nodeId={selectedNode} onClose={handleCloseNode} />
          </div>
        )}
      </div>

      {settingsOpen && (
        <div className="hud-overlay">
          <div className="hud-overlay__content">
            <h2>Settings</h2>
            <p>Settings panel coming soon!</p>
            <button className="forest-button" onClick={handleCloseSettings}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <SceneStateProvider>
      <AppContent />
    </SceneStateProvider>
  )
}

export default App
