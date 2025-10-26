import { useEdgeProposals, useAcceptEdge, useRejectEdge } from '../queries/edges'

export function EdgeProposals() {
  const { data: proposals = [], isLoading, error, refetch } = useEdgeProposals(20)
  const acceptMutation = useAcceptEdge()
  const rejectMutation = useRejectEdge()

  async function handleAccept(sourceId: string, targetId: string) {
    await acceptMutation.mutateAsync({ sourceId, targetId })
  }

  async function handleReject(sourceId: string, targetId: string) {
    await rejectMutation.mutateAsync({ sourceId, targetId })
  }

  if (isLoading) {
    return (
      <div className="glass-panel rounded-xl p-4">
        <p className="text-slate-300">Loading proposals...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-panel rounded-xl p-4">
        <p className="text-red-400 mb-3">Error: {String(error)}</p>
        <button className="btn-primary" onClick={() => refetch()}>Retry</button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-50 mb-6">Edge Proposals</h2>

      {proposals.length === 0 && (
        <div className="glass-panel rounded-xl p-8 text-center">
          <p className="text-slate-400 mb-2">No pending proposals!</p>
          <p className="text-xs text-slate-500">
            All suggested connections have been reviewed.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {proposals.map((proposal) => (
          <div key={proposal.edge_id} className="glass-panel rounded-xl p-4">
            <div className="mb-4">
              <div className="text-lg mb-2 text-slate-100">
                <strong>{proposal.source_title}</strong>
                {' ↔ '}
                <strong>{proposal.target_title}</strong>
              </div>
              <div className="text-xs text-slate-400">
                Similarity: {(proposal.score * 100).toFixed(1)}%
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="btn bg-green-600/30 border-green-400/50 text-green-50 hover:bg-green-600/40"
                onClick={() => handleAccept(proposal.source_id, proposal.target_id)}
                disabled={acceptMutation.isPending || rejectMutation.isPending}
              >
                Accept
              </button>
              <button
                className="btn bg-red-600/30 border-red-400/50 text-red-50 hover:bg-red-600/40"
                onClick={() => handleReject(proposal.source_id, proposal.target_id)}
                disabled={acceptMutation.isPending || rejectMutation.isPending}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
