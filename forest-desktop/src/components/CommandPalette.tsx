import { useState, useRef } from 'react'
import { useKeyboard } from '../hooks/useKeyboard'
import { createNodeQuick } from '../lib/tauri-commands'

interface Props {
  onSearch: (query: string) => void
  onOpenSettings: () => void
  onOpenProposals: () => void
}

export function CommandPalette({ onSearch, onOpenSettings, onOpenProposals }: Props) {
  const [value, setValue] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      setError(null)
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
        await createNodeQuick(value)
        setValue('')
      }
    } catch (err) {
      console.error('Command failed:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach Forest backend. Launch via `bun run tauri dev`.'
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        className="rounded border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg shadow-black/10"
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type text or /search, /settings, /proposals..."
          disabled={creating}
          className="command-palette-input text-base bg-transparent border-none px-4 py-3"
        />
      </form>

      {(value || error) && (
        <div className="px-4 py-2 text-xs border border-t-0 border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] shadow-md shadow-black/5">
          {error ? (
            <div className="text-[var(--accent-danger)] font-semibold">{error}</div>
          ) : value.startsWith('/') ? (
            <div>
              {value.startsWith('/search ') && '🔍 Search for: ' + value.slice(8)}
              {value === '/settings' && '⚙️ Open settings'}
              {value === '/proposals' && '🔗 View edge proposals'}
            </div>
          ) : (
            <div>
              ✨ Create note: "
              {value.slice(0, 40)}
              {value.length > 40 ? '...' : ''}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}
