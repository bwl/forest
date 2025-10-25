import { createPortal } from 'react-dom'
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { motion, useDragControls, useSpring } from 'framer-motion'
import { useHUDLayer } from './HUDLayer'

export interface HUDAnchor {
  getPosition: () => { x: number; y: number } | null
  offset?: { x: number; y: number }
}

interface HUDWindowProps {
  id?: string
  title?: string
  isOpen: boolean
  initialPosition?: { x: number; y: number }
  anchor?: HUDAnchor
  followAnchor?: boolean
  onClose?: () => void
  children: ReactNode
  className?: string
  chrome?: boolean
  header?: (utils: { onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void; isFocused: boolean }) => ReactNode
}

export function HUDWindow({
  id,
  title,
  isOpen,
  initialPosition,
  anchor,
  followAnchor = false,
  onClose,
  children,
  className,
  chrome = true,
  header,
}: HUDWindowProps) {
  const generatedId = useId()
  const windowId = id ?? generatedId
  const hud = useHUDLayer()

  const dragControls = useDragControls()
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    hud.registerWindow(windowId)
    return () => hud.unregisterWindow(windowId)
  }, [hud, windowId])

  const zIndex = hud.getZIndex(windowId)
  const isTopmost = hud.topmostId === windowId

  const startingPosition = useMemo(() => {
    if (initialPosition) return initialPosition
    if (typeof window !== 'undefined') {
      return { x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 150 }
    }
    return { x: 0, y: 0 }
  }, [initialPosition])

  const x = useSpring(startingPosition.x, { stiffness: 300, damping: 30 })
  const y = useSpring(startingPosition.y, { stiffness: 300, damping: 30 })
  const scale = useSpring(isOpen ? 1 : 0.95, { stiffness: 250, damping: 25 })
  const opacity = useSpring(isOpen ? 1 : 0, { stiffness: 200, damping: 25 })

  useEffect(() => {
    scale.set(isOpen ? 1 : 0.95)
    opacity.set(isOpen ? 1 : 0)
  }, [isOpen, opacity, scale])

  useEffect(() => {
    if (!anchor || !followAnchor || isDragging) return

    let frame: number
    const updatePosition = () => {
      const next = anchor.getPosition()
      if (next) {
        const offset = anchor.offset ?? { x: 0, y: 0 }
        x.set(next.x + offset.x)
        y.set(next.y + offset.y)
      }
      frame = window.requestAnimationFrame(updatePosition)
    }
    frame = window.requestAnimationFrame(updatePosition)
    return () => window.cancelAnimationFrame(frame)
  }, [anchor, followAnchor, isDragging, x, y])

  if (!hud.container) return null

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    hud.bringToFront(windowId)
    if (chrome || header) {
      dragControls.start(event.nativeEvent)
    }
  }

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="false"
      initial={false}
      animate={{}}
      style={{
        position: 'absolute',
        x,
        y,
        scale,
        opacity,
        zIndex,
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
      drag
      dragControls={dragControls}
      dragListener={!chrome && !header}
      dragMomentum
      dragElastic={0.2}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
      className={`hud-window${isTopmost ? ' hud-window--active' : ''}${className ? ` ${className}` : ''}`}
      data-state={isOpen ? 'open' : 'closed'}
      onPointerDown={() => hud.bringToFront(windowId)}
    >
      {header
        ? header({ onPointerDown: handlePointerDown, isFocused: isTopmost })
        : chrome && (
            <div className="hud-window-header" onPointerDown={(event) => handlePointerDown(event)}>
              <div className="hud-window-title">{title}</div>
              {onClose && (
                <button type="button" className="hud-window-close" onClick={onClose} aria-label="Close window">
                  ×
                </button>
              )}
            </div>
          )}
      <div className="hud-window-body">{children}</div>
    </motion.div>,
    hud.container
  )
}
