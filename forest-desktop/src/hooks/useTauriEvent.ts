import { useEffect, useRef } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

/**
 * Hook for subscribing to Tauri events with automatic cleanup
 *
 * Follows React best practices for external subscriptions:
 * - Effects ARE appropriate for external systems (Tauri events)
 * - Uses ref to avoid re-subscribing when handler changes
 * - Properly calls unlisten() on cleanup to prevent memory leaks
 *
 * @param eventName - Name of the Tauri event to listen to
 * @param handler - Callback function to handle the event
 *
 * @example
 * ```tsx
 * useTauriEvent<NodeCreatedEvent>('node-created', (data) => {
 *   console.log('Node created:', data.id);
 *   refreshGraph();
 * });
 * ```
 */
export function useTauriEvent<T = unknown>(
  eventName: string,
  handler: (payload: T) => void
): void {
  // Use ref to store latest handler without re-subscribing to Tauri events
  const handlerRef = useRef(handler)
  handlerRef.current = handler // Update on every render (cheap, no Effect needed)

  useEffect(() => {
    let unlisten: UnlistenFn | null = null

    // Subscribe to Tauri event
    const subscribe = async () => {
      unlisten = await listen<T>(eventName, (event) => {
        handlerRef.current(event.payload) // Always calls latest handler
      })
    }

    subscribe()

    // Cleanup: unsubscribe when component unmounts or event name changes
    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [eventName]) // Only re-subscribe if event name changes
}
