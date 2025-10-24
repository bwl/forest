import { useEffect, useState, useCallback } from 'react'
import { getEdgeProposals, acceptEdge, rejectEdge, type EdgeProposal } from '../lib/tauri-commands'

export function EdgeProposals() {
  const [proposals, setProposals] = useState<EdgeProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProposals = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getEdgeProposals(20)
      setProposals(data)
    } catch (err) {
      console.error('Failed to load proposals:', err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProposals()
  }, [loadProposals])

  async function handleAccept(sourceId: string, targetId: string) {
    try {
      await acceptEdge(sourceId, targetId)
      // Remove from list
      setProposals(proposals.filter(p => !(p.source_id === sourceId && p.target_id === targetId)))
    } catch (err) {
      console.error('Failed to accept edge:', err)
      setError(String(err))
    }
  }

  async function handleReject(sourceId: string, targetId: string) {
    try {
      await rejectEdge(sourceId, targetId)
      // Remove from list
      setProposals(proposals.filter(p => !(p.source_id === sourceId && p.target_id === targetId)))
    } catch (err) {
      console.error('Failed to reject edge:', err)
      setError(String(err))
    }
  }

  if (loading) {
    return <div className="forest-card"><p>Loading proposals...</p></div>
  }

  if (error) {
    return (
      <div className="forest-card">
        <p style={{ color: '#d00' }}>Error: {error}</p>
        <button className="forest-button" onClick={loadProposals}>Retry</button>
      </div>
    )
  }

  return (
    <div>
      <h2>Edge Proposals</h2>

      {proposals.length === 0 && (
        <div className="forest-card" style={{ textAlign: 'center', color: '#888' }}>
          <p>No pending proposals!</p>
          <p style={{ fontSize: '0.875rem' }}>
            All suggested connections have been reviewed.
          </p>
        </div>
      )}

      {proposals.map((proposal) => (
        <div key={proposal.edge_id} className="forest-card" style={{ marginBottom: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              <strong>{proposal.source_title}</strong>
              {' ↔ '}
              <strong>{proposal.target_title}</strong>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              Similarity: {(proposal.score * 100).toFixed(1)}%
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="forest-button"
              onClick={() => handleAccept(proposal.source_id, proposal.target_id)}
              style={{ backgroundColor: '#0a0', color: '#fff' }}
            >
              Accept
            </button>
            <button
              className="forest-button"
              onClick={() => handleReject(proposal.source_id, proposal.target_id)}
              style={{ backgroundColor: '#d00', color: '#fff' }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
