import { EventEmitter } from 'events';
import { NodeRecord, EdgeRecord } from '../../lib/db';

export type ForestEventType =
  | 'node:created'
  | 'node:updated'
  | 'node:deleted'
  | 'edge:created'
  | 'edge:accepted'
  | 'edge:rejected'
  | 'edge:deleted'
  | 'tag:renamed';

export type NodeCreatedEvent = {
  type: 'node:created';
  timestamp: string;
  data: {
    node: {
      id: string;
      shortId: string;
      title: string;
      tags: string[];
    };
  };
};

export type NodeUpdatedEvent = {
  type: 'node:updated';
  timestamp: string;
  data: {
    node: {
      id: string;
      shortId: string;
      title: string;
      tags: string[];
    };
    changes: {
      title: boolean;
      body: boolean;
      tags: boolean;
    };
  };
};

export type NodeDeletedEvent = {
  type: 'node:deleted';
  timestamp: string;
  data: {
    nodeId: string;
    edgesDeleted: number;
  };
};

export type EdgeCreatedEvent = {
  type: 'edge:created';
  timestamp: string;
  data: {
    edge: {
      id: string;
      ref: string;
      sourceId: string;
      targetId: string;
      score: number;
      status: string;
    };
  };
};

export type EdgeAcceptedEvent = {
  type: 'edge:accepted';
  timestamp: string;
  data: {
    edge: {
      id: string;
      ref: string;
      sourceId: string;
      targetId: string;
      score: number;
      status: string;
    };
  };
};

export type EdgeRejectedEvent = {
  type: 'edge:rejected';
  timestamp: string;
  data: {
    edge: {
      id: string;
      ref: string;
      status: string;
    };
  };
};

export type EdgeDeletedEvent = {
  type: 'edge:deleted';
  timestamp: string;
  data: {
    edgeId: string;
    ref: string;
  };
};

export type TagRenamedEvent = {
  type: 'tag:renamed';
  timestamp: string;
  data: {
    from: string;
    to: string;
    nodesAffected: number;
  };
};

export type ForestEvent =
  | NodeCreatedEvent
  | NodeUpdatedEvent
  | NodeDeletedEvent
  | EdgeCreatedEvent
  | EdgeAcceptedEvent
  | EdgeRejectedEvent
  | EdgeDeletedEvent
  | TagRenamedEvent;

class ForestEventBus extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners for multiple WebSocket connections
    this.setMaxListeners(100);
  }

  emitNodeCreated(node: { id: string; shortId: string; title: string; tags: string[] }) {
    const event: NodeCreatedEvent = {
      type: 'node:created',
      timestamp: new Date().toISOString(),
      data: { node },
    };
    this.emit('node:created', event);
    this.emit('*', event);
  }

  emitNodeUpdated(
    node: { id: string; shortId: string; title: string; tags: string[] },
    changes: { title: boolean; body: boolean; tags: boolean },
  ) {
    const event: NodeUpdatedEvent = {
      type: 'node:updated',
      timestamp: new Date().toISOString(),
      data: { node, changes },
    };
    this.emit('node:updated', event);
    this.emit('*', event);
  }

  emitNodeDeleted(nodeId: string, edgesDeleted: number) {
    const event: NodeDeletedEvent = {
      type: 'node:deleted',
      timestamp: new Date().toISOString(),
      data: { nodeId, edgesDeleted },
    };
    this.emit('node:deleted', event);
    this.emit('*', event);
  }

  emitEdgeCreated(edge: {
    id: string;
    ref: string;
    sourceId: string;
    targetId: string;
    score: number;
    status: string;
  }) {
    const event: EdgeCreatedEvent = {
      type: 'edge:created',
      timestamp: new Date().toISOString(),
      data: { edge },
    };
    this.emit('edge:created', event);
    this.emit('*', event);
  }

  emitEdgeAccepted(edge: {
    id: string;
    ref: string;
    sourceId: string;
    targetId: string;
    score: number;
    status: string;
  }) {
    const event: EdgeAcceptedEvent = {
      type: 'edge:accepted',
      timestamp: new Date().toISOString(),
      data: { edge },
    };
    this.emit('edge:accepted', event);
    this.emit('*', event);
  }

  emitEdgeRejected(edge: { id: string; ref: string; status: string }) {
    const event: EdgeRejectedEvent = {
      type: 'edge:rejected',
      timestamp: new Date().toISOString(),
      data: { edge },
    };
    this.emit('edge:rejected', event);
    this.emit('*', event);
  }

  emitEdgeDeleted(edgeId: string, ref: string) {
    const event: EdgeDeletedEvent = {
      type: 'edge:deleted',
      timestamp: new Date().toISOString(),
      data: { edgeId, ref },
    };
    this.emit('edge:deleted', event);
    this.emit('*', event);
  }

  emitTagRenamed(from: string, to: string, nodesAffected: number) {
    const event: TagRenamedEvent = {
      type: 'tag:renamed',
      timestamp: new Date().toISOString(),
      data: { from, to, nodesAffected },
    };
    this.emit('tag:renamed', event);
    this.emit('*', event);
  }
}

// Singleton instance
export const eventBus = new ForestEventBus();
