import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface HUDContextValue {
  container: HTMLDivElement | null
  registerWindow: (id: string) => void
  unregisterWindow: (id: string) => void
  bringToFront: (id: string) => void
  getZIndex: (id: string) => number
  topmostId: string | null
}

const HUDContext = createContext<HUDContextValue | null>(null)

export function useHUDLayer() {
  const context = useContext(HUDContext)
  if (!context) {
    throw new Error('useHUDLayer must be used within a HUDLayer')
  }
  return context
}

interface HUDLayerProps {
  children: ReactNode
}

const BASE_Z_INDEX = 1000

export function HUDLayer({ children }: HUDLayerProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [stack, setStack] = useState<string[]>([])

  const context = useMemo<HUDContextValue>(
    () => ({
      container,
      registerWindow: (id: string) => {
        setStack((prev) => (prev.includes(id) ? prev : [...prev, id]))
      },
      unregisterWindow: (id: string) => {
        setStack((prev) => prev.filter((existing) => existing !== id))
      },
      bringToFront: (id: string) => {
        setStack((prev) => {
          if (!prev.includes(id)) return [...prev, id]
          return [...prev.filter((existing) => existing !== id), id]
        })
      },
      getZIndex: (id: string) => {
        const index = stack.indexOf(id)
        return index === -1 ? BASE_Z_INDEX : BASE_Z_INDEX + index + 1
      },
      topmostId: stack.length > 0 ? stack[stack.length - 1] : null,
    }),
    [container, stack]
  )

  return (
    <HUDContext.Provider value={context}>
      <div className="hud-host">
        {children}
        <div className="hud-layer" ref={setContainer} />
      </div>
    </HUDContext.Provider>
  )
}
