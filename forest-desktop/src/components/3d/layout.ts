import { type GraphNode, type GraphEdge } from '../../lib/tauri-commands'
import { type PositionedNode, type PositionedEdge, type PositionedGraph } from './types'

export function createPositionedGraph(data: { nodes: GraphNode[]; edges: GraphEdge[] }): PositionedGraph {
  const count = data.nodes.length
  if (count === 0) {
    return { nodes: [], edges: [] }
  }

  const fallbackRadius = Math.max(12, count * 1.4)

  const positionedNodes: PositionedNode[] = data.nodes.map((node, index) => {
    const angle = (index / Math.max(1, count)) * Math.PI * 2
    const x = node.position_x ?? Math.cos(angle) * fallbackRadius
    const y = node.position_y ?? Math.sin(angle) * fallbackRadius
    const z = (index % 9) - 4
    const scale = 1.1 + Math.log2(1 + node.connection_count) * 0.25
    return {
      ...node,
      position: [x, y, z],
      size: scale,
      phase: Math.random() * Math.PI * 2
    }
  })

  const centroid = positionedNodes.reduce(
    (acc, node) => {
      acc.x += node.position[0]
      acc.y += node.position[1]
      acc.z += node.position[2]
      return acc
    },
    { x: 0, y: 0, z: 0 }
  )

  centroid.x /= count
  centroid.y /= count
  centroid.z /= count

  positionedNodes.forEach((node) => {
    node.position = [
      node.position[0] - centroid.x,
      node.position[1] - centroid.y,
      node.position[2] - centroid.z
    ]
  })

  const idToIndex = new Map<string, number>()
  positionedNodes.forEach((node, index) => idToIndex.set(node.id, index))

  const positionedEdges: PositionedEdge[] = []
  for (const edge of data.edges) {
    const sourceIndex = idToIndex.get(edge.source)
    const targetIndex = idToIndex.get(edge.target)
    if (sourceIndex === undefined || targetIndex === undefined) {
      continue
    }
    positionedEdges.push({
      ...edge,
      sourceIndex,
      targetIndex,
      phase: Math.random() * Math.PI * 2
    })
  }

  return { nodes: positionedNodes, edges: positionedEdges }
}
