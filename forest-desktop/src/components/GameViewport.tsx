import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Leva, useControls } from 'leva'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  useSceneEffect,
  useSceneMode,
  useSceneValue,
  type SceneEffect,
} from '../lib/sceneState'

const backgroundColor = new THREE.Color('#020617')

interface SceneContentsProps {
  introProgress: number
}

export function GameViewport() {
  const introProgress = useSceneValue((state) => state.context.introProgress)
  const mode = useSceneMode()
  const { fogNear, fogFar } = useControls('World Fog', {
    fogNear: { value: 8, min: 1, max: 40, step: 1 },
    fogFar: { value: 48, min: 20, max: 120, step: 1 },
  })

  const fogArgs = useMemo(() => [backgroundColor.clone(), fogNear, fogFar] as const, [fogNear, fogFar])

  return (
    <div className="viewport-layer" data-mode={mode} aria-hidden>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 4, 10], fov: 55, near: 0.1, far: 100 }}
        style={{ pointerEvents: 'none' }}
      >
        <color attach="background" args={[backgroundColor]} />
        <fog attach="fog" args={fogArgs} />
        <SceneContents introProgress={introProgress} />
      </Canvas>
      <Leva collapsed />
    </div>
  )
}

function SceneContents({ introProgress }: SceneContentsProps) {
  const fogPulse = useRef(introProgress)
  fogPulse.current = introProgress
  return (
    <group>
      <CameraRig introPulse={fogPulse} />
      <ForestFloor />
      <NodeEmphasis />
      <RailMarkers />
    </group>
  )
}

function CameraRig({ introPulse }: { introPulse: React.MutableRefObject<number> }) {
  const { scene } = useThree()
  const targetPosition = useRef(new THREE.Vector3(0, 4, 10))
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0))
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0))
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const keyLightRef = useRef<THREE.DirectionalLight>(null)
  const backgroundTarget = useRef(backgroundColor.clone())
  const focusTarget = useRef(0)
  const focusAmount = useRef(0)
  const { railResponse, lightResponse, focusResponse } = useControls('Camera Rails', {
    railResponse: { value: 0.18, min: 0.02, max: 0.6, step: 0.01 },
    lightResponse: { value: 0.2, min: 0.02, max: 0.6, step: 0.01 },
    focusResponse: { value: 4, min: 1, max: 12, step: 0.25 },
  })
  const ambientTarget = useRef(0.4)
  const keyTarget = useRef({ intensity: 0.5, color: new THREE.Color('#1d4ed8') })

  useSceneEffect((effect: SceneEffect) => {
    if (effect.type === 'camera.rail') {
      targetPosition.current.fromArray(effect.target)
      targetLookAt.current.fromArray(effect.lookAt)
    }
    if (effect.type === 'lighting.update') {
      backgroundTarget.current = new THREE.Color(effect.color)
      ambientTarget.current = effect.ambient
      keyTarget.current = {
        intensity: effect.intensity,
        color: new THREE.Color(effect.color),
      }
    }
    if (effect.type === 'node.focus') {
      focusTarget.current = effect.nodeId ? 1 : 0
    }
    if (effect.type === 'timeline.progress' && effect.timeline === 'intro') {
      focusTarget.current = Math.max(focusTarget.current, effect.progress * 0.6)
    }
  })

  useFrame((state, delta) => {
    const smoothing = 1 - Math.pow(1 - railResponse, delta * 60)
    state.camera.position.lerp(targetPosition.current, smoothing)
    currentLookAt.current.lerp(targetLookAt.current, smoothing)
    state.camera.lookAt(currentLookAt.current)

    const ambient = ambientRef.current
    const key = keyLightRef.current
    const lightSmoothing = 1 - Math.pow(1 - lightResponse, delta * 60)

    if (ambient) {
      ambient.intensity = THREE.MathUtils.lerp(
        ambient.intensity,
        ambientTarget.current + introPulse.current * 0.1,
        lightSmoothing,
      )
    }

    if (key) {
      key.intensity = THREE.MathUtils.lerp(
        key.intensity,
        keyTarget.current.intensity + introPulse.current * 0.25,
        lightSmoothing,
      )
      key.color.lerp(keyTarget.current.color, lightSmoothing)
    }

    if (scene.background instanceof THREE.Color) {
      scene.background.lerp(backgroundTarget.current, lightSmoothing)
    }

    focusAmount.current = THREE.MathUtils.damp(
      focusAmount.current,
      focusTarget.current,
      focusResponse,
      delta,
    )

    const desiredFov = 55 - focusAmount.current * 8
    if (Math.abs(state.camera.fov - desiredFov) > 0.01) {
      state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, desiredFov, smoothing)
      state.camera.updateProjectionMatrix()
    }
  })

  return (
    <group>
      <ambientLight ref={ambientRef} intensity={0.4} />
      <directionalLight
        ref={keyLightRef}
        position={[6, 9, 4]}
        intensity={0.5}
        color={new THREE.Color('#1d4ed8')}
        castShadow
      />
    </group>
  )
}

function ForestFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#020617" roughness={1} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.19, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0f172a" roughness={0.95} metalness={0.05} />
      </mesh>
    </group>
  )
}

function NodeEmphasis() {
  const meshRef = useRef<THREE.Mesh>(null)
  const emissiveTarget = useRef(0)
  const emissiveAmount = useRef(0)

  useSceneEffect((effect) => {
    if (effect.type === 'node.focus') {
      emissiveTarget.current = effect.nodeId ? 1 : 0
    }
    if (effect.type === 'timeline.progress' && effect.timeline === 'intro') {
      emissiveTarget.current = Math.max(emissiveTarget.current, effect.progress * 0.75)
    }
  })

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const material = mesh.material as THREE.MeshStandardMaterial
    emissiveAmount.current = THREE.MathUtils.damp(
      emissiveAmount.current,
      emissiveTarget.current,
      5,
      delta,
    )
    const scale = 1 + emissiveAmount.current * 0.4
    mesh.scale.set(scale, scale, scale)
    material.emissiveIntensity = 0.4 + emissiveAmount.current * 1.6
  })

  return (
    <mesh ref={meshRef} position={[0, 1.3, 0]} castShadow>
      <icosahedronGeometry args={[1.1, 2]} />
      <meshStandardMaterial
        color="#38bdf8"
        emissive="#38bdf8"
        metalness={0.25}
        roughness={0.35}
        emissiveIntensity={0.6}
      />
    </mesh>
  )
}

function RailMarkers() {
  const groupRef = useRef<THREE.Group>(null)
  const mode = useSceneMode()
  const wave = useRef(0)

  useSceneEffect((effect) => {
    if (effect.type === 'timeline.progress' && effect.timeline === 'loading') {
      wave.current = effect.progress
    }
  })

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    const rotationSpeed = mode === 'intro' ? 0.6 : 0.25
    group.rotation.y += rotationSpeed * delta
    group.scale.setScalar(0.8 + Math.sin(wave.current * Math.PI) * 0.1)
  })

  return (
    <group ref={groupRef} position={[0, 0.4, 0]}>
      {[...Array(8)].map((_, index) => {
        const angle = (index / 8) * Math.PI * 2
        const radius = 6 + Math.sin(index * 1.3) * 0.8
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <ringGeometry args={[0.18, 0.22, 32]} />
            <meshBasicMaterial color="#1e293b" />
          </mesh>
        )
      })}
    </group>
  )
}
