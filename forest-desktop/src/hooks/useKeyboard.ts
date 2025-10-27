import { useEffect, useRef } from 'react'

/**
 * Simplified keyboard hook - no Zustand store needed!
 * Each component registers its own handler directly.
 *
 * This follows React best practices:
 * - Effects ARE appropriate for subscribing to external systems (DOM events)
 * - Using a ref to avoid re-subscribing when handler changes
 * - Clean, simple, no over-engineering
 *
 * @param handler - Function called on every keydown
 * @param deps - Dependencies for the handler
 */
export function useKeyboard(handler: (e: KeyboardEvent) => void, deps: React.DependencyList = []) {
  // Use ref to store latest handler without re-subscribing
  const handlerRef = useRef(handler)

  // Update ref when handler changes (avoids re-subscription)
  useEffect(() => {
    handlerRef.current = handler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  // Subscribe to keyboard events once
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handlerRef.current(e)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, []) // Only subscribe/unsubscribe on mount/unmount
}
