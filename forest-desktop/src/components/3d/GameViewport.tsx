import { Suspense, useMemo, useState, useRef } from 'react'
import { Canvas, extend } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useUI } from '../../store/ui'
import { useGraph } from '../../queries/forest'
import { NodeGlowMaterial, EdgeTrailMaterial } from './materials'
import { NodeSystem } from './NodeSystem'
import { EdgeSystem } from './EdgeSystem'
import { createPositionedGraph } from './layout'

extend({ NodeGlowMaterial, EdgeTrailMaterial })

interface Props {
  onNodeClick: (nodeId: string) => void
}

export function GameViewport({ onNodeClick }: Props) {
  const { data: graphData, isLoading } = useGraph()
  const highlightedNodeIds = useUI((s) => s.highlightedNodeIds)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const cursorPosRef = useRef({ x: 0, y: 0 })
  const tooltipRef = useRef<HTMLDivElement>(null)

  const graph = useMemo(() => {
    if (!graphData) return null
    return createPositionedGraph(graphData)
  }, [graphData])

  const hoveredNodeId = useMemo(() => {
    if (!graph || hoveredIndex === null) return null
    return graph.nodes[hoveredIndex]?.id ?? null
  }, [graph, hoveredIndex])

  const hoveredNode = useMemo(() => {
    if (!graph || hoveredIndex === null) return null
    return graph.nodes[hoveredIndex] ?? null
  }, [graph, hoveredIndex])

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#fdf6e3]"
      onMouseMove={(e) => {
        cursorPosRef.current = { x: e.clientX, y: e.clientY }
        if (tooltipRef.current) {
          tooltipRef.current.style.left = `${e.clientX + 15}px`
          tooltipRef.current.style.top = `${e.clientY + 15}px`
        }
      }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-[2] text-[#586e75] tracking-wider text-sm">
          Loading galaxy...
        </div>
      )}

      {/* Node title tooltip */}
      {hoveredNode && (
        <div
          ref={tooltipRef}
          className="absolute z-[10] pointer-events-none bg-[#eee8d5] text-[#073642] px-3 py-2 text-sm font-medium border border-[#93a1a1] max-w-[300px]"
          style={{
            left: `${cursorPosRef.current.x + 15}px`,
            top: `${cursorPosRef.current.y + 15}px`
          }}
        >
          {hoveredNode.title}
        </div>
      )}

      {graph && (
        <Canvas
          frameloop="always"
          dpr={[1, 2]}
          shadows
          camera={{ position: [0, 0, 65], fov: 50 }}
          onCreated={({ camera }) => {
            // Ensure camera looks at origin where graph is centered
            camera.lookAt(0, 0, 0)
          }}
        >
          <Suspense fallback={null}>
            <color attach="background" args={['#f3f3f3']} />
            <fog attach="fog" args={[new THREE.Color('#02030f'), 60, 180]} />
            <ambientLight intensity={0.6} color={new THREE.Color('#3f4a88')} />
            <pointLight position={[30, 40, 20]} intensity={1.4} color="#6287ff" />
            <pointLight position={[-25, -30, -10]} intensity={0.5} color="#ff7b54" />

            <EdgeSystem
              nodes={graph.nodes}
              edges={graph.edges}
              highlightedNodeIds={highlightedNodeIds}
              hoveredNodeId={hoveredNodeId}
            />
            <NodeSystem
              nodes={graph.nodes}
              highlightedNodeIds={highlightedNodeIds}
              hoveredIndex={hoveredIndex}
              onHover={setHoveredIndex}
              onSelect={onNodeClick}
            />

            <OrbitControls
              target={[0, 0, 0]}
              enablePan
              enableDamping
              dampingFactor={0.08}
              maxDistance={200}
              minDistance={18}
            />
          </Suspense>
        </Canvas>
      )}
    </div>
  )
}
