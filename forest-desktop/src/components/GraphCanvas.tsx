import { useCallback, useEffect, useState } from 'react'
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { invoke } from '@tauri-apps/api/core'
import dagre from 'dagre'

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

interface GraphNode {
  id: string
  title: string
  tags: string[]
  position_x: number | null
  position_y: number | null
  connection_count: number
}

interface GraphEdge {
  id: string
  source: string
  target: string
  score: number
}

interface Props {
  onNodeClick: (nodeId: string) => void
  highlightedNodes?: string[]
}

// Dagre layout for force-directed positioning
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 150 })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 150, height: 50 })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 75,
        y: nodeWithPosition.y - 25,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

export function GraphCanvas({ onNodeClick, highlightedNodes = [] }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)

  const loadGraphData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await invoke<GraphData>('get_graph_data')

      // Convert to ReactFlow format
      const flowNodes: Node[] = data.nodes.map((n) => {
        const isHighlighted = highlightedNodes.includes(n.id)
        return {
          id: n.id,
          type: 'default',
          data: {
            label: n.title,
            tags: n.tags,
            connectionCount: n.connection_count,
          },
          position: {
            x: n.position_x ?? 0,
            y: n.position_y ?? 0,
          },
          style: isHighlighted
            ? {
                background: '#ffd700',
                border: '3px solid #ff6b00',
                boxShadow: '0 0 10px rgba(255, 107, 0, 0.5)',
              }
            : undefined,
        }
      })

      const flowEdges: Edge[] = data.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: `${(e.score * 100).toFixed(0)}%`,
        style: { stroke: '#0a0', strokeWidth: 2 },
      }))

      // Use saved positions if available, otherwise compute layout
      const hasPositions = data.nodes.some((n) => n.position_x !== null)

      if (hasPositions) {
        setNodes(flowNodes)
        setEdges(flowEdges)
      } else {
        // No saved positions - use force-directed layout
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          flowNodes,
          flowEdges
        )
        setNodes(layoutedNodes)
        setEdges(layoutedEdges)
      }
    } catch (err) {
      console.error('Failed to load graph:', err)
    } finally {
      setLoading(false)
    }
  }, [setNodes, setEdges, highlightedNodes])

  // Load graph data on mount and when highlighted nodes change
  useEffect(() => {
    loadGraphData()
  }, [loadGraphData])

  // Update node styles when highlightedNodes changes
  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        style: highlightedNodes.includes(node.id)
          ? {
              background: '#ffd700',
              border: '3px solid #ff6b00',
              boxShadow: '0 0 10px rgba(255, 107, 0, 0.5)',
            }
          : undefined,
      }))
    )
  }, [highlightedNodes, setNodes])

  // Save position when node is dragged
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      invoke('update_node_position', {
        id: node.id,
        x: node.position.x,
        y: node.position.y,
      }).catch((err) => console.error('Failed to save position:', err))
    },
    []
  )

  // Handle node click
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeClick(node.id)
    },
    [onNodeClick]
  )

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading graph...</p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        className="graph-canvas"
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="rgba(148, 163, 184, 0.45)" gap={32} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
