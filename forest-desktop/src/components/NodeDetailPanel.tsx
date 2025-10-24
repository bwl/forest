import { useEffect, useState, useCallback } from 'react'
import { getNode, getNodeConnections, updateNode, type NodeDetail, type NodeConnection } from '../lib/tauri-commands'

interface Props {
  nodeId: string
  onClose: () => void
}

export function NodeDetailPanel({ nodeId, onClose }: Props) {
  const [node, setNode] = useState<NodeDetail | null>(null)
  const [connections, setConnections] = useState<NodeConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)

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
    } catch (err) {
      console.error('Failed to load node:', err)
    } finally {
      setLoading(false)
    }
  }, [nodeId])

  const handleSave = async () => {
    if (!node) return
    try {
      setSaving(true)
      await updateNode(node.id, editTitle, editBody)
      // Reload to get updated data
      await loadNode()
      setEditing(false)
      console.log('Node updated successfully')
    } catch (err) {
      console.error('Failed to update node:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    if (!node) return
    setEditTitle(node.title)
    setEditBody(node.body)
    setEditing(false)
  }

  useEffect(() => {
    loadNode()
  }, [loadNode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (loading || !node) {
    return (
      <div className="node-detail-panel">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div
      className="node-detail-panel"
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        width: '400px',
        height: '100vh',
        background: 'white',
        boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
        padding: '2rem',
        overflowY: 'auto',
        animation: 'slideIn 0.3s ease-out',
        zIndex: 900,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        {editing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              border: '2px solid #0066cc',
              borderRadius: '4px',
              padding: '0.25rem 0.5rem',
              flex: 1,
              marginRight: '0.5rem',
            }}
          />
        ) : (
          <h2 style={{ margin: 0 }}>{node.title}</h2>
        )}
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>
          ×
        </button>
      </div>

      {node.tags.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          {node.tags.map((tag) => (
            <span key={tag} className="forest-tag" style={{ marginRight: '0.5rem' }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {editing ? (
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          style={{
            width: '100%',
            minHeight: '200px',
            border: '2px solid #0066cc',
            borderRadius: '4px',
            padding: '0.5rem',
            fontSize: '1rem',
            lineHeight: '1.6',
            fontFamily: 'inherit',
            marginBottom: '1rem',
            resize: 'vertical',
          }}
        />
      ) : (
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', marginBottom: '2rem' }}>
          {node.body}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {editing ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '0.5rem 1rem',
                background: '#0066cc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              style={{
                padding: '0.5rem 1rem',
                background: '#ddd',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: '0.5rem 1rem',
              background: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
        )}
      </div>

      <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '2rem' }}>
        <p>Created: {new Date(node.created_at).toLocaleString()}</p>
        <p>Updated: {new Date(node.updated_at).toLocaleString()}</p>
      </div>

      {connections.length > 0 && (
        <div>
          <h3>Connected Notes ({connections.length})</h3>
          {connections.map((conn) => (
            <div
              key={conn.node_id}
              style={{
                padding: '0.75rem',
                marginBottom: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{conn.title}</span>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  {(conn.score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
