import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState, type ReactNode, type PointerEvent } from 'react'
import { useHUDLayer } from './HUDLayer'

interface HUDWindowProps {
  id?: string
  title?: string
  initialX?: number
  initialY?: number
  onClose?: () => void
  children: ReactNode
  className?: string
}

interface DragState {
  isDragging: boolean
  startX: number
  startY: number
  offsetX: number
  offsetY: number
}

export function HUDWindow({
  id,
  title,
  initialX = 100,
  initialY = 100,
  onClose,
  children,
  className,
}: HUDWindowProps) {
  const generatedId = useId()
  const windowId = id ?? generatedId
  const hud = useHUDLayer()
  const windowRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState({ x: initialX, y: initialY })
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  })

  // Extract stable functions to avoid depending on entire hud object
  const { registerWindow, unregisterWindow } = hud

  useEffect(() => {
    registerWindow(windowId)
    return () => unregisterWindow(windowId)
  }, [registerWindow, unregisterWindow, windowId])

  // Simplified: Use React synthetic events directly - no manual addEventListener!
  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    const header = e.currentTarget

    // Only bring to front if not already topmost
    if (hud.topmostId !== windowId) {
      hud.bringToFront(windowId)
    }

    setDragState({
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: position.x,
      offsetY: position.y,
    })

    header.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragState.isDragging) return

    const dx = e.clientX - dragState.startX
    const dy = e.clientY - dragState.startY

    setPosition({
      x: dragState.offsetX + dx,
      y: dragState.offsetY + dy,
    })
  }

  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    if (dragState.isDragging) {
      e.currentTarget.releasePointerCapture(e.pointerId)
      setDragState(prev => ({ ...prev, isDragging: false }))
    }
  }

  if (!hud.container) return null

  const zIndex = hud.getZIndex(windowId)
  const isTopmost = hud.topmostId === windowId

  return createPortal(
    <div
      ref={windowRef}
      role="dialog"
      aria-modal="false"
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex,
        cursor: dragState.isDragging ? 'grabbing' : 'auto',
      }}
      className={`hud-window${isTopmost ? ' hud-window--active' : ''}${className ? ` ${className}` : ''}`}
      onPointerDown={() => {
        // Only bring to front if not already topmost - prevents redundant stack updates
        if (!isTopmost) {
          hud.bringToFront(windowId)
        }
      }}
    >
      <div
        ref={headerRef}
        className="hud-window-header"
        style={{ cursor: dragState.isDragging ? 'grabbing' : 'grab' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="hud-window-title">{title}</div>
        {onClose && (
          <button type="button" className="hud-window-close" onClick={onClose} aria-label="Close window">
            ×
          </button>
        )}
      </div>
      <div className="hud-window-body">{children}</div>
    </div>,
    hud.container
  )
}
