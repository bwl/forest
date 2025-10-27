import { useStats } from '../queries/forest'

export function StatsDisplay() {
  const { data: stats, isLoading, refetch } = useStats()

  if (isLoading) {
    return (
      <div className="glass-panel rounded-xl p-4">
        <p className="text-slate-300">Loading stats...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="glass-panel rounded-xl p-4">
        <p className="text-red-400 mb-3">No stats available</p>
        <button className="btn-primary" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-4">
      <div className="glass-panel rounded-xl p-4 text-center">
        <p className="text-3xl font-bold text-slate-50">{stats.nodes}</p>
        <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">Nodes</p>
      </div>

      <div className="glass-panel rounded-xl p-4 text-center">
        <p className="text-3xl font-bold text-slate-50">{stats.edges}</p>
        <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">Connections</p>
      </div>

      <div className="glass-panel rounded-xl p-4 text-center">
        <p className="text-3xl font-bold text-slate-50">{stats.suggested}</p>
        <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">Suggestions</p>
      </div>
    </div>
  )
}
