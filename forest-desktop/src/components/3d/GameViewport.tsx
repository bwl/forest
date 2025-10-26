import { Suspense, useMemo, useState } from 'react'
import { Canvas, extend } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { FrameMetricsTracker } from '../RenderBudgetOverlay'
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

  const graph = useMemo(() => {
    if (!graphData) return null
    return createPositionedGraph(graphData)
  }, [graphData])

  const hoveredNodeId = useMemo(() => {
    if (!graph || hoveredIndex === null) return null
    return graph.nodes[hoveredIndex]?.id ?? null
  }, [graph, hoveredIndex])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-b from-[#111733] to-[#02030f]">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-[2] text-white/70 tracking-wider text-sm">
          Loading galaxy...
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
            <FrameMetricsTracker />
            <color attach="background" args={['#02030f']} />
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
