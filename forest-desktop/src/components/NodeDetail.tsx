import { useEffect, useState, useCallback } from 'react'
import { getNode, getNodeConnections, type NodeDetail as NodeDetailType, type NodeConnection } from '../lib/tauri-commands'

interface Props {
  nodeId: string
  onClose: () => void
}

export function NodeDetail({ nodeId, onClose }: Props) {
  const [node, setNode] = useState<NodeDetailType | null>(null)
  const [connections, setConnections] = useState<NodeConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadNodeData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [nodeData, conns] = await Promise.all([
        getNode(nodeId),
        getNodeConnections(nodeId)
      ])
      setNode(nodeData)
      setConnections(conns)
    } catch (err) {
      console.error('Failed to load node:', err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [nodeId])

  useEffect(() => {
    loadNodeData()
  }, [loadNodeData])

  if (loading) {
    return <div className="forest-card"><p>Loading...</p></div>
  }

  if (error) {
    return (
      <div className="forest-card">
        <p style={{ color: '#d00' }}>Error: {error}</p>
        <button className="forest-button" onClick={onClose}>Close</button>
      </div>
    )
  }

  if (!node) return null

  return (
    <div className="forest-card" style={{ maxWidth: '800px', margin: '2rem auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>{node.title}</h2>
        <button className="forest-button" onClick={onClose}>Close</button>
      </div>

      {node.tags.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          {node.tags.map((tag) => (
            <span key={tag} className="forest-tag">#{tag}</span>
          ))}
        </div>
      )}

      <div style={{ whiteSpace: 'pre-wrap', marginBottom: '2rem', lineHeight: '1.6' }}>
        {node.body}
      </div>

      <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '2rem' }}>
        <p>Created: {new Date(node.created_at).toLocaleString()}</p>
        <p>Updated: {new Date(node.updated_at).toLocaleString()}</p>
        <p>ID: <code>{node.id.substring(0, 8)}</code></p>
      </div>

      {connections.length > 0 && (
        <div>
          <h3>Connected Notes ({connections.length})</h3>
          {connections.map((conn) => (
            <div key={conn.node_id} className="forest-card" style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{conn.title}</span>
                <span style={{ fontSize: '0.875rem', color: '#666' }}>
                  {(conn.score * 100).toFixed(0)}% • {conn.edge_type}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
