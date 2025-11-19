import { useState, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useKeyboard } from '../hooks/useKeyboard'

interface Props {
  onSearch: (query: string) => void
  onOpenSettings: () => void
  onOpenProposals: () => void
}

export function CommandPalette({ onSearch, onOpenSettings, onOpenProposals }: Props) {
  const [value, setValue] = useState('')
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Centralized keyboard handling - no manual addEventListener
  useKeyboard((e) => {
    if (e.key === 'Escape') {
      setValue('')
      inputRef.current?.blur()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return

    try {
      if (value.startsWith('/search ')) {
        const query = value.slice(8).trim()
        onSearch(query)
        setValue('')
      } else if (value === '/settings') {
        onOpenSettings()
        setValue('')
      } else if (value === '/proposals') {
        onOpenProposals()
        setValue('')
      } else {
        setCreating(true)
        await invoke('create_node_quick', { text: value })
        setValue('')
      }
    } catch (err) {
      console.error('Command failed:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type text or /search, /settings, /proposals..."
          disabled={creating}
          className="input w-full px-4 py-3 text-lg rounded-none border-none"

        />
      </form>

      {value && (
        <div className="px-4 py-2 text-xs text-slate-300/75 bg-black/80">
          {value.startsWith('/') ? (
            <div>
              {value.startsWith('/search ') && '🔍 Search for: ' + value.slice(8)}
              {value === '/settings' && '⚙️ Open settings'}
              {value === '/proposals' && '🔗 View edge proposals'}
            </div>
          ) : (
            <div>✨ Create note: "{value.slice(0, 40)}{value.length > 40 ? '...' : ''}"</div>
          )}
        </div>
      )}
    </div>
  )
}
