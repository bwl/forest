import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface ForestStats {
  nodes: number
  edges: number
  suggested: number
}

export function StatsDisplay() {
  const [stats, setStats] = useState<ForestStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      setLoading(true)
      setError(null)
      const result = await invoke<ForestStats>('get_stats')
      setStats(result)
    } catch (err) {
      console.error('Failed to load stats:', err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="forest-stats">
        <p>Loading stats...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="forest-stats">
        <p style={{ color: '#d00' }}>Error: {error}</p>
        <button className="forest-button" onClick={loadStats}>
          Retry
        </button>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="forest-stats">
      <div className="forest-stat-card">
        <p className="forest-stat-value">{stats.nodes}</p>
        <p className="forest-stat-label">Nodes</p>
      </div>

      <div className="forest-stat-card">
        <p className="forest-stat-value">{stats.edges}</p>
        <p className="forest-stat-label">Connections</p>
      </div>

      <div className="forest-stat-card">
        <p className="forest-stat-value">{stats.suggested}</p>
        <p className="forest-stat-label">Suggestions</p>
      </div>
    </div>
  )
}
