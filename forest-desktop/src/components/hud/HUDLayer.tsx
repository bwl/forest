import { createContext, useContext, useState, useCallback, useRef, useMemo, type ReactNode } from 'react'

interface HUDContextValue {
  container: HTMLDivElement | null
  stackRef: React.MutableRefObject<string[]> // Ref instead of state!
  registerWindow: (id: string) => void
  unregisterWindow: (id: string) => void
  bringToFront: (id: string) => void
}

const HUDContext = createContext<HUDContextValue | null>(null)

const BASE_Z_INDEX = 1000

export function useHUDLayer() {
  const context = useContext(HUDContext)
  if (!context) {
    throw new Error('useHUDLayer must be used within a HUDLayer')
  }

  // No memoization needed! Context functions are stable, stackRef never changes identity
  // Compute derived values during render from the ref
  return {
    container: context.container,
    registerWindow: context.registerWindow,
    unregisterWindow: context.unregisterWindow,
    bringToFront: context.bringToFront,
    getZIndex: (id: string) => {
      const index = context.stackRef.current.indexOf(id)
      return index === -1 ? BASE_Z_INDEX : BASE_Z_INDEX + index + 1
    },
    topmostId: context.stackRef.current.length > 0
      ? (context.stackRef.current[context.stackRef.current.length - 1] ?? null)
      : null,
  }
}

interface HUDLayerProps {
  children: ReactNode
}

export function HUDLayer({ children }: HUDLayerProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  // KEY FIX: Use ref instead of state - stack changes don't trigger re-renders!
  const stackRef = useRef<string[]>([])

  // Stable functions that mutate the ref - no state updates, no re-renders!
  const registerWindow = useCallback((id: string) => {
    if (!stackRef.current.includes(id)) {
      stackRef.current = [...stackRef.current, id]
    }
  }, [])

  const unregisterWindow = useCallback((id: string) => {
    stackRef.current = stackRef.current.filter((existing) => existing !== id)
  }, [])

  const bringToFront = useCallback((id: string) => {
    const stack = stackRef.current
    if (!stack.includes(id)) {
      stackRef.current = [...stack, id]
    } else {
      stackRef.current = [...stack.filter((existing) => existing !== id), id]
    }
  }, [])

  // Memoize context - only recreates when container or functions change
  // stackRef identity never changes, so this is very stable!
  const contextValue = useMemo<HUDContextValue>(
    () => ({
      container,
      stackRef,
      registerWindow,
      unregisterWindow,
      bringToFront,
    }),
    [container, registerWindow, unregisterWindow, bringToFront]
  )

  return (
    <HUDContext.Provider value={contextValue}>
      <div className="hud-host">
        {children}
        <div className="hud-layer" ref={setContainer} />
      </div>
    </HUDContext.Provider>
  )
}
