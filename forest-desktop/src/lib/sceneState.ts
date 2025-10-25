import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { useInterpret, useSelector } from '@xstate/react'
import { assign, createMachine, type InterpreterFrom, type StateFrom } from 'xstate'
import { gsap } from 'gsap'

export type SceneMode = 'loading' | 'intro' | 'explore' | 'focus' | 'command' | 'build'

interface SceneContext {
  activeNode: string | null
  settingsOpen: boolean
  introProgress: number
}

type SceneEvent =
  | { type: 'BOOT_COMPLETE' }
  | { type: 'INTRO_COMPLETE' }
  | { type: 'SKIP_INTRO' }
  | { type: 'ENTER_EXPLORE' }
  | { type: 'ENTER_FOCUS'; nodeId?: string | null }
  | { type: 'EXIT_FOCUS' }
  | { type: 'ENTER_BUILD' }
  | { type: 'OPEN_COMMAND' }
  | { type: 'CLOSE_COMMAND' }
  | { type: 'OPEN_SETTINGS' }
  | { type: 'CLOSE_SETTINGS' }
  | { type: 'RESET' }
  | { type: 'TIMELINE_PROGRESS'; progress: number }

const sceneMachine = createMachine<SceneContext, SceneEvent>(
  {
    id: 'scene-state',
    predictableActionArguments: true,
    initial: 'loading',
    context: {
      activeNode: null,
      settingsOpen: false,
      introProgress: 0,
    },
    states: {
      loading: {
        after: {
          900: { target: 'intro' },
        },
        on: {
          BOOT_COMPLETE: 'intro',
          SKIP_INTRO: 'explore',
        },
        exit: 'resetIntroProgress',
      },
      intro: {
        on: {
          INTRO_COMPLETE: 'explore',
          SKIP_INTRO: 'explore',
        },
      },
      explore: {
        on: {
          ENTER_FOCUS: {
            target: 'focus',
            actions: 'setActiveNode',
          },
          OPEN_COMMAND: 'command',
          ENTER_BUILD: 'build',
        },
      },
      focus: {
        on: {
          ENTER_EXPLORE: {
            target: 'explore',
            actions: 'clearActiveNode',
          },
          EXIT_FOCUS: {
            target: 'explore',
            actions: 'clearActiveNode',
          },
          OPEN_COMMAND: 'command',
        },
      },
      command: {
        on: {
          CLOSE_COMMAND: 'explore',
          ENTER_FOCUS: {
            target: 'focus',
            actions: 'setActiveNode',
          },
          ENTER_BUILD: 'build',
        },
      },
      build: {
        on: {
          ENTER_EXPLORE: 'explore',
          OPEN_COMMAND: 'command',
        },
      },
    },
    on: {
      RESET: {
        target: 'loading',
        actions: 'clearActiveNode',
      },
      OPEN_SETTINGS: {
        actions: 'openSettings',
      },
      CLOSE_SETTINGS: {
        actions: 'closeSettings',
      },
      TIMELINE_PROGRESS: {
        actions: 'setIntroProgress',
      },
    },
  },
  {
    actions: {
      setActiveNode: assign((context, event) => {
        if (event.type === 'ENTER_FOCUS') {
          return { ...context, activeNode: event.nodeId ?? null }
        }
        return context
      }),
      clearActiveNode: assign((context) => ({ ...context, activeNode: null })),
      openSettings: assign((context) => ({ ...context, settingsOpen: true })),
      closeSettings: assign((context) => ({ ...context, settingsOpen: false })),
      setIntroProgress: assign((context, event) => {
        if (event.type === 'TIMELINE_PROGRESS') {
          return { ...context, introProgress: event.progress }
        }
        return context
      }),
      resetIntroProgress: assign((context) => ({ ...context, introProgress: 0 })),
    },
  },
)

type SceneState = StateFrom<typeof sceneMachine>
export type SceneService = InterpreterFrom<typeof sceneMachine>

export type SceneEffect =
  | { type: 'mode.enter'; mode: SceneMode }
  | { type: 'mode.exit'; mode: SceneMode }
  | { type: 'camera.rail'; mode: SceneMode; target: [number, number, number]; lookAt: [number, number, number]; duration: number }
  | { type: 'lighting.update'; mode: SceneMode; ambient: number; intensity: number; color: string }
  | { type: 'hud.animate'; mode: SceneMode; commandOpen: boolean; settingsOpen: boolean }
  | { type: 'node.focus'; nodeId: string | null }
  | { type: 'timeline.progress'; timeline: 'loading' | 'intro'; progress: number }

type SceneEffectListener = (effect: SceneEffect) => void

const listeners = new Set<SceneEffectListener>()

function emitSceneEffect(effect: SceneEffect) {
  listeners.forEach((listener) => listener(effect))
}

