import { randomUUID } from 'crypto';
import {
  NodeRecord,
  EdgeRecord,
  listNodes as dbListNodes,
  getNodeById,
  insertNode,
  updateNode as dbUpdateNode,
  deleteNode as dbDeleteNode,
  listEdges,
} from '../lib/db';
import { extractTags, pickTitle, tokenize } from '../lib/text';
import { computeEmbeddingForNode } from '../lib/embeddings';
import { linkAgainstExisting, rescoreNode } from '../cli/shared/linking';
import { formatId } from '../cli/shared/utils';
import { eventBus } from '../server/events/eventBus';

export type ListNodesOptions = {
  search?: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  limit?: number;
  offset?: number;
  sort?: 'created' | 'updated' | 'title';
  order?: 'asc' | 'desc';
};

export type ListNodesResult = {
  nodes: NodeRecord[];
  total: number;
};

export type GetNodeOptions = {
  includeBody?: boolean;
  includeEdges?: boolean;
  includeSuggestions?: boolean;
  edgesLimit?: number;
  suggestionsLimit?: number;
};

export type GetNodeResult = {
  node: NodeRecord;
  edges: EdgeRecord[];
  edgesTotal: number;
};

export type GetNodeEdgesOptions = {
  limit?: number;
  offset?: number;
};

export type GetNodeEdgesResult = {
  edges: EdgeRecord[];
  total: number;
};

export type CreateNodeData = {
  title?: string;
  body: string;
  tags?: string[];
  autoLink?: boolean;
};

export type CreateNodeResult = {
  node: NodeRecord;
  linking: {
    edgesCreated: number;
  };
};

export type UpdateNodeData = {
  title?: string;
  body?: string;
  tags?: string[];
  autoLink?: boolean;
};

export type UpdateNodeResult = {
  node: NodeRecord;
  linking: {
    edgesCreated: number;
  };
};

export type DeleteNodeResult = {
  nodeId: string;
  edgesDeleted: number;
};

export async function listNodesCore(options: ListNodesOptions = {}): Promise<ListNodesResult> {
  let nodes = await dbListNodes();

  // Apply search filter
  if (options.search) {
    const searchTerm = options.search.toLowerCase();
    nodes = nodes.filter(
      (node) =>
        node.title.toLowerCase().includes(searchTerm) ||
        node.body.toLowerCase().includes(searchTerm) ||
        node.tags.some((tag) => tag.toLowerCase().includes(searchTerm)),
    );
  }

  // Apply tag filter (AND logic - all tags must be present)
  if (options.tags && options.tags.length > 0) {
    nodes = nodes.filter((node) => options.tags!.every((tag) => node.tags.includes(tag)));
  }

  // Apply date filters
  if (options.createdAfter) {
    const after = options.createdAfter.getTime();
    nodes = nodes.filter((node) => new Date(node.createdAt).getTime() >= after);
  }

  if (options.createdBefore) {
    const before = options.createdBefore.getTime();
    nodes = nodes.filter((node) => new Date(node.createdAt).getTime() <= before);
  }

  if (options.updatedAfter) {
    const after = options.updatedAfter.getTime();
    nodes = nodes.filter((node) => new Date(node.updatedAt).getTime() >= after);
  }

  if (options.updatedBefore) {
    const before = options.updatedBefore.getTime();
    nodes = nodes.filter((node) => new Date(node.updatedAt).getTime() <= before);
  }

  // Apply sorting
  const sort = options.sort ?? 'created';
  const order = options.order ?? 'desc';

  nodes.sort((a, b) => {
    let comparison = 0;

    if (sort === 'created') {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sort === 'updated') {
      comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    } else if (sort === 'title') {
      comparison = a.title.localeCompare(b.title);
    }

    return order === 'asc' ? comparison : -comparison;
  });

  const total = nodes.length;

  // Apply pagination
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const paginatedNodes = nodes.slice(offset, offset + limit);

  return {
    nodes: paginatedNodes,
    total,
  };
}

export async function getNodeCore(
  nodeId: string,
  options: GetNodeOptions = {},
): Promise<GetNodeResult> {
  const node = await getNodeById(nodeId);
  if (!node) {
    throw new Error(`Node with ID '${nodeId}' not found`);
  }

  let edges: EdgeRecord[] = [];
  let edgesTotal = 0;

  if (options.includeEdges !== false) {
    const allEdges = await listEdges('accepted');
    const nodeEdges = allEdges.filter(
      (edge) => edge.sourceId === nodeId || edge.targetId === nodeId,
    );

    edgesTotal = nodeEdges.length;
    const edgesLimit = options.edgesLimit ?? 50;
    edges = nodeEdges.slice(0, edgesLimit);
  }

  return {
    node,
    edges,
    edgesTotal,
  };
}

export async function getNodeContentCore(nodeId: string): Promise<NodeRecord> {
  const node = await getNodeById(nodeId);
  if (!node) {
    throw new Error(`Node with ID '${nodeId}' not found`);
  }
  return node;
}

