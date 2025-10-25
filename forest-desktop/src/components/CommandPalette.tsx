import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { HUDWindow } from './hud/HUDWindow'

interface Props {
  onSearch: (query: string) => void
  onNodeCreated: () => void
  onOpenSettings: () => void
}

interface CommandPaletteContentProps {
  expanded: boolean
  value: string
  creating: boolean
  onExpand: () => void
  onCollapse: () => void
  onChange: (value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  inputRef: React.RefObject<HTMLInputElement>
}

export function CommandPaletteContent({
  expanded,
  value,
  creating,
  onExpand,
  onCollapse,
  onChange,
  onSubmit,
  inputRef,
}: CommandPaletteContentProps) {
  return (
    <div className="command-palette">
      {!expanded ? (
        <button type="button" className="command-palette-collapsed" onClick={onExpand}>
          <span>Type to create... (⌘K)</span>
        </button>
      ) : (
        <>
          <form onSubmit={onSubmit} className="command-palette-form">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Type text or /search, /settings..."
              disabled={creating}
              className="command-palette-input"
            />
          </form>
          {value && (
            <div className="command-palette-preview">
              {value.startsWith('/') ? (
                <div>
                  {value.startsWith('/search ') && `🔍 Search for: ${value.slice(8)}`}
                  {value === '/settings' && '⚙️ Open settings'}
                </div>
              ) : (
                <div>✨ Create note: "{value.slice(0, 40)}{value.length > 40 ? '...' : ''}"</div>
              )}
            </div>
          )}
          <div className="command-palette-actions">
            <button type="button" onClick={onCollapse} className="command-palette-secondary">
              Collapse
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function CommandPalette({ onSearch, onNodeCreated, onOpenSettings }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [value, setValue] = useState('')
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const initialPosition = useMemo(() => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 }
    }
    const width = 420
    const x = window.innerWidth / 2 - width / 2
    const y = window.innerHeight * 0.18
    return { x, y }
  }, [])

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [expanded])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setExpanded(true)
      }
      if (event.key === 'Escape') {
        setExpanded(false)
        setValue('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!value.trim()) return

    try {
      if (value.startsWith('/search ')) {
        const query = value.slice(8).trim()
        onSearch(query)
        setValue('')
      } else if (value === '/settings') {
        onOpenSettings()
        setValue('')
      } else {
        setCreating(true)
        await invoke('create_node_quick', { text: value })
        onNodeCreated()
        setValue('')
      }
    } catch (err) {
      console.error('Command failed:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <HUDWindow
      id="command-palette"
      title="Command Palette"
      isOpen
      initialPosition={initialPosition}
      chrome
      onClose={() => {
        setExpanded(false)
        setValue('')
      }}
    >
      <CommandPaletteContent
        expanded={expanded}
        value={value}
        creating={creating}
        onExpand={() => setExpanded(true)}
        onCollapse={() => {
          setExpanded(false)
          setValue('')
        }}
        onChange={setValue}
        onSubmit={handleSubmit}
        inputRef={inputRef}
      />
    </HUDWindow>
  )
}
