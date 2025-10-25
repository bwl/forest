import { useEffect, useMemo, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface GraphNode {
  id: string
  title: string
  tags: string[]
  position_x: number | null
  position_y: number | null
  connection_count: number
}

interface GraphEdge {
  id: string
  source: string
  target: string
  score: number
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

interface SceneProps {
  highlightedNodes: string[]
}

interface PreparedNode {
  id: string
  x: number
  y: number
  z: number
  size: number
  intensity: number
  highlight: number
}

interface WebGLState {
  gl: WebGL2RenderingContext | null
  program: WebGLProgram | null
  buffer: WebGLBuffer | null
  uniformLocations: {
    resolution: WebGLUniformLocation | null
    time: WebGLUniformLocation | null
  }
  count: number
  pendingUpload: boolean
}

interface FrameMetricsDetail {
  frameMs: number
  fps: number
  updateCostMs: number
}

const FRAME_EVENT = 'forest-frame-metrics'
const BUFFER_ITEM_SIZE = 7 // x, y, z, size, intensity, highlight, padding
const FLOAT_BYTES = 4
const CLIP_MARGIN = 1.05

function dispatchMetrics(detail: FrameMetricsDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<FrameMetricsDetail>(FRAME_EVENT, { detail }))
}

function hashToUnit(id: string, offset = 0): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  const shifted = (hash + offset * 374761393) >>> 0
  return (shifted % 10000) / 10000
}