export async function getNodeEdgesCore(
  nodeId: string,
  options: GetNodeEdgesOptions = {},
): Promise<GetNodeEdgesResult> {
  const node = await getNodeById(nodeId);
  if (!node) {
    throw new Error(`Node with ID '${nodeId}' not found`);
  }

  const allEdges = await listEdges('accepted');
  const nodeEdges = allEdges.filter(
    (edge) => edge.sourceId === nodeId || edge.targetId === nodeId,
  );

  const total = nodeEdges.length;

  // Apply pagination
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const paginatedEdges = nodeEdges.slice(offset, offset + limit);

  return {
    edges: paginatedEdges,
    total,
  };
}

export async function createNodeCore(data: CreateNodeData): Promise<CreateNodeResult> {
  const body = data.body.trim();
  if (!body) {
    throw new Error('Node body cannot be empty');
  }

  // Pick title if not provided (needed for LLM tagging)
  const title = data.title ?? pickTitle(body);

  // Extract or use provided tags (use async version for LLM support)
  let tags = data.tags;
  if (!tags || tags.length === 0) {
    const { extractTagsAsync } = await import('../lib/text');
    tags = await extractTagsAsync(`${title}\n${body}`, title);
  }

  // Tokenize
  const tokenCounts = tokenize(`${title}\n${body}`);

  // Create node record
  const now = new Date().toISOString();
  const node: NodeRecord = {
    id: randomUUID(),
    title,
    body,
    tags,
    tokenCounts,
    embedding: undefined,
    createdAt: now,
    updatedAt: now,
    isChunk: false,
    parentDocumentId: null,
    chunkOrder: null,
  };

  // Compute embedding
  try {
    const embedding = await computeEmbeddingForNode(node);
    if (embedding) {
      node.embedding = embedding;
    }
  } catch (error) {
    console.warn('Failed to compute embedding:', error);
  }

  // Insert node
  await insertNode(node);

  // Auto-link if requested
  let edgesCreated = 0;

  if (data.autoLink !== false) {
    const existing = await dbListNodes();
    const others = existing.filter((n) => n.id !== node.id);
    const linkResult = await linkAgainstExisting(node, others);
    edgesCreated = linkResult.accepted;
  }

  // Emit event
  eventBus.emitNodeCreated({
    id: node.id,
    shortId: formatId(node.id),
    title: node.title,
    tags: node.tags,
  });

  return {
    node,
    linking: {
      edgesCreated,
    },
  };
}

export async function updateNodeCore(
  nodeId: string,
  data: UpdateNodeData,
): Promise<UpdateNodeResult> {
  const existing = await getNodeById(nodeId);
  if (!existing) {
    throw new Error(`Node with ID '${nodeId}' not found`);
  }

  // Determine what changed
  const title = data.title ?? existing.title;
  const body = data.body ?? existing.body;
  const tags = data.tags ?? existing.tags;

  // Tokenize
  const tokenCounts = tokenize(`${title}\n${body}`);

  // Update node
  await dbUpdateNode(nodeId, {
    title,
    body,
    tags,
    tokenCounts,
  });

  // Recompute embedding if body or title changed
  if (data.title || data.body) {
    try {
      const updatedNode = await getNodeById(nodeId);
      if (updatedNode) {
        const embedding = await computeEmbeddingForNode(updatedNode);
        if (embedding) {
          await dbUpdateNode(nodeId, { embedding });
        }
      }
    } catch (error) {
      console.warn('Failed to recompute embedding:', error);
    }
  }

  // Get updated node
  const node = await getNodeById(nodeId);
  if (!node) {
    throw new Error('Failed to retrieve updated node');
  }

  // Auto-link if requested
  let edgesCreated = 0;

  if (data.autoLink !== false) {
    const linkResult = await rescoreNode(node);
    edgesCreated = linkResult.accepted;
  }

  // Emit event with changes
  eventBus.emitNodeUpdated(
    {
      id: node.id,
      shortId: formatId(node.id),
      title: node.title,
      tags: node.tags,
    },
    {
      title: data.title !== undefined && data.title !== existing.title,
      body: data.body !== undefined && data.body !== existing.body,
      tags: data.tags !== undefined && JSON.stringify(data.tags) !== JSON.stringify(existing.tags),
    },
  );

  return {
    node,
    linking: {
      edgesCreated,
    },
  };
}

export async function deleteNodeCore(nodeId: string): Promise<DeleteNodeResult> {
  const result = await dbDeleteNode(nodeId);
  if (!result.nodeRemoved) {
    throw new Error(`Node with ID '${nodeId}' not found`);
  }

  // Emit event
  eventBus.emitNodeDeleted(nodeId, result.edgesRemoved);

  return {
    nodeId,
    edgesDeleted: result.edgesRemoved,
  };
}
