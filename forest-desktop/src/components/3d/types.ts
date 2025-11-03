import { type GraphNode, type GraphEdge } from '../../lib/tauri-commands'

export type PositionedNode = GraphNode & {
  position: [number, number, number]
  size: number
  phase: number
  color: string
}

export type PositionedEdge = GraphEdge & {
  sourceIndex: number
  targetIndex: number
  phase: number
}

export type BoundingBox = {
  min: [number, number, number]
  max: [number, number, number]
  center: [number, number, number]
  size: [number, number, number]
  radius: number
}

export type PositionedGraph = {
  nodes: PositionedNode[]
  edges: PositionedEdge[]
  bounds: BoundingBox
}
