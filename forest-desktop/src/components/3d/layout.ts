import { type GraphNode, type GraphEdge } from '../../lib/tauri-commands'
import { type PositionedNode, type PositionedEdge, type PositionedGraph, type BoundingBox } from './types'

/**
 * Generate a consistent color for a given string (tag or document ID)
 * Uses HSL color space for good contrast and visual separation
 */
function hashColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 60%)` // Bright, saturated colors
}

/**
 * Calculate color for a node based on document or tag
 * Priority: document > primary tag > default grey
 */
function calculateNodeColor(node: GraphNode): string {
  // If node is part of a document, use document color
  if (node.parent_document_id) {
    return hashColor(node.parent_document_id)
  }

  // Otherwise use primary tag color
  if (node.tags && node.tags.length > 0) {
    return hashColor(node.tags[0])
  }

  // Default grey for untagged standalone nodes
  return 'hsl(0, 0%, 50%)'
}

/**
 * Force-directed graph layout using Fruchterman-Reingold algorithm
 * Positions nodes based on their connections - connected nodes attract, all nodes repel
 */
function forceDirectedLayout(nodes: GraphNode[], edges: GraphEdge[]): PositionedNode[] {
  const count = nodes.length

  // Initialize 3D positions using spherical distribution
  const positions = new Map<string, { x: number; y: number; z: number; vx: number; vy: number; vz: number }>()
  const radius = Math.sqrt(count) * 15

  nodes.forEach((node, index) => {
    // Distribute nodes on a sphere using golden angle spirals
    // This gives even distribution without clustering at poles
    const phi = Math.acos(1 - 2 * (index + 0.5) / count) // Polar angle (0 to π)
    const theta = Math.PI * (1 + Math.sqrt(5)) * index // Azimuthal angle (golden angle)

    positions.set(node.id, {
      x: Math.cos(theta) * Math.sin(phi) * radius,
      y: Math.sin(theta) * Math.sin(phi) * radius,
      z: Math.cos(phi) * radius,
      vx: 0,
      vy: 0,
      vz: 0
    })
  })

  // Build adjacency map for fast edge lookup
  const adjacency = new Map<string, Set<string>>()
  edges.forEach(edge => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set())
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set())
    adjacency.get(edge.source)!.add(edge.target)
    adjacency.get(edge.target)!.add(edge.source)
  })

  // Physics parameters
  const k = Math.sqrt((radius * radius * 4) / count) // Optimal distance
  const iterations = Math.min(50, Math.max(10, Math.floor(200 / Math.log(count)))) // Fewer iterations for large graphs
  const coolingFactor = 0.95
  let temperature = radius * 0.1

  console.log('[ForceLayout] Starting simulation:', { nodes: count, edges: edges.length, k: k.toFixed(1), iterations })

  // Simulation loop
  for (let iter = 0; iter < iterations; iter++) {
    // Reset velocities
    positions.forEach(pos => {
      pos.vx = 0
      pos.vy = 0
      pos.vz = 0
    })

    // Repulsive forces (all pairs) - 3D
    nodes.forEach(nodeA => {
      const posA = positions.get(nodeA.id)!
      nodes.forEach(nodeB => {
        if (nodeA.id === nodeB.id) return
        const posB = positions.get(nodeB.id)!

        const dx = posA.x - posB.x
        const dy = posA.y - posB.y
        const dz = posA.z - posB.z
        const distSq = dx * dx + dy * dy + dz * dz

        if (distSq > 0 && distSq < k * k * 16) { // Only apply within range
          const dist = Math.sqrt(distSq)
          const force = (k * k) / dist
          posA.vx += (dx / dist) * force
          posA.vy += (dy / dist) * force
          posA.vz += (dz / dist) * force
        }
      })
    })

    // Attractive forces (connected nodes) - 3D
    edges.forEach(edge => {
      const posA = positions.get(edge.source)
      const posB = positions.get(edge.target)
      if (!posA || !posB) return

      const dx = posB.x - posA.x
      const dy = posB.y - posA.y
      const dz = posB.z - posA.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (dist > 0) {
        const force = (dist * dist) / k
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        const fz = (dz / dist) * force

        posA.vx += fx
        posA.vy += fy
        posA.vz += fz
        posB.vx -= fx
        posB.vy -= fy
        posB.vz -= fz
      }
    })

    // Update positions with cooling - 3D
    positions.forEach(pos => {
      const vLen = Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy + pos.vz * pos.vz)
      if (vLen > 0) {
        const displacement = Math.min(vLen, temperature)
        pos.x += (pos.vx / vLen) * displacement
        pos.y += (pos.vy / vLen) * displacement
        pos.z += (pos.vz / vLen) * displacement
      }
    })

    temperature *= coolingFactor
  }

  console.log('[ForceLayout] Simulation complete')

  // Convert to PositionedNode array
  return nodes.map(node => {
    const pos = positions.get(node.id)!
    const scale = 1.1 + Math.log2(1 + node.connection_count) * 0.25
    const color = calculateNodeColor(node)
    return {
      ...node,
      position: [pos.x, pos.y, pos.z] as [number, number, number],
      size: scale,
      phase: Math.random() * Math.PI * 2,
      color
    }
  })
}

export function createPositionedGraph(data: { nodes: GraphNode[]; edges: GraphEdge[] }): PositionedGraph {
  const count = data.nodes.length
  console.log('[Layout] Creating graph with', count, 'nodes and', data.edges.length, 'edges')
  if (count === 0) {
    console.warn('[Layout] No nodes to render, returning empty graph')
    return {
      nodes: [],
      edges: [],
      bounds: {
        min: [0, 0, 0],
        max: [0, 0, 0],
        center: [0, 0, 0],
        size: [0, 0, 0],
        radius: 0
      }
    }
  }

  // Use force-directed layout if no saved positions exist
  const needsForceLayout = data.nodes.every(n => n.position_x == null || n.position_y == null)

  let positionedNodes: PositionedNode[]

  if (needsForceLayout) {
    console.log('[Layout] Running force-directed layout algorithm...')
    positionedNodes = forceDirectedLayout(data.nodes, data.edges)
  } else {
    // Use existing positions
    positionedNodes = data.nodes.map((node, index) => {
      const z = (index % 9) - 4
      const scale = 1.1 + Math.log2(1 + node.connection_count) * 0.25
      const color = calculateNodeColor(node)
      return {
        ...node,
        position: [node.position_x!, node.position_y!, z],
        size: scale,
        phase: Math.random() * Math.PI * 2,
        color
      }
    })
  }

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
  let skippedEdgeCount = 0
  for (const edge of data.edges) {
    const sourceIndex = idToIndex.get(edge.source)
    const targetIndex = idToIndex.get(edge.target)
    if (sourceIndex === undefined || targetIndex === undefined) {
      skippedEdgeCount++
      if (skippedEdgeCount <= 5) {
        console.warn('[Layout] Skipping edge - missing node:', {
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          sourceFound: sourceIndex !== undefined,
          targetFound: targetIndex !== undefined
        })
      }
      continue
    }
    positionedEdges.push({
      ...edge,
      sourceIndex,
      targetIndex,
      phase: Math.random() * Math.PI * 2
    })
  }

  if (skippedEdgeCount > 0) {
    console.warn(`[Layout] Skipped ${skippedEdgeCount} edges with missing nodes (${((skippedEdgeCount / data.edges.length) * 100).toFixed(1)}%)`)
  }

  // Calculate bounding box for camera positioning
  const bounds: BoundingBox = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
    center: [0, 0, 0],
    size: [0, 0, 0],
    radius: 0
  }

  positionedNodes.forEach((node) => {
    bounds.min[0] = Math.min(bounds.min[0], node.position[0])
    bounds.min[1] = Math.min(bounds.min[1], node.position[1])
    bounds.min[2] = Math.min(bounds.min[2], node.position[2])
    bounds.max[0] = Math.max(bounds.max[0], node.position[0])
    bounds.max[1] = Math.max(bounds.max[1], node.position[1])
    bounds.max[2] = Math.max(bounds.max[2], node.position[2])
  })

  bounds.center[0] = (bounds.min[0] + bounds.max[0]) / 2
  bounds.center[1] = (bounds.min[1] + bounds.max[1]) / 2
  bounds.center[2] = (bounds.min[2] + bounds.max[2]) / 2

  bounds.size[0] = bounds.max[0] - bounds.min[0]
  bounds.size[1] = bounds.max[1] - bounds.min[1]
  bounds.size[2] = bounds.max[2] - bounds.min[2]

  // Calculate radius as distance from center to furthest corner
  bounds.radius = Math.sqrt(
    bounds.size[0] * bounds.size[0] +
    bounds.size[1] * bounds.size[1] +
    bounds.size[2] * bounds.size[2]
  ) / 2

  console.log('[Layout] Final positioned graph:', {
    nodes: positionedNodes.length,
    edges: positionedEdges.length,
    skipped: skippedEdgeCount,
    bounds: {
      center: bounds.center,
      size: bounds.size,
      radius: bounds.radius.toFixed(1)
    }
  })

  return { nodes: positionedNodes, edges: positionedEdges, bounds }
}
