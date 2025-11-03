import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { type PositionedNode, type PositionedEdge } from './types'
import { type EdgeTrailMaterialImpl } from './materials'

interface Props {
  nodes: PositionedNode[]
  edges: PositionedEdge[]
  highlightedNodeIds: string[]
  hoveredNodeId: string | null
}

export function EdgeSystem({ nodes, edges, highlightedNodeIds, hoveredNodeId }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const materialRef = useRef<EdgeTrailMaterialImpl | null>(null)
  const tempObject = useRef(new THREE.Object3D())
  const up = useRef(new THREE.Vector3(0, 1, 0))
  const needsUpdate = useRef(true)

  const highlightSet = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds])

  // Debug logging for edge rendering
  useEffect(() => {
    console.log('[EdgeSystem] Rendering edges:', {
      count: edges.length,
      nodes: nodes.length,
      highlighted: highlightedNodeIds.length,
      hovered: hoveredNodeId
    })
  }, [edges.length, nodes.length, highlightedNodeIds.length, hoveredNodeId])

  // Single unified render loop - prevents attribute update races and flickering
  useFrame(({ clock }) => {
    if (!meshRef.current) return

    // Update material time uniform
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime()
    }

    // Only update instance data when needed
    if (needsUpdate.current) {
      const temp = tempObject.current
      const upVec = up.current

      // Update instance matrices and phase attribute
      edges.forEach((edge, index) => {
        const source = nodes[edge.sourceIndex]
        const target = nodes[edge.targetIndex]
        if (!source || !target) return

        const start = new THREE.Vector3(...source.position)
        const end = new THREE.Vector3(...target.position)
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
        const direction = new THREE.Vector3().subVectors(end, start)
        const length = Math.max(direction.length(), 0.001)
        const quaternion = new THREE.Quaternion().setFromUnitVectors(upVec, direction.clone().normalize())

        temp.position.copy(mid)
        temp.quaternion.copy(quaternion)
        temp.scale.set(0.12, length, 0.12)
        temp.updateMatrix()
        meshRef.current!.setMatrixAt(index, temp.matrix)
      })
      meshRef.current.instanceMatrix.needsUpdate = true

      // Update/create phase attribute
      let phaseAttr = meshRef.current.geometry.getAttribute('phase') as THREE.InstancedBufferAttribute | undefined
      if (!phaseAttr || phaseAttr.count !== edges.length) {
        phaseAttr = new THREE.InstancedBufferAttribute(new Float32Array(edges.length), 1)
        meshRef.current.geometry.setAttribute('phase', phaseAttr)
      }
      edges.forEach((edge, index) => {
        phaseAttr!.setX(index, edge.phase)
      })
      phaseAttr.needsUpdate = true

      // Update/create highlight attribute
      let highlightAttr = meshRef.current.geometry.getAttribute('highlight') as THREE.InstancedBufferAttribute | undefined
      if (!highlightAttr || highlightAttr.count !== edges.length) {
        highlightAttr = new THREE.InstancedBufferAttribute(new Float32Array(edges.length), 1)
        meshRef.current.geometry.setAttribute('highlight', highlightAttr)
      }
      edges.forEach((edge, index) => {
        let value = 0
        if (highlightSet.has(edge.source) || highlightSet.has(edge.target)) {
          value = 1
        }
        if (hoveredNodeId && (edge.source === hoveredNodeId || edge.target === hoveredNodeId)) {
          value = 2
        }
        highlightAttr!.setX(index, value)
      })
      highlightAttr.needsUpdate = true

      // Update/create opacity attribute based on edge score
      let opacityAttr = meshRef.current.geometry.getAttribute('opacity') as THREE.InstancedBufferAttribute | undefined
      if (!opacityAttr || opacityAttr.count !== edges.length) {
        opacityAttr = new THREE.InstancedBufferAttribute(new Float32Array(edges.length), 1)
        meshRef.current.geometry.setAttribute('opacity', opacityAttr)
      }
      edges.forEach((edge, index) => {
        // Map score (0.25-1.0) to opacity (0.15-1.0)
        // Higher score = more opaque (stronger connection)
        const opacity = Math.max(0.15, Math.min(1.0, 0.15 + (edge.score - 0.25) * 1.13))
        opacityAttr!.setX(index, opacity)
      })
      opacityAttr.needsUpdate = true

      needsUpdate.current = false
    }
  })

  // Mark for update when dependencies change
  // Fixed: useMemo is for caching values, not side effects! Use useEffect instead.
  useEffect(() => {
    needsUpdate.current = true
  }, [nodes, edges, highlightSet, hoveredNodeId])

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
