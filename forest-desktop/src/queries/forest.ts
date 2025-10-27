import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getGraphData,
  getStats,
  getNode,
  getNodeConnections,
  updateNode,
  searchNodes,
  type GraphData,
  type ForestStats,
  type NodeDetail,
  type NodeConnection,
  type SearchResult,
} from '../lib/tauri-commands'

export const useGraph = () => {
  return useQuery<GraphData>({
    queryKey: ['graph'],
    queryFn: getGraphData,
  })
}

export const useStats = () => {
  return useQuery<ForestStats>({
    queryKey: ['stats'],
    queryFn: getStats,
  })
}

export const useNode = (nodeId?: string | null) => {
  return useQuery<NodeDetail>({
    queryKey: ['node', nodeId],
    queryFn: () => getNode(nodeId!),
    enabled: !!nodeId,
  })
}

export const useConnections = (nodeId?: string | null) => {
  return useQuery<NodeConnection[]>({
    queryKey: ['connections', nodeId],
    queryFn: () => getNodeConnections(nodeId!),
    enabled: !!nodeId,
  })
}

export const useUpdateNode = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title, body }: { id: string; title: string; body: string }) =>
      updateNode(id, title, body),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['node', id] })
      queryClient.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}

export const useSearchNodes = () => {
  return useMutation({
    mutationFn: ({ query, limit }: { query: string; limit: number }) =>
      searchNodes(query, limit),
  })
}
