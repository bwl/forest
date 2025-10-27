import { useStats } from '../queries/forest'

export function StatsDisplay() {
  const { data: stats, isLoading, refetch } = useStats()

  if (isLoading) {
    return (
      <div className="bg-[#eee8d5] border border-[#93a1a1] p-4">
        <p className="text-[#586e75]">Loading stats...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-[#eee8d5] border border-[#93a1a1] p-4">
        <p className="text-[#dc322f] mb-3">No stats available</p>
        <button className="btn-primary" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-4">
      <div className="bg-[#eee8d5] border border-[#93a1a1] p-4 text-center">
        <p className="text-3xl font-bold text-[#073642]">{stats.nodes}</p>
        <p className="text-xs text-[#93a1a1] uppercase tracking-wider mt-1">Nodes</p>
      </div>

      <div className="bg-[#eee8d5] border border-[#93a1a1] p-4 text-center">
        <p className="text-3xl font-bold text-[#073642]">{stats.edges}</p>
        <p className="text-xs text-[#93a1a1] uppercase tracking-wider mt-1">Connections</p>
      </div>

      <div className="bg-[#eee8d5] border border-[#93a1a1] p-4 text-center">
        <p className="text-3xl font-bold text-[#073642]">{stats.suggested}</p>
        <p className="text-xs text-[#93a1a1] uppercase tracking-wider mt-1">Suggestions</p>
      </div>
    </div>
  )
}
