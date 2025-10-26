import { useQueryClient } from '@tanstack/react-query'
import { useTauriEvent } from './useTauriEvent'
import { createLogger } from '../lib/logger'

const logger = createLogger('ForestEvents')

interface NodeUpdatedEvent {
  id: string
}

export function ForestEventsBridge() {
  const queryClient = useQueryClient()

  useTauriEvent('node-created', () => {
    logger.info('Node created event received')
    queryClient.invalidateQueries({ queryKey: ['graph'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  })

  useTauriEvent<NodeUpdatedEvent>('node-updated', (event) => {
    logger.info('Node updated event received', { id: event.id })
    queryClient.invalidateQueries({ queryKey: ['graph'] })
    queryClient.invalidateQueries({ queryKey: ['node', event.id] })
    queryClient.invalidateQueries({ queryKey: ['connections', event.id] })
  })

  useTauriEvent('edge-accepted', () => {
    logger.info('Edge accepted event received')
    queryClient.invalidateQueries({ queryKey: ['graph'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
    queryClient.invalidateQueries({ queryKey: ['edgeProposals'] })
  })

  useTauriEvent('edge-rejected', () => {
    logger.info('Edge rejected event received')
    queryClient.invalidateQueries({ queryKey: ['stats'] })
    queryClient.invalidateQueries({ queryKey: ['edgeProposals'] })
  })

  return null
}
