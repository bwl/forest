import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  getNode,
  getNodeConnections,
  updateNode,
  type NodeDetail,
  type NodeConnection,
} from '../lib/tauri-commands'
import { HUDWindow, type HUDAnchor } from './hud/HUDWindow'

interface Props {
  nodeId: string
  onClose: () => void
}

interface NodeDetailPanelContentProps {
  node: NodeDetail
  connections: NodeConnection[]
  editing: boolean
  saving: boolean
  editTitle: string
  editBody: string
  onEditToggle: (editing: boolean) => void
  onTitleChange: (value: string) => void
  onBodyChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
}

export function NodeDetailPanelContent({
  node,
  connections,
  editing,
  saving,
  editTitle,
  editBody,
  onEditToggle,
  onTitleChange,
  onBodyChange,
  onSave,
  onCancel,
}: NodeDetailPanelContentProps) {
  return (
    <div className="node-detail-panel">
      <div className="node-detail-metadata">
        <span>Created: {new Date(node.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(node.updated_at).toLocaleString()}</span>
      </div>

      {editing ? (
        <textarea
          value={editBody}
          onChange={(event) => onBodyChange(event.target.value)}
          className="node-detail-body-input"
          placeholder="Add details..."
        />
      ) : (
        <div className="node-detail-body">{node.body}</div>
      )}

      <div className="node-detail-actions">
        {editing ? (
          <>
            <button type="button" onClick={onSave} disabled={saving} className="forest-button">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onCancel} disabled={saving} className="node-detail-secondary">
              Cancel
            </button>
          </>
        ) : (
          <button type="button" onClick={() => onEditToggle(true)} className="forest-button">
            Edit
          </button>
        )}
      </div>

      {node.tags.length > 0 && (
        <div className="node-detail-tags">
          {node.tags.map((tag) => (
            <span key={tag} className="forest-tag">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {connections.length > 0 && (
        <div className="node-detail-connections">
          <h3>Connected Notes ({connections.length})</h3>
          {connections.map((connection) => (
            <div key={connection.node_id} className="node-detail-connection">
              <div className="node-detail-connection-title">{connection.title}</div>
              <div className="node-detail-connection-score">{(connection.score * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="node-detail-edit-fields">
          <label className="node-detail-edit-label" htmlFor="node-detail-title">
            Title
          </label>
          <input
            id="node-detail-title"
            value={editTitle}
            onChange={(event) => onTitleChange(event.target.value)}
            className="node-detail-title-input"
          />
        </div>
      )}
    </div>
  )
}

export function NodeDetailPanel({ nodeId, onClose }: Props) {
  const [node, setNode] = useState<NodeDetail | null>(null)
  const [connections, setConnections] = useState<NodeConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)
  const initialPosition = useMemo(() => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 }
    }
    return { x: window.innerWidth - 420, y: window.innerHeight / 2 - 260 }
  }, [])

  const loadNode = useCallback(async () => {
    try {
      setLoading(true)
      const [nodeData, conns] = await Promise.all([
        getNode(nodeId),
        getNodeConnections(nodeId),
      ])
      setNode(nodeData)
      setConnections(conns)
      setEditTitle(nodeData.title)
      setEditBody(nodeData.body)
    } catch (error) {
      console.error('Failed to load node:', error)
    } finally {
      setLoading(false)
    }
  }, [nodeId])

  useEffect(() => {
    loadNode()
  }, [loadNode])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSave = async () => {
    if (!node) return
    try {
      setSaving(true)
      await updateNode(node.id, editTitle, editBody)
      await loadNode()
      setEditing(false)
    } catch (error) {
      console.error('Failed to update node:', error)
    } finally {
      setSaving(false)
    }
  }

  const anchor = useMemo<HUDAnchor>(() => {
    return {
      getPosition: () => {
        if (typeof document === 'undefined') return null
        const element = document.querySelector<HTMLDivElement>(`.react-flow__node[data-id="${nodeId}"]`)
        if (!element) return null
        const rect = element.getBoundingClientRect()
        return { x: rect.right, y: rect.top + rect.height / 2 }
      },
      offset: { x: 24, y: -220 },
    }
  }, [nodeId])

  const header = useCallback(
    ({ onPointerDown }: { onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void }) => (
      <div className="node-detail-header" onPointerDown={onPointerDown}>
        <h2>{node?.title ?? 'Loading…'}</h2>
        <button type="button" onClick={onClose} className="node-detail-close" aria-label="Close node detail">
          ×
        </button>
      </div>
    ),
    [node?.title, onClose]
  )

  if (loading || !node) {
    return (
      <HUDWindow id={`node-${nodeId}`} title="Node" isOpen initialPosition={initialPosition} followAnchor anchor={anchor}>
        <div className="node-detail-loading">Loading…</div>
      </HUDWindow>
    )
  }

  return (
    <HUDWindow
      id={`node-${nodeId}`}
      isOpen
      anchor={anchor}
      followAnchor
      initialPosition={initialPosition}
      header={header}
    >
      <NodeDetailPanelContent
        node={node}
        connections={connections}
        editing={editing}
        saving={saving}
        editTitle={editTitle}
        editBody={editBody}
        onEditToggle={setEditing}
        onTitleChange={setEditTitle}
        onBodyChange={setEditBody}
        onSave={handleSave}
        onCancel={() => {
          setEditing(false)
          setEditTitle(node.title)
          setEditBody(node.body)
        }}
      />
    </HUDWindow>
  )
}
