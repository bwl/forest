import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { type PositionedNode } from './types'
import { type NodeGlowMaterialImpl } from './materials'

interface Props {
  nodes: PositionedNode[]
  highlightedNodeIds: string[]
  hoveredIndex: number | null
  onHover: (index: number | null) => void
  onSelect: (nodeId: string) => void
}

export function NodeSystem({ nodes, highlightedNodeIds, hoveredIndex, onHover, onSelect }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const materialRef = useRef<NodeGlowMaterialImpl | null>(null)
  const tempObject = useRef(new THREE.Object3D())
  const needsUpdate = useRef(true)

  const highlightSet = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds])

  // Debug logging for node rendering
  useEffect(() => {
    console.log('[NodeSystem] Rendering nodes:', {
      count: nodes.length,
      highlighted: highlightedNodeIds.length,
      hovered: hoveredIndex
    })
  }, [nodes.length, highlightedNodeIds.length, hoveredIndex])

  // Single unified render loop - prevents attribute update races and flickering
  useFrame(({ clock }) => {
    if (!meshRef.current) return

    // Update material time uniform
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime()
    }

    // Only update instance data when needed (nodes change, highlight changes, hover changes)
    if (needsUpdate.current) {
      const temp = tempObject.current

      // Update instance matrices and phase attribute
      nodes.forEach((node, index) => {
        temp.position.set(...node.position)
        temp.scale.setScalar(node.size)
        temp.rotation.set(0, 0, 0)
        temp.updateMatrix()
        meshRef.current!.setMatrixAt(index, temp.matrix)
      })
      meshRef.current.instanceMatrix.needsUpdate = true

      // Update/create phase attribute
      let phaseAttr = meshRef.current.geometry.getAttribute('phase') as THREE.InstancedBufferAttribute | undefined
      if (!phaseAttr || phaseAttr.count !== nodes.length) {
        phaseAttr = new THREE.InstancedBufferAttribute(new Float32Array(nodes.length), 1)
        meshRef.current.geometry.setAttribute('phase', phaseAttr)
      }
      nodes.forEach((node, index) => {
        phaseAttr!.setX(index, node.phase)
      })
      phaseAttr.needsUpdate = true

      // Update/create highlight attribute
      let highlightAttr = meshRef.current.geometry.getAttribute('highlight') as THREE.InstancedBufferAttribute | undefined
      if (!highlightAttr || highlightAttr.count !== nodes.length) {
        highlightAttr = new THREE.InstancedBufferAttribute(new Float32Array(nodes.length), 1)
        meshRef.current.geometry.setAttribute('highlight', highlightAttr)
      }
      nodes.forEach((node, index) => {
        let value = highlightSet.has(node.id) ? 1 : 0
        if (hoveredIndex === index) {
          value = 2
        }
        highlightAttr!.setX(index, value)
      })
      highlightAttr.needsUpdate = true

      // Update/create color attribute (RGB)
      let colorAttr = meshRef.current.geometry.getAttribute('nodeColor') as THREE.InstancedBufferAttribute | undefined
      if (!colorAttr || colorAttr.count !== nodes.length) {
        colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(nodes.length * 3), 3)
        meshRef.current.geometry.setAttribute('nodeColor', colorAttr)
      }
      nodes.forEach((node, index) => {
        // Parse HSL color string to THREE.Color
        const color = new THREE.Color(node.color)
        colorAttr!.setXYZ(index, color.r, color.g, color.b)
      })
      colorAttr.needsUpdate = true

      needsUpdate.current = false
    }
  })

  // Mark for update when dependencies change
  // Fixed: useMemo is for caching values, not side effects! Use useEffect instead.
  useEffect(() => {
    needsUpdate.current = true
  }, [nodes, highlightSet, hoveredIndex])

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
