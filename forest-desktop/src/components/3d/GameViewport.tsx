import { Suspense, useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { Canvas, extend, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useUI } from '../../store/ui'
import { useTheme } from '../../store/theme'
import { useGraph } from '../../queries/forest'
import { NodeGlowMaterial, EdgeTrailMaterial } from './materials'
import { NodeSystem } from './NodeSystem'
import { EdgeSystem } from './EdgeSystem'
import { createPositionedGraph } from './layout'
import type { BoundingBox } from './types'

extend({ NodeGlowMaterial, EdgeTrailMaterial })

interface Props {
  onNodeClick: (nodeId: string) => void
  selectedNodeId: string | null
}

/**
 * Keyboard controls for WASD camera movement
 */
function KeyboardControls({
  bounds,
  orbitRef,
  focusTarget,
  speedMultiplier,
}: {
  bounds: BoundingBox
  orbitRef: React.RefObject<any>
  focusTarget: THREE.Vector3 | null
  speedMultiplier: number
}) {
  const { camera } = useThree()
  const keysPressed = useRef(new Set<string>())
  const velocity = useRef(new THREE.Vector3())
  const focusState = useRef<{
    target: THREE.Vector3 | null
    start: THREE.Vector3
    dest: THREE.Vector3
    progress: number
  }>({
    target: null,
    start: new THREE.Vector3(),
    dest: new THREE.Vector3(),
    progress: 0,
  })

  // Smooth easing for camera focus
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()

      // Focus entire graph on 'F' key
      if (key === 'f') {
        e.preventDefault()
        const distance = bounds.radius / Math.tan((50 * Math.PI) / 180 / 2) * 1.5
        camera.position.set(
          bounds.center[0],
          bounds.center[1],
          bounds.center[2] + distance
        )
        camera.lookAt(bounds.center[0], bounds.center[1], bounds.center[2])
        console.log('[KeyboardControls] Focused on graph center')
        return
      }

      // Track WASD/QE keys
      if (['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(key)) {
        keysPressed.current.add(key)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysPressed.current.delete(key)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [camera, bounds])

  // Apply movement on each frame
  useFrame(({ clock }, delta) => {
    const dt = typeof delta === 'number' ? delta : clock.getDelta()
    const baseSpeed = 12 * speedMultiplier
    const speed = keysPressed.current.has('shift') ? baseSpeed * 2.5 : baseSpeed
    const targetVelocity = new THREE.Vector3()

    // Calculate camera's forward and right vectors in world space (Y locked)
    const forward = new THREE.Vector3()
    const right = new THREE.Vector3()

    camera.getWorldDirection(forward)
    forward.y = 0 // Keep movement on XZ plane
    forward.normalize()

    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    // WASD movement (translate in world space, not camera local space)
    if (keysPressed.current.has('w')) {
      targetVelocity.addScaledVector(forward, speed)
    }
    if (keysPressed.current.has('s')) {
      targetVelocity.addScaledVector(forward, -speed)
    }
    if (keysPressed.current.has('a')) {
      targetVelocity.addScaledVector(right, -speed)
    }
    if (keysPressed.current.has('d')) {
      targetVelocity.addScaledVector(right, speed)
    }
    if (keysPressed.current.has('q')) {
      targetVelocity.y -= speed
    }
    if (keysPressed.current.has('e')) {
      targetVelocity.y += speed
    }

    // Smooth velocity (drift feel)
    velocity.current.lerp(targetVelocity, 1 - Math.exp(-8 * dt))

    // Apply movement and move Orbit target with the camera to preserve heading
    if (!velocity.current.lengthSq()) return
    const step = velocity.current.clone().multiplyScalar(dt)
    camera.position.add(step)
    if (orbitRef.current) {
      orbitRef.current.target.add(step)
    }
  })

  // Handle focus autopilot when selected node changes
  useEffect(() => {
    if (!focusTarget) return
    // Place camera backward from target along current view direction
    const current = camera.position.clone()
    const direction = new THREE.Vector3().subVectors(current, focusTarget).normalize()
    if (direction.lengthSq() === 0) direction.set(0, 0, 1)
    const desiredDistance = Math.max(18, bounds.radius * 0.15)
    const dest = focusTarget.clone().addScaledVector(direction, desiredDistance)

    focusState.current = {
      target: focusTarget.clone(),
      start: current,
      dest,
      progress: 0,
    }
    if (orbitRef.current) {
      orbitRef.current.target.copy(focusTarget)
    }
  }, [focusTarget, camera, orbitRef, bounds.radius])

  useFrame((_, delta) => {
    const state = focusState.current
    if (!state.target) return

    state.progress += delta * 1.8
    const t = Math.min(1, state.progress)
    const eased = easeOutCubic(t)
    camera.position.lerpVectors(state.start, state.dest, eased)
    if (orbitRef.current) {
      orbitRef.current.target.lerp(state.target, 1 - Math.exp(-6 * delta))
    }

    if (t >= 1) {
      state.target = null
    }
  })

  return null
}

/**
 * Helper component to update scene colors based on theme
 */
function SceneTheme({ theme }: { theme: 'light' | 'dark' }) {
  const { scene } = useThree()

  useEffect(() => {
    // Update background and fog colors
    const bgColor = theme === 'dark' ? '#002b36' : '#fdf6e3'
    const fogColor = theme === 'dark' ? '#073642' : '#eee8d5'

    scene.background = new THREE.Color(bgColor)
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color = new THREE.Color(fogColor)
    }
  }, [theme, scene])

  return null
}

export function GameViewport({ onNodeClick, selectedNodeId }: Props) {
  const { data: graphData, isLoading } = useGraph()
  const highlightedNodeIds = useUI((s) => s.highlightedNodeIds)
  const effectiveTheme = useTheme((s) => s.effectiveTheme)
  const [filterQuery, setFilterQuery] = useState('')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [showControls, setShowControls] = useState(true)
  const [speedMultiplier, setSpeedMultiplier] = useState(1.1)

  const cursorPosRef = useRef({ x: 0, y: 0 })
  const tooltipRef = useRef<HTMLDivElement>(null)
  const cameraStateRef = useRef<{ position: [number, number, number]; target: [number, number, number] } | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const orbitRef = useRef<any>(null)

  // Hide controls overlay after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowControls(false), 8000)
    return () => clearTimeout(timer)
  }, [])

  // Restore camera position from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('forest-graph-camera-state')
      if (saved) {
        const parsed = JSON.parse(saved)
        const age = Date.now() - parsed.timestamp
        const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days

        if (age < maxAge) {
          cameraStateRef.current = {
            position: parsed.position,
            target: parsed.target
          }
          console.log('[Camera] Restored saved position:', parsed.position)
        } else {
          console.log('[Camera] Saved position expired, using auto-frame')
        }
      }
    } catch (e) {
      console.warn('[Camera] Failed to restore saved position:', e)
    }
  }, [])

  // Debounced save camera state to localStorage
  const saveCameraState = useCallback((position: [number, number, number], target: [number, number, number]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        const state = {
          position,
          target,
          timestamp: Date.now()
        }
        localStorage.setItem('forest-graph-camera-state', JSON.stringify(state))
        console.log('[Camera] Saved position')
      } catch (e) {
        console.warn('[Camera] Failed to save position:', e)
      }
    }, 500)
  }, [])

  const graph = useMemo(() => {
    if (!graphData) {
      console.log('[GameViewport] No graph data available')
      return null
    }
    console.log('[GameViewport] Creating positioned graph:', {
      nodeCount: graphData.nodes.length,
      edgeCount: graphData.edges.length,
      isLoading
    })
    return createPositionedGraph(graphData)
  }, [graphData, isLoading])

  // Calculate optimal camera position based on graph bounds
  const cameraConfig = useMemo(() => {
    if (!graph) {
      return { position: [0, 0, 65] as [number, number, number], fov: 50, near: 0.1, far: 10000 }
    }

    const { bounds } = graph
    const fov = 50
    const aspect = window.innerWidth / window.innerHeight

    // Calculate distance needed to fit entire graph in view
    // Using FOV and bounding sphere radius
    const fovRad = (fov * Math.PI) / 180
    const distance = bounds.radius / Math.tan(fovRad / 2) * 1.5 // 1.5x for padding

    // Use saved camera position if available, otherwise auto-frame
    const cameraPos: [number, number, number] = cameraStateRef.current?.position ?? [
      bounds.center[0],
      bounds.center[1],
      bounds.center[2] + distance
    ]

    // Set near/far planes based on graph size
    const near = Math.max(0.1, distance / 100)
    const far = distance * 3

    console.log('[GameViewport] Camera config:', {
      bounds: { center: bounds.center, radius: bounds.radius.toFixed(1) },
      distance: distance.toFixed(1),
      position: cameraPos.map(v => v.toFixed(1)),
      near: near.toFixed(2),
      far: far.toFixed(1),
      restored: !!cameraStateRef.current
    })

    return {
      position: cameraPos,
      target: cameraStateRef.current?.target ?? bounds.center,
      fov,
      near,
      far
    }
  }, [graph])

  const hoveredNodeId = useMemo(() => {
    if (!graph || hoveredIndex === null) return null
    return graph.nodes[hoveredIndex]?.id ?? null
  }, [graph, hoveredIndex])

  const hoveredNode = useMemo(() => {
    if (!graph || hoveredIndex === null) return null
    return graph.nodes[hoveredIndex] ?? null
  }, [graph, hoveredIndex])

  // Compute neighbors of the currently selected node to spotlight its local cluster
  const selectionNeighbors = useMemo(() => {
    if (!graph || !selectedNodeId) return new Set<string>()
    const set = new Set<string>([selectedNodeId])
    graph.edges.forEach((edge) => {
      if (edge.source === selectedNodeId) set.add(edge.target)
      if (edge.target === selectedNodeId) set.add(edge.source)
    })
    return set
  }, [graph, selectedNodeId])

  // Combine app-level highlights with selection cluster
  const combinedHighlights = useMemo(() => {
    const all = new Set<string>()
    highlightedNodeIds.forEach((id) => all.add(id))
    selectionNeighbors.forEach((id) => all.add(id))
    return Array.from(all)
  }, [highlightedNodeIds, selectionNeighbors])

  // Filter nodes by title/tags (space-friendly substring match)
  const filteredNodeIds = useMemo(() => {
    if (!graph || !filterQuery.trim()) return null
    const needle = filterQuery.toLowerCase()
    const set = new Set<string>()
    graph.nodes.forEach((node) => {
      const inTitle = node.title.toLowerCase().includes(needle)
      const inTags = (node.tags || []).some((tag) => tag.toLowerCase().includes(needle))
      if (inTitle || inTags) {
        set.add(node.id)
      }
    })
    return set
  }, [graph, filterQuery])

  // Focus target for camera autopilot (selected node)
  const focusTarget = useMemo(() => {
    if (!graph || !selectedNodeId) return null
    const node = graph.nodes.find((n) => n.id === selectedNodeId)
    if (!node) return null
    return new THREE.Vector3(...node.position)
  }, [graph, selectedNodeId])

  // Define colors based on theme
  const bgColor = effectiveTheme === 'dark' ? '#002b36' : '#fdf6e3'
  const textColor = effectiveTheme === 'dark' ? '#839496' : '#586e75'
  const tooltipBg = effectiveTheme === 'dark' ? '#073642' : '#eee8d5'
  const tooltipText = effectiveTheme === 'dark' ? '#93a1a1' : '#073642'
  const tooltipBorder = effectiveTheme === 'dark' ? '#586e75' : '#93a1a1'
  const fogColor = effectiveTheme === 'dark' ? '#073642' : '#eee8d5'
  const ambientColor = effectiveTheme === 'dark' ? '#073642' : '#fdf6e3'

  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: bgColor }}
      onMouseMove={(e) => {
        cursorPosRef.current = { x: e.clientX, y: e.clientY }
        if (tooltipRef.current) {
          tooltipRef.current.style.left = `${e.clientX + 15}px`
          tooltipRef.current.style.top = `${e.clientY + 15}px`
        }
      }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-[2] tracking-wider text-sm" style={{ color: textColor }}>
          Loading galaxy...
        </div>
      )}

      {/* Controls hint overlay */}
      {showControls && graph && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[10] px-4 py-3 text-sm font-medium border rounded-lg shadow-lg backdrop-blur-sm"
          style={{
            backgroundColor: effectiveTheme === 'dark' ? 'rgba(0, 43, 54, 0.9)' : 'rgba(253, 246, 227, 0.9)',
            color: textColor,
            borderColor: tooltipBorder
          }}
        >
          <div className="flex gap-6 items-center">
            <span className="font-semibold">Controls:</span>
            <span><kbd className="px-1.5 py-0.5 bg-opacity-20 bg-black dark:bg-white rounded text-xs">W/A/S/D</kbd> Move</span>
            <span><kbd className="px-1.5 py-0.5 bg-opacity-20 bg-black dark:bg-white rounded text-xs">Q/E</kbd> Up/Down</span>
            <span><kbd className="px-1.5 py-0.5 bg-opacity-20 bg-black dark:bg-white rounded text-xs">Shift</kbd> Speed Boost</span>
            <span><kbd className="px-1.5 py-0.5 bg-opacity-20 bg-black dark:bg-white rounded text-xs">F</kbd> Focus All</span>
            <button
              onClick={() => setShowControls(false)}
              className="ml-2 opacity-50 hover:opacity-100"
              style={{ color: textColor }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Node title tooltip */}
      {hoveredNode && (
        <div
          ref={tooltipRef}
          className="absolute z-[10] pointer-events-none px-3 py-2 text-sm font-medium border max-w-[300px]"
          style={{
            backgroundColor: tooltipBg,
            color: tooltipText,
            borderColor: tooltipBorder,
            left: `${cursorPosRef.current.x + 15}px`,
            top: `${cursorPosRef.current.y + 15}px`
          }}
        >
          {hoveredNode.title}
        </div>
      )}

      {/* Flight HUD */}
      <div
        className="absolute bottom-6 left-6 z-[10] flex flex-col gap-2 px-4 py-3 border rounded-lg shadow-lg backdrop-blur-sm"
        style={{
          backgroundColor: effectiveTheme === 'dark' ? 'rgba(0, 43, 54, 0.82)' : 'rgba(253, 246, 227, 0.82)',
          color: textColor,
          borderColor: tooltipBorder
        }}
      >
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="font-semibold">Flight HUD</div>
          <div className="flex items-center gap-2 text-xs">
            <span>Speed</span>
            <input
              type="range"
              min={0.6}
              max={2}
              step={0.1}
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
              className="w-24 accent-[var(--accent-primary)]"
            />
            <span className="tabular-nums">{speedMultiplier.toFixed(1)}x</span>
          </div>
        </div>
        <div className="flex gap-2 items-center text-xs">
          <span className="font-medium">Filter</span>
          <input
            className="px-2 py-1 text-xs border rounded bg-[var(--bg-base)]"
            value={filterQuery}
            placeholder="Title/tag…"
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="text-xs px-2 py-1 border rounded hover:bg-[var(--bg-surface)]"
            >
              Clear
            </button>
          )}
        </div>
        <div className="text-[11px] text-[var(--text-secondary)] flex gap-3 flex-wrap">
          <span><kbd className="px-1 py-0.5 border rounded">WASD</kbd> move</span>
          <span><kbd className="px-1 py-0.5 border rounded">Q/E</kbd> ascend/descend</span>
          <span><kbd className="px-1 py-0.5 border rounded">Shift</kbd> boost</span>
          <span><kbd className="px-1 py-0.5 border rounded">F</kbd> frame graph</span>
          <span><kbd className="px-1 py-0.5 border rounded">Drag</kbd> rotate</span>
        </div>
      </div>

      {/* Center reticle for spatial context */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[5]">
        <div className="w-3 h-3 border border-[var(--border)] rounded-full opacity-60"></div>
      </div>

      {graph && (
        <Canvas
          frameloop="always"
          dpr={[1, 2]}
          shadows
          camera={{
            position: cameraConfig.position,
            fov: cameraConfig.fov,
            near: cameraConfig.near,
            far: cameraConfig.far
          }}
          onCreated={({ camera }) => {
            // Look at the configured target (saved or graph center)
            const target = cameraConfig.target
            camera.lookAt(target[0], target[1], target[2])
          }}
        >
          <Suspense fallback={null}>
            <KeyboardControls
              bounds={graph.bounds}
              orbitRef={orbitRef}
              focusTarget={focusTarget}
              speedMultiplier={speedMultiplier}
            />
            <SceneTheme theme={effectiveTheme} />
            <fog attach="fog" args={[new THREE.Color(fogColor), graph.bounds.radius * 0.8, graph.bounds.radius * 2.5]} />
            <ambientLight intensity={0.6} color={new THREE.Color(ambientColor)} />
            <pointLight position={[30, 40, 20]} intensity={1.4} color="#268bd2" />
            <pointLight position={[-25, -30, -10]} intensity={0.5} color="#cb4b16" />

            <EdgeSystem
              nodes={graph.nodes}
              edges={graph.edges}
              highlightedNodeIds={combinedHighlights}
              hoveredNodeId={hoveredNodeId}
              filteredNodeIds={filteredNodeIds}
            />
            <NodeSystem
              nodes={graph.nodes}
              highlightedNodeIds={combinedHighlights}
              filteredNodeIds={filteredNodeIds}
              hoveredIndex={hoveredIndex}
              onHover={setHoveredIndex}
              onSelect={onNodeClick}
            />

            <OrbitControls
              ref={orbitRef}
              target={cameraConfig.target}
              enablePan={false}
              enableDamping
              dampingFactor={0.08}
              maxDistance={graph.bounds.radius * 5}
              minDistance={5}
              onChange={(e) => {
                if (e?.target) {
                  const controls = e.target as any
                  const camera = controls.object
                  const target = controls.target
                  saveCameraState(
                    [camera.position.x, camera.position.y, camera.position.z],
                    [target.x, target.y, target.z]
                  )
                }
              }}
            />
          </Suspense>
        </Canvas>
      )}
    </div>
  )
}
