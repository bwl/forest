import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getEdgeProposals,
  acceptEdge,
  rejectEdge,
  type EdgeProposal,
} from '../lib/tauri-commands'

export const useEdgeProposals = (limit: number = 20) => {
  return useQuery<EdgeProposal[]>({
    queryKey: ['edgeProposals', limit],
    queryFn: () => getEdgeProposals(limit),
  })
}

export const useAcceptEdge = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      acceptEdge(sourceId, targetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edgeProposals'] })
    },
  })
}

export const useRejectEdge = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      rejectEdge(sourceId, targetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edgeProposals'] })
    },
  })
}