function compileShader(gl: WebGL2RenderingContext, source: string, type: number) {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error('Failed to create shader')
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile failed: ${log ?? 'unknown error'}`)
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string) {
  const program = gl.createProgram()
  if (!program) {
    throw new Error('Failed to create program')
  }
  const vertexShader = compileShader(gl, vertex, gl.VERTEX_SHADER)
  const fragmentShader = compileShader(gl, fragment, gl.FRAGMENT_SHADER)
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    throw new Error(`Program link failed: ${log ?? 'unknown error'}`)
  }
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)
  return program
}

const VERTEX_SHADER = `#version 300 es\nprecision highp float;\nlayout(location = 0) in vec3 a_position;\nlayout(location = 1) in float a_size;\nlayout(location = 2) in float a_intensity;\nlayout(location = 3) in float a_highlight;\nuniform vec2 u_resolution;\nuniform float u_time;\nout float v_intensity;\nout float v_highlight;\nvoid main() {\n  vec3 position = a_position;\n  position.x *= u_resolution.y / u_resolution.x;\n  float parallax = sin(u_time * 0.3 + position.z * 4.0) * 0.02;\n  position.y += parallax;\n  gl_Position = vec4(position, 1.0);\n  float highlightBoost = mix(1.0, 1.6, a_highlight);\n  gl_PointSize = a_size * highlightBoost;\n  v_intensity = a_intensity;\n  v_highlight = a_highlight;\n}\n`

const FRAGMENT_SHADER = `#version 300 es\nprecision highp float;\nin float v_intensity;\nin float v_highlight;\nout vec4 outColor;\nvoid main() {\n  vec2 uv = gl_PointCoord * 2.0 - 1.0;\n  float dist = length(uv);\n  if (dist > 1.0) {\n    discard;\n  }\n  float alpha = smoothstep(1.0, 0.0, dist);\n  float rim = pow(1.0 - dist, 4.0);\n  vec3 base = mix(vec3(0.2, 0.84, 0.66), vec3(1.0, 0.58, 0.18), v_highlight);\n  float intensity = mix(0.55, 1.1, v_intensity);\n  vec3 color = base * intensity;\n  float glow = mix(0.15, 0.35, v_highlight) * rim;\n  outColor = vec4(color + glow, alpha * mix(0.45, 0.85, v_highlight));\n}\n`

function prepareNodes(rawNodes: GraphNode[], highlighted: Set<string>): PreparedNode[] {
  if (rawNodes.length === 0) return []

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY
  let maxConnections = 1

  const seededNodes = rawNodes.map((node) => {
    maxConnections = Math.max(maxConnections, node.connection_count || 1)
    const seedX = hashToUnit(node.id)
    const seedY = hashToUnit(node.id, 1)
    const seedZ = hashToUnit(node.id, 2)
    const x = (node.position_x ?? (seedX - 0.5) * 600)
    const y = (node.position_y ?? (seedY - 0.5) * 600)
    const z = (seedZ - 0.5) * 320
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
    return {
      id: node.id,
      x,
      y,
      z,
      size: 6 + Math.min(18, node.connection_count * 0.35),
      intensity: 0,
      highlight: highlighted.has(node.id) ? 1 : 0,
      connectionCount: node.connection_count,
    }
  })

  const rangeX = Math.max(maxX - minX, 1)
  const rangeY = Math.max(maxY - minY, 1)
  const rangeZ = Math.max(maxZ - minZ, 1)
  const centerX = (maxX + minX) / 2
  const centerY = (maxY + minY) / 2
  const centerZ = (maxZ + minZ) / 2

  return seededNodes.map((node) => {
    const normalizedX = ((node.x - centerX) / rangeX) * 2
    const normalizedY = ((node.y - centerY) / rangeY) * 2
    const normalizedZ = ((node.z - centerZ) / rangeZ) * 2
    const intensity = Math.min(1, node.connectionCount / maxConnections)
    return {
      id: node.id,
      x: normalizedX,
      y: normalizedY,
      z: normalizedZ,
      size: node.size,
      intensity,
      highlight: node.highlight,
    }
  })
}

function createBufferData(nodes: PreparedNode[]) {
  const filtered: PreparedNode[] = []
  for (const node of nodes) {
    if (
      node.x < -CLIP_MARGIN ||
      node.x > CLIP_MARGIN ||
      node.y < -CLIP_MARGIN ||
      node.y > CLIP_MARGIN ||
      node.z < -CLIP_MARGIN ||
      node.z > CLIP_MARGIN
    ) {
      continue
    }
    filtered.push(node)
  }

  const data = new Float32Array(filtered.length * BUFFER_ITEM_SIZE)
  for (let i = 0; i < filtered.length; i += 1) {
    const baseIndex = i * BUFFER_ITEM_SIZE
    const node = filtered[i]!
    data[baseIndex] = node.x
    data[baseIndex + 1] = node.y
    data[baseIndex + 2] = node.z
    data[baseIndex + 3] = node.size
    data[baseIndex + 4] = node.intensity
    data[baseIndex + 5] = node.highlight
    data[baseIndex + 6] = 0 // padding for alignment
  }

  return { data, count: filtered.length }
}

export function WebGLScene({ highlightedNodes }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef<WebGLState>({
    gl: null,
    program: null,
    buffer: null,
    uniformLocations: {
      resolution: null,
      time: null,
    },
    count: 0,
    pendingUpload: false,
  })
  const allNodesRef = useRef<PreparedNode[]>([])
  const highlightedSet = useMemo(() => new Set(highlightedNodes), [highlightedNodes])
  const updateCostRef = useRef(0)

  useEffect(() => {
    if (allNodesRef.current.length === 0) return
    allNodesRef.current = allNodesRef.current.map((node: PreparedNode) => ({
      ...node,
      highlight: highlightedSet.has(node.id) ? 1 : 0,
    }))
    stateRef.current.pendingUpload = true
  }, [highlightedSet])

  useEffect(() => {
    let frameId = 0
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    })

    if (!gl) {
      console.warn('WebGL2 context not available; skipping scene rendering')
      return
    }

    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.clearColor(0, 0, 0, 0)

    const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)
    gl.useProgram(program)
    const buffer = gl.createBuffer()
    if (!buffer) {
      throw new Error('Failed to create buffer')
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)

    const stride = BUFFER_ITEM_SIZE * FLOAT_BYTES
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, stride, 3 * FLOAT_BYTES)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 4 * FLOAT_BYTES)
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 5 * FLOAT_BYTES)

    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution')
    const timeLocation = gl.getUniformLocation(program, 'u_time')

    stateRef.current = {
      gl,
      program,
      buffer,
      uniformLocations: {
        resolution: resolutionLocation,
        time: timeLocation,
      },
      count: 0,
      pendingUpload: true,
    }

    function resizeCanvas() {
      const displayWidth = canvas.clientWidth * window.devicePixelRatio
      const displayHeight = canvas.clientHeight * window.devicePixelRatio
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth
        canvas.height = displayHeight
        gl.viewport(0, 0, displayWidth, displayHeight)
        if (stateRef.current.uniformLocations.resolution) {
          gl.uniform2f(
            stateRef.current.uniformLocations.resolution,
            displayWidth,
            displayHeight
          )
        }
      }
    }

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        resizeCanvas()
        stateRef.current.pendingUpload = true
      })
      resizeObserver.observe(canvas)
    } else {
      window.addEventListener('resize', resizeCanvas)
    }
    resizeCanvas()

    let lastTime = performance.now()

    const render = (now: number) => {
      frameId = requestAnimationFrame(render)
      const frameDelta = now - lastTime
      lastTime = now

      const state = stateRef.current
      if (!state.gl || !state.program) return

      if (state.pendingUpload) {
        const start = performance.now()
        const { data, count } = createBufferData(allNodesRef.current)
        state.count = count
        state.gl.bindBuffer(state.gl.ARRAY_BUFFER, state.buffer)
        state.gl.bufferData(state.gl.ARRAY_BUFFER, data, state.gl.DYNAMIC_DRAW)
        state.pendingUpload = false
        updateCostRef.current = performance.now() - start
      }

      if (state.uniformLocations.time) {
        state.gl.uniform1f(state.uniformLocations.time, now / 1000)
      }

      state.gl.clear(state.gl.COLOR_BUFFER_BIT | state.gl.DEPTH_BUFFER_BIT)
      if (state.count > 0) {
        state.gl.drawArrays(state.gl.POINTS, 0, state.count)
      }

      dispatchMetrics({
        frameMs: frameDelta,
        fps: frameDelta > 0 ? 1000 / frameDelta : 0,
        updateCostMs: updateCostRef.current,
      })
      updateCostRef.current = 0
    }

    frameId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frameId)
      if (resizeObserver) {
        resizeObserver.disconnect()
      } else {
        window.removeEventListener('resize', resizeCanvas)
      }
      if (stateRef.current.gl) {
        stateRef.current.gl.bindBuffer(gl.ARRAY_BUFFER, null)
      }
      if (stateRef.current.buffer) {
        gl.deleteBuffer(stateRef.current.buffer)
      }
      if (stateRef.current.program) {
        gl.deleteProgram(stateRef.current.program)
      }
      stateRef.current = {
        gl: null,
        program: null,
        buffer: null,
        uniformLocations: { resolution: null, time: null },
        count: 0,
        pendingUpload: false,
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await invoke<GraphData>('get_graph_data')
        if (cancelled) return
        const prepared = prepareNodes(data.nodes, highlightedSet)
        allNodesRef.current = prepared
        stateRef.current.pendingUpload = true
      } catch (error) {
        console.error('Failed to load graph for WebGL scene:', error)
      }
    }
    load()
    const interval = window.setInterval(load, 10_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
    // we intentionally rely on the mutable highlightedSet reference for color updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={canvasRef} className="webgl-scene" aria-hidden />
}

export type { FrameMetricsDetail }
export { FRAME_EVENT }