export function onSceneEffect(listener: SceneEffectListener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const sceneRails: Record<SceneMode, {
  position: [number, number, number]
  lookAt: [number, number, number]
  ambient: number
  intensity: number
  color: string
  duration: number
}> = {
  loading: {
    position: [0, 6, 16],
    lookAt: [0, 0, 0],
    ambient: 0.4,
    intensity: 0.2,
    color: '#0f172a',
    duration: 1.8,
  },
  intro: {
    position: [0, 4, 10],
    lookAt: [0, 0, 0],
    ambient: 0.6,
    intensity: 0.35,
    color: '#172554',
    duration: 1.2,
  },
  explore: {
    position: [2, 5, 8],
    lookAt: [0, 0, 0],
    ambient: 0.75,
    intensity: 0.45,
    color: '#0f766e',
    duration: 0.9,
  },
  focus: {
    position: [1.5, 3.2, 5.2],
    lookAt: [0, 0, 0],
    ambient: 0.55,
    intensity: 0.55,
    color: '#7c3aed',
    duration: 0.7,
  },
  command: {
    position: [-1.5, 4, 7.5],
    lookAt: [0, 0, 0],
    ambient: 0.65,
    intensity: 0.4,
    color: '#1d4ed8',
    duration: 0.8,
  },
  build: {
    position: [0, 6, 12],
    lookAt: [0, 0, 0],
    ambient: 0.8,
    intensity: 0.6,
    color: '#f59e0b',
    duration: 0.85,
  },
}

const SceneStateContext = createContext<SceneService | null>(null)

function resolveSceneMode(state: SceneState): SceneMode {
  const value = state.value
  if (typeof value === 'string') {
    return value as SceneMode
  }
  return 'explore'
}

function useSceneMachineEffects(service: SceneService) {
  const previousModeRef = useRef<SceneMode | null>(null)
  const previousNodeRef = useRef<string | null>(null)

  useEffect(() => {
    const subscription = service.subscribe((state) => {
      const mode = resolveSceneMode(state)
      const previousMode = previousModeRef.current

      if (previousMode && previousMode !== mode) {
        emitSceneEffect({ type: 'mode.exit', mode: previousMode })
      }

      if (!previousMode || previousMode !== mode) {
        emitSceneEffect({ type: 'mode.enter', mode })
        const rail = sceneRails[mode]
        emitSceneEffect({
          type: 'camera.rail',
          mode,
          target: rail.position,
          lookAt: rail.lookAt,
          duration: rail.duration,
        })
        emitSceneEffect({
          type: 'lighting.update',
          mode,
          ambient: rail.ambient,
          intensity: rail.intensity,
          color: rail.color,
        })
        previousModeRef.current = mode
        if (typeof document !== 'undefined') {
          document.documentElement.style.setProperty('--scene-mode', mode)
        }
      }

      emitSceneEffect({
        type: 'hud.animate',
        mode,
        commandOpen: state.matches('command'),
        settingsOpen: state.context.settingsOpen,
      })

      if (previousNodeRef.current !== state.context.activeNode) {
        previousNodeRef.current = state.context.activeNode
        emitSceneEffect({ type: 'node.focus', nodeId: state.context.activeNode })
      }
    })

    return () => subscription.unsubscribe()
  }, [service])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const timeline = gsap.timeline({ paused: true })
    const proxy = { value: 0 }

    timeline.to(proxy, {
      value: 1,
      duration: 2.4,
      ease: 'power2.out',
      onUpdate: () => {
        const progress = timeline.progress()
        service.send({ type: 'TIMELINE_PROGRESS', progress })
        emitSceneEffect({ type: 'timeline.progress', timeline: 'intro', progress })
      },
      onComplete: () => {
        service.send({ type: 'INTRO_COMPLETE' })
      },
    })

    const subscription = service.subscribe((state) => {
      if (state.matches('intro')) {
        if (!timeline.isActive()) {
          timeline.restart()
        }
      } else if (timeline.isActive()) {
        timeline.pause(0)
      }
    })

    const snapshot = service.getSnapshot()
    if (snapshot.matches('intro')) {
      timeline.restart()
    }

    return () => {
      subscription.unsubscribe()
      timeline.kill()
    }
  }, [service])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let rafId: number | null = null
    let startTime = 0

    const tick = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp
      }
      const duration = 900
      const progress = Math.min(1, (timestamp - startTime) / duration)
      emitSceneEffect({ type: 'timeline.progress', timeline: 'loading', progress })
      rafId = window.requestAnimationFrame(tick)
    }

    const startLoop = () => {
      if (rafId == null) {
        startTime = 0
        rafId = window.requestAnimationFrame(tick)
      }
    }

    const stopLoop = () => {
      if (rafId != null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
    }

    const subscription = service.subscribe((state) => {
      if (state.matches('loading')) {
        startLoop()
      } else {
        stopLoop()
      }
    })

    const snapshot = service.getSnapshot()
    if (snapshot.matches('loading')) {
      startLoop()
    }

    return () => {
      stopLoop()
      subscription.unsubscribe()
    }
  }, [service])
}

export function SceneStateProvider({ children }: { children: React.ReactNode }) {
  const service = useInterpret(sceneMachine)

  useSceneMachineEffects(service)

  const value = useMemo(() => service, [service])

  return <SceneStateContext.Provider value={value}>{children}</SceneStateContext.Provider>
}

export function useSceneService(): SceneService {
  const service = useContext(SceneStateContext)
  if (!service) {
    throw new Error('useSceneService must be used within a SceneStateProvider')
  }
  return service
}

export function useSceneSend() {
  return useSceneService().send
}

export function useSceneSelector<T>(selector: (state: SceneState) => T): T {
  const service = useSceneService()
  return useSelector(service, selector)
}

export function useSceneMode(): SceneMode {
  return useSceneSelector((state) => resolveSceneMode(state))
}

export function useSceneValue<T>(selector: (state: SceneState) => T): T {
  return useSceneSelector(selector)
}

export function useSceneEffect(listener: SceneEffectListener) {
  const listenerRef = useRef(listener)

  useEffect(() => {
    listenerRef.current = listener
  }, [listener])

  useEffect(() => {
    return onSceneEffect((effect) => {
      listenerRef.current(effect)
    })
  }, [])
}
