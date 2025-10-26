import { type GraphNode, type GraphEdge } from '../../lib/tauri-commands'

export type PositionedNode = GraphNode & {
  position: [number, number, number]
  size: number
  phase: number
}

export type PositionedEdge = GraphEdge & {
  sourceIndex: number
  targetIndex: number
  phase: number
}

export type PositionedGraph = {
  nodes: PositionedNode[]
  edges: PositionedEdge[]
}
