import { Elysia } from 'elysia';
import { randomUUID } from 'crypto';
import { eventBus, ForestEvent, ForestEventType } from '../events/eventBus';

type SubscribeMessage = {
  type: 'subscribe';
  events?: ForestEventType[];
  filters?: {
    tags?: string[];
  };
};

type SubscribedMessage = {
  type: 'subscribed';
  events: ForestEventType[];
  sessionId: string;
};

type ClientSubscription = {
  sessionId: string;
  events: ForestEventType[];
  tagFilters?: string[];
};

const subscriptions = new Map<any, ClientSubscription>();

function shouldSendEvent(event: ForestEvent, subscription: ClientSubscription): boolean {
  // Check if subscribed to this event type or to all events
  const isSubscribed =
    subscription.events.length === 0 ||
    subscription.events.includes(event.type);

  if (!isSubscribed) {
    return false;
  }

  // Apply tag filters if present
  if (subscription.tagFilters && subscription.tagFilters.length > 0) {
    // Check if event involves any of the filtered tags
    if (event.type === 'node:created' || event.type === 'node:updated') {
      const nodeTags = event.data.node.tags;
      return subscription.tagFilters.some((tag) => nodeTags.includes(tag));
    }
    // For edge events, we'd need to look up the nodes' tags
    // For now, send all edge events if tag filters are present
    // TODO: Enhance tag filtering for edges by looking up node tags
  }

  return true;
}

export const websocketRoute = new Elysia()
  .ws('/ws', {
    open(ws) {
      console.log('WebSocket client connected');
    },

    message(ws, message) {
      try {
        const msg = typeof message === 'string' ? JSON.parse(message) : message;

        if (msg.type === 'subscribe') {
          const subscribeMsg = msg as SubscribeMessage;
          const sessionId = randomUUID();

          // Default to all events if not specified
          const events = subscribeMsg.events ?? [];
          const tagFilters = subscribeMsg.filters?.tags;

          const subscription: ClientSubscription = {
            sessionId,
            events,
            tagFilters,
          };

          subscriptions.set(ws, subscription);

          // Send acknowledgement
          const response: SubscribedMessage = {
            type: 'subscribed',
            events: events.length > 0 ? events : ['*' as ForestEventType],
            sessionId,
          };

          ws.send(JSON.stringify(response));

          // Set up event listeners
          const handleEvent = (event: ForestEvent) => {
            if (shouldSendEvent(event, subscription)) {
              ws.send(JSON.stringify(event));
            }
          };

          if (events.length === 0) {
            // Subscribe to all events
            eventBus.on('*', handleEvent);
          } else {
            // Subscribe to specific events
            events.forEach((eventType) => {
              eventBus.on(eventType, handleEvent);
            });
          }

          // Store cleanup function
          (ws as any)._cleanup = () => {
            if (events.length === 0) {
              eventBus.off('*', handleEvent);
            } else {
              events.forEach((eventType) => {
                eventBus.off(eventType, handleEvent);
              });
            }
          };
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(
          JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          }),
        );
      }
    },

    close(ws) {
      // Clean up event listeners
      if ((ws as any)._cleanup) {
        (ws as any)._cleanup();
      }
      subscriptions.delete(ws);
      console.log('WebSocket client disconnected');
    },
  });
