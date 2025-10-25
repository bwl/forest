import { useState, useRef, useEffect } from 'react'
import Draggable from 'react-draggable'
import { invoke } from '@tauri-apps/api/core'

interface Props {
  onSearch: (query: string) => void
  onNodeCreated: () => void
  onOpenSettings: () => void
  onExpandedChange?: (expanded: boolean) => void
}

export function CommandPalette({
  onSearch,
  onNodeCreated,
  onOpenSettings,
  onExpandedChange,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [value, setValue] = useState('')
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const setExpandedState = (next: boolean) => {
    setExpanded(next)
    onExpandedChange?.(next)
  }

  // Focus input when expanded
  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [expanded])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to focus
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setExpandedState(true)
      }
      // Esc to collapse
      if (e.key === 'Escape') {
        setExpandedState(false)
        setValue('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return

    try {
      if (value.startsWith('/search ')) {
        // Search command
        const query = value.slice(8).trim()
        onSearch(query)
        setExpandedState(false)
        setValue('')
      } else if (value === '/settings') {
        // Settings command
        onOpenSettings()
        setExpandedState(false)
        setValue('')
      } else {
        // Plain text = create node
        setCreating(true)
        await invoke('create_node_quick', { text: value })
        onNodeCreated()
        setExpandedState(false)
        setValue('')
      }
    } catch (err) {
      console.error('Command failed:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Draggable handle=".command-palette-handle">
      <div
        className="command-palette"
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
        }}
      >
        <div className="command-palette-handle">
          {!expanded ? (
            <div
              className="command-palette-collapsed"
              onClick={() => setExpandedState(true)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '24px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                border: '1px solid #ddd',
              }}
            >
              <span style={{ color: '#888', fontSize: '0.9rem' }}>
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
                className="command-palette-input"
                style={{
                  width: '400px',
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  border: '2px solid #0066cc',
                  borderRadius: '8px',
                  outline: 'none',
                  background: 'white',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                }}
              />
            </form>
          )}
        </div>

        {value && expanded && (
          <div
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#666',
            }}
          >
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
    </Draggable>
  )
}
