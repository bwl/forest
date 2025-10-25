import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, extend, useFrame } from '@react-three/fiber'
import { OrbitControls, shaderMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { getGraphData, type GraphEdge, type GraphNode } from '../lib/tauri-commands'

type Props = {
  onNodeClick: (nodeId: string) => void
  highlightedNodes?: string[]
}

type PositionedNode = GraphNode & {
  position: [number, number, number]
  size: number
  phase: number
}

type PositionedEdge = GraphEdge & {
  sourceIndex: number
  targetIndex: number
  phase: number
}

type PositionedGraph = {
  nodes: PositionedNode[]
  edges: PositionedEdge[]
}

const nodeVertexShader = `
  uniform float time;
  attribute float highlight;
  attribute float phase;
  varying float vHighlight;
  varying float vPulse;
  #include <common>
  #include <uv_pars_vertex>
  #include <color_pars_vertex>
  #include <fog_pars_vertex>
  #include <logdepthbuf_pars_vertex>
  #include <clipping_planes_pars_vertex>

  void main() {
    vHighlight = highlight;
    float pulse = sin(time * 0.9 + phase);
    vPulse = pulse;
    #include <uv_vertex>
    #include <color_vertex>
    #include <begin_vertex>
    transformed *= (1.0 + 0.08 * pulse);
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>
    #include <fog_vertex>
  }
`

const nodeFragmentShader = `
  varying float vHighlight;
  varying float vPulse;
  uniform vec3 baseColor;
  uniform vec3 highlightColor;
  uniform vec3 hoverColor;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  #include <clipping_planes_pars_fragment>
  #include <fog_pars_fragment>

  void main() {
    #include <logdepthbuf_fragment>
    #include <clipping_planes_fragment>
    float glow = 0.45 + 0.35 * (vPulse * 0.5 + 0.5);
    vec3 color = baseColor;
    if (vHighlight > 0.5) {
      color = mix(color, highlightColor, 0.7);
      glow += 0.1;
    }
    if (vHighlight > 1.5) {
      color = mix(color, hoverColor, 0.85);
      glow += 0.25;
    }
    gl_FragColor = vec4(color * glow, 1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    #include <fog_fragment>
  }
`

const edgeVertexShader = `
  uniform float time;
  attribute float highlight;
  attribute float phase;
  varying float vHighlight;
  varying float vPulse;
  #include <common>
  #include <color_pars_vertex>
  #include <fog_pars_vertex>
  #include <logdepthbuf_pars_vertex>
  #include <clipping_planes_pars_vertex>

  void main() {
    vHighlight = highlight;
    float wave = sin(time * 0.6 + phase);
    vPulse = wave;
    #include <color_vertex>
    #include <begin_vertex>
    transformed += normal * wave * 0.06;
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>
    #include <fog_vertex>
  }
`

const edgeFragmentShader = `
  varying float vHighlight;
  varying float vPulse;
  uniform vec3 baseColorA;
  uniform vec3 baseColorB;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  #include <clipping_planes_pars_fragment>
  #include <fog_pars_fragment>

  void main() {
    #include <logdepthbuf_fragment>
    #include <clipping_planes_fragment>
    float glow = 0.35 + 0.35 * (vPulse * 0.5 + 0.5);
    vec3 color = mix(baseColorA, baseColorB, clamp(vHighlight, 0.0, 1.0));
    if (vHighlight > 1.5) {
      color = mix(color, vec3(1.0, 0.6, 0.2), 0.7);
      glow += 0.2;
    }
    float alpha = 0.45 + 0.35 * clamp(vHighlight, 0.0, 1.0);
    gl_FragColor = vec4(color * glow, alpha);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    #include <fog_fragment>
  }
`

const NodeGlowMaterial = shaderMaterial(
  {
    time: 0,
    baseColor: new THREE.Color('#2f3c9b'),
    highlightColor: new THREE.Color('#f7c948'),
    hoverColor: new THREE.Color('#ff8855')
  },
  nodeVertexShader,
  nodeFragmentShader
)

const EdgeTrailMaterial = shaderMaterial(
  {
    time: 0,
    baseColorA: new THREE.Color('#0f1729'),
    baseColorB: new THREE.Color('#3b82f6')
  },
  edgeVertexShader,
  edgeFragmentShader
)

extend({ NodeGlowMaterial, EdgeTrailMaterial })

type NodeGlowMaterialImpl = THREE.ShaderMaterial & {
  uniforms: {
    time: { value: number }
    baseColor: { value: THREE.Color }
    highlightColor: { value: THREE.Color }
    hoverColor: { value: THREE.Color }
  }
}

type EdgeTrailMaterialImpl = THREE.ShaderMaterial & {
  uniforms: {
    time: { value: number }
    baseColorA: { value: THREE.Color }
    baseColorB: { value: THREE.Color }
  }
}

function createPositionedGraph(data: { nodes: GraphNode[]; edges: GraphEdge[] }): PositionedGraph {
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

function NodeSystem({
  nodes,
  highlightedNodeIds,
  hoveredIndex,
  onHover,
  onSelect
}: {
  nodes: PositionedNode[]
  highlightedNodeIds: string[]
  hoveredIndex: number | null
  onHover: (index: number | null) => void
  onSelect: (nodeId: string) => void
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const materialRef = useRef<NodeGlowMaterialImpl | null>(null)

  const highlightSet = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds])

  useEffect(() => {
    if (!meshRef.current) return

    const tempObject = new THREE.Object3D()
    nodes.forEach((node, index) => {
      tempObject.position.set(...node.position)
      tempObject.scale.setScalar(node.size)
      tempObject.rotation.set(0, 0, 0)
      tempObject.updateMatrix()
      meshRef.current!.setMatrixAt(index, tempObject.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true

    const phaseAttribute = new THREE.InstancedBufferAttribute(new Float32Array(nodes.length), 1)
    nodes.forEach((node, index) => {
      phaseAttribute.setX(index, node.phase)
    })
    phaseAttribute.needsUpdate = true
    meshRef.current.geometry.setAttribute('phase', phaseAttribute)
  }, [nodes])

  useEffect(() => {
    if (!meshRef.current) return
    const highlightAttribute = meshRef.current.geometry.getAttribute('highlight') as
      | THREE.InstancedBufferAttribute
      | undefined

    const attribute =
      highlightAttribute ?? new THREE.InstancedBufferAttribute(new Float32Array(nodes.length), 1)

    nodes.forEach((node, index) => {
      let value = highlightSet.has(node.id) ? 1 : 0
      if (hoveredIndex === index) {
        value = 2
      }
      attribute.setX(index, value)
    })

    meshRef.current.geometry.setAttribute('highlight', attribute)
    attribute.needsUpdate = true
  }, [nodes, highlightedNodeIds, highlightSet, hoveredIndex])

  useFrame(({ clock }) => {
    if (!materialRef.current) return
    materialRef.current.uniforms.time.value = clock.getElapsedTime()
  })

  return (
    <instancedMesh
      key={nodes.length}
      ref={meshRef}
      args={[undefined, undefined, nodes.length]}
      onPointerMove={(event) => {
        event.stopPropagation()
        if (typeof event.instanceId === 'number') {
          onHover(event.instanceId)
        }
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        onHover(null)
      }}
      onClick={(event) => {
        event.stopPropagation()
        if (typeof event.instanceId === 'number') {
          const node = nodes[event.instanceId]
          if (node) {
            onSelect(node.id)
          }
        }
      }}
    >
      <sphereGeometry args={[1, 24, 24]}>
        <instancedBufferAttribute attach="attributes-highlight" args={[new Float32Array(nodes.length), 1]} />
        <instancedBufferAttribute attach="attributes-phase" args={[new Float32Array(nodes.length), 1]} />
      </sphereGeometry>
      {/* @ts-expect-error - nodeGlowMaterial is registered via extend */}
      <nodeGlowMaterial ref={materialRef} transparent={false} depthWrite />
    </instancedMesh>
  )
}

function EdgeSystem({
  nodes,
  edges,
  highlightedNodeIds,
  hoveredNodeId
}: {
  nodes: PositionedNode[]
  edges: PositionedEdge[]
  highlightedNodeIds: string[]
  hoveredNodeId: string | null
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const materialRef = useRef<EdgeTrailMaterialImpl | null>(null)

  const highlightSet = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds])

  useEffect(() => {
    if (!meshRef.current) return

    const tempObject = new THREE.Object3D()
    const up = new THREE.Vector3(0, 1, 0)

    edges.forEach((edge, index) => {
      const source = nodes[edge.sourceIndex]
      const target = nodes[edge.targetIndex]
      if (!source || !target) return

      const start = new THREE.Vector3(...source.position)
      const end = new THREE.Vector3(...target.position)
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
      const direction = new THREE.Vector3().subVectors(end, start)
      const length = Math.max(direction.length(), 0.001)
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction.clone().normalize())

      tempObject.position.copy(mid)
      tempObject.quaternion.copy(quaternion)
      tempObject.scale.set(0.12, length, 0.12)
      tempObject.updateMatrix()
      meshRef.current!.setMatrixAt(index, tempObject.matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true

    const phaseAttribute = new THREE.InstancedBufferAttribute(new Float32Array(edges.length), 1)
    edges.forEach((edge, index) => {
      phaseAttribute.setX(index, edge.phase)
    })
    phaseAttribute.needsUpdate = true
    meshRef.current.geometry.setAttribute('phase', phaseAttribute)
  }, [edges, nodes])

  useEffect(() => {
    if (!meshRef.current) return
    const attribute =
      (meshRef.current.geometry.getAttribute('highlight') as THREE.InstancedBufferAttribute | undefined) ??
      new THREE.InstancedBufferAttribute(new Float32Array(edges.length), 1)

    edges.forEach((edge, index) => {
      let value = 0
      if (highlightSet.has(edge.source) || highlightSet.has(edge.target)) {
        value = 1
      }
      if (hoveredNodeId && (edge.source === hoveredNodeId || edge.target === hoveredNodeId)) {
        value = 2
      }
      attribute.setX(index, value)
    })

    meshRef.current.geometry.setAttribute('highlight', attribute)
    attribute.needsUpdate = true
  }, [edges, highlightSet, highlightedNodeIds, hoveredNodeId])

  useFrame(({ clock }) => {
    if (!materialRef.current) return
    materialRef.current.uniforms.time.value = clock.getElapsedTime()
  })

  if (edges.length === 0) {
    return null
  }

  return (
    <instancedMesh
      key={edges.length}
      ref={meshRef}
      args={[undefined, undefined, edges.length]}
      frustumCulled={false}
    >
      <cylinderGeometry args={[0.5, 0.5, 1, 8, 1, true]}>
        <instancedBufferAttribute attach="attributes-highlight" args={[new Float32Array(edges.length), 1]} />
        <instancedBufferAttribute attach="attributes-phase" args={[new Float32Array(edges.length), 1]} />
      </cylinderGeometry>
      {/* @ts-expect-error - edgeTrailMaterial is registered via extend */}
      <edgeTrailMaterial ref={materialRef} transparent depthWrite={false} />
    </instancedMesh>
  )
}

export function GameViewport({ onNodeClick, highlightedNodes = [] }: Props) {
  const [graph, setGraph] = useState<PositionedGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const data = await getGraphData()
        if (!mounted) return
        setGraph(createPositionedGraph(data))
      } catch (error) {
        console.error('Failed to load graph data', error)
        if (mounted) {
          setGraph({ nodes: [], edges: [] })
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const hoveredNodeId = useMemo(() => {
    if (!graph || hoveredIndex === null) return null
    return graph.nodes[hoveredIndex]?.id ?? null
  }, [graph, hoveredIndex])

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        background: 'radial-gradient(circle at top, #111733, #02030f)',
        overflow: 'hidden'
      }}
    >
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.72)',
            letterSpacing: '0.08em',
            fontSize: '0.9rem',
            zIndex: 2
          }}
        >
          Loading galaxy...
        </div>
      )}

      {graph && (
        <Canvas
          frameloop="always"
          dpr={[1, 2]}
          shadows
          camera={{ position: [0, 0, 65], fov: 50 }}
        >
          <Suspense fallback={null}>
            <color attach="background" args={['#02030f']} />
            <fog attach="fog" args={[new THREE.Color('#02030f'), 60, 180]} />
            <ambientLight intensity={0.6} color={new THREE.Color('#3f4a88')} />
            <pointLight position={[30, 40, 20]} intensity={1.4} color="#6287ff" />
            <pointLight position={[-25, -30, -10]} intensity={0.5} color="#ff7b54" />

            <EdgeSystem
              nodes={graph.nodes}
              edges={graph.edges}
              highlightedNodeIds={highlightedNodes}
              hoveredNodeId={hoveredNodeId}
            />
            <NodeSystem
              nodes={graph.nodes}
              highlightedNodeIds={highlightedNodes}
              hoveredIndex={hoveredIndex}
              onHover={setHoveredIndex}
              onSelect={onNodeClick}
            />

            <OrbitControls
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
