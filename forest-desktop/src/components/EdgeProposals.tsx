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
      <div className="bg-[#eee8d5] border border-[#93a1a1] p-4">
        <p className="text-[#586e75]">Loading proposals...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[#eee8d5] border border-[#93a1a1] p-4">
        <p className="text-[#dc322f] mb-3">Error: {String(error)}</p>
        <button className="btn-primary" onClick={() => refetch()}>Retry</button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#073642] mb-6">Edge Proposals</h2>

      {proposals.length === 0 && (
        <div className="bg-[#eee8d5] border border-[#93a1a1] p-8 text-center">
          <p className="text-[#93a1a1] mb-2">No pending proposals!</p>
          <p className="text-xs text-[#93a1a1]">
            All suggested connections have been reviewed.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {proposals.map((proposal) => (
          <div key={proposal.edge_id} className="bg-[#eee8d5] border border-[#93a1a1] p-4">
            <div className="mb-4">
              <div className="text-lg mb-2 text-[#586e75]">
                <strong>{proposal.source_title}</strong>
                {' ↔ '}
                <strong>{proposal.target_title}</strong>
              </div>
              <div className="text-xs text-[#93a1a1]">
                Similarity: {(proposal.score * 100).toFixed(1)}%
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="btn bg-[#859900] border-[#859900] text-[#fdf6e3] hover:bg-[#2aa198]"
                onClick={() => handleAccept(proposal.source_id, proposal.target_id)}
                disabled={acceptMutation.isPending || rejectMutation.isPending}
              >
                Accept
              </button>
              <button
                className="btn bg-[#dc322f] border-[#dc322f] text-[#fdf6e3] hover:bg-[#cb4b16]"
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
