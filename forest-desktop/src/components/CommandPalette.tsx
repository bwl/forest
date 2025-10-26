import { useState, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useKeyboard } from '../hooks/useKeyboard'

interface Props {
  onSearch: (query: string) => void
  onOpenSettings: () => void
}

export function CommandPalette({ onSearch, onOpenSettings }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [value, setValue] = useState('')
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Centralized keyboard handling - no manual addEventListener
  useKeyboard((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setExpanded(true)
      // Focus directly in event handler - no useEffect needed!
      // Use queueMicrotask to focus after React finishes rendering
      queueMicrotask(() => inputRef.current?.focus())
    }
    if (e.key === 'Escape') {
      setExpanded(false)
      setValue('')
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return

    try {
      if (value.startsWith('/search ')) {
        const query = value.slice(8).trim()
        onSearch(query)
        setExpanded(false)
        setValue('')
      } else if (value === '/settings') {
        onOpenSettings()
        setExpanded(false)
        setValue('')
      } else {
        setCreating(true)
        await invoke('create_node_quick', { text: value })
        setExpanded(false)
        setValue('')
      }
    } catch (err) {
      console.error('Command failed:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      {!expanded ? (
        <div
          className="glass-panel rounded-full px-7 py-3 cursor-pointer shadow-[0_18px_40px_rgba(8,15,35,0.45)]"
          onClick={() => {
            setExpanded(true)
            // Focus directly in event handler - no useEffect needed!
            queueMicrotask(() => inputRef.current?.focus())
          }}
        >
          <span className="text-slate-300/70 text-sm tracking-wide">
            Type to create... (⌘K)
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type text or /search, /settings..."
            disabled={creating}
            className="input w-[400px] px-4 py-3 text-base rounded-2xl shadow-[0_24px_55px_rgba(8,15,35,0.55)]"
          />
        </form>
      )}

      {value && expanded && (
        <div className="glass-panel rounded-2xl px-3 py-2 mt-2 text-xs text-slate-300/75">
          {value.startsWith('/') ? (
            <div>
              {value.startsWith('/search ') && '🔍 Search for: ' + value.slice(8)}
              {value === '/settings' && '⚙️ Open settings'}
            </div>
          ) : (
            <div>✨ Create note: "{value.slice(0, 40)}{value.length > 40 ? '...' : ''}"</div>
          )}
        </div>
      )}
    </div>
  )
}
