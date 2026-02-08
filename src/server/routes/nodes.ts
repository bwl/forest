import { Elysia, t } from 'elysia';
import { getNodeById, listNodes, updateNodeIndexData } from '../../lib/db';
import {
  listNodesCore,
  getNodeCore,
  getNodeContentCore,
  getNodeEdgesCore,
  createNodeCore,
  updateNodeCore,
  deleteNodeCore,
} from '../../core/nodes';
import { synthesizeNodesCore } from '../../core/synthesize';
import { writeArticleCore } from '../../core/write';
import {
  createSuccessResponse,
  parseQueryInt,
  parseQueryDate,
  parseQueryTags,
  parseQueryBoolean,
  resolveNodeId,
  formatNodeForList,
  formatNodeForContent,
  formatNodeForDetail,
  formatEdgeForResponse,
  createPaginationInfo,
  validatePaginationParams,
} from '../utils/helpers';
import { ForestError, ValidationError, createErrorResponse } from '../utils/errors';
import { buildNeighborhoodPayload } from '../../cli/shared/explore';
import { formatId } from '../../cli/shared/utils';

export const nodesRoutes = new Elysia({ prefix: '/api/v1' })
  // GET /nodes - List and search nodes
  .get(
    '/nodes',
    async ({ query, set }) => {
      try {
        // Parse query parameters
        const search = query.search as string | undefined;
        const tags = parseQueryTags(query.tags as string | undefined);
        const createdAfter = parseQueryDate(query.createdAfter as string | undefined);
        const createdBefore = parseQueryDate(query.createdBefore as string | undefined);
        const updatedAfter = parseQueryDate(query.updatedAfter as string | undefined);
        const updatedBefore = parseQueryDate(query.updatedBefore as string | undefined);
        const limit = parseQueryInt(query.limit as string | undefined, 20, 1, 100);
        const offset = parseQueryInt(query.offset as string | undefined, 0, 0);
        const sort = (query.sort as 'created' | 'updated' | 'title') ?? 'created';
        const order = (query.order as 'asc' | 'desc') ?? 'desc';

        validatePaginationParams(limit, offset);

        const result = await listNodesCore({
          search,
          tags,
          createdAfter,
          createdBefore,
          updatedAfter,
          updatedBefore,
          limit,
          offset,
          sort,
          order,
        });

        return createSuccessResponse({
          nodes: result.nodes.map(formatNodeForList),
          pagination: createPaginationInfo(result.total, limit, offset),
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Nodes'],
        summary: 'List and search nodes',
        description: 'List and search nodes with filtering, pagination, and sorting',
      },
    },
  )

  // GET /nodes/:id - Get full node details
  .get(
    '/nodes/:id',
    async ({ params, query, set }) => {
      try {
        const node = await resolveNodeId(params.id);
        const includeBody = parseQueryBoolean(query.includeBody as string | undefined, true);
        const includeEdges = parseQueryBoolean(query.includeEdges as string | undefined, true);
        const edgesLimit = parseQueryInt(query.edgesLimit as string | undefined, 50, 1, 200);

        const result = await getNodeCore(node.id, {
          includeBody,
          includeEdges,
          edgesLimit,
        });

        // Format edges with connected nodes
        const formattedEdges = await Promise.all(
          result.edges.map(async (edge) => {
            const connectedNodeId =
              edge.sourceId === node.id ? edge.targetId : edge.sourceId;
            const connectedNode = await getNodeById(connectedNodeId);
            return formatEdgeForResponse(edge, connectedNode);
          }),
        );

        return createSuccessResponse({
          node: formatNodeForDetail(result.node, { includeBody }),
          edges: formattedEdges,
          edgesTotal: result.edgesTotal,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Nodes'],
        summary: 'Get node details',
        description: 'Get full node details including edges',
      },
    },
  )

  // GET /nodes/:id/content - Get lightweight content
  .get(
    '/nodes/:id/content',
    async ({ params, set }) => {
      try {
        const node = await resolveNodeId(params.id);
        const content = await getNodeContentCore(node.id);

        return createSuccessResponse(formatNodeForContent(content));
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Nodes'],
        summary: 'Get node content',
        description: 'Get just the content (title and body) of a node',
      },
    },
  )

  // GET /nodes/:id/edges - Get paginated edges
  .get(
    '/nodes/:id/edges',
    async ({ params, query, set }) => {
      try {
        const node = await resolveNodeId(params.id);
        const limit = parseQueryInt(query.limit as string | undefined, 50, 1, 200);
        const offset = parseQueryInt(query.offset as string | undefined, 0, 0);

        validatePaginationParams(limit, offset);

        const result = await getNodeEdgesCore(node.id, {
          limit,
          offset,
        });

        // Format edges with connected nodes
        const formattedEdges = await Promise.all(
          result.edges.map(async (edge) => {
            const connectedNodeId =
              edge.sourceId === node.id ? edge.targetId : edge.sourceId;
            const connectedNode = await getNodeById(connectedNodeId);
            return {
              ...formatEdgeForResponse(edge, connectedNode, { includeRef: true }),
              ref: formatEdgeForResponse(edge, connectedNode, { includeRef: true }).ref,
            };
          }),
        );

        return createSuccessResponse({
          nodeId: node.id,
          edges: formattedEdges,
          pagination: createPaginationInfo(result.total, limit, offset),
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Nodes'],
        summary: 'Get node edges',
        description: 'Get paginated edges for a specific node',
      },
    },
  )

  // POST /nodes - Create node
  .post(
    '/nodes',
    async ({ body, set }) => {
      try {
        const data = body as any;

        if (!data.body || typeof data.body !== 'string' || data.body.trim().length === 0) {
          throw new ValidationError('Body is required and must be a non-empty string');
        }

        // Build metadata: default to API origin, merge any client-provided metadata
        const apiMetadata = {
          origin: 'api' as const,
          ...(data.metadata ?? {}),
        };

        const result = await createNodeCore({
          title: data.title,
          body: data.body,
          tags: data.tags,
          autoLink: data.autoLink !== false,
          metadata: apiMetadata,
        });

        set.status = 201;
        return createSuccessResponse({
          node: formatNodeForDetail(result.node),
          linking: result.linking,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Nodes'],
        summary: 'Create node',
        description: 'Create a new node (capture)',
      },
    },
  )

  // PUT /nodes/:id - Update node
  .put(
    '/nodes/:id',
    async ({ params, body, set }) => {
      try {
        const node = await resolveNodeId(params.id);
        const data = body as any;

        const result = await updateNodeCore(node.id, {
          title: data.title,
          body: data.body,
          tags: data.tags,
          autoLink: data.autoLink !== false,
        });

        return createSuccessResponse({
          node: formatNodeForDetail(result.node),
          linking: result.linking,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Nodes'],
        summary: 'Update node',
        description: 'Update an existing node',
      },
    },
  )

  // DELETE /nodes/:id - Delete node
  .delete(
    '/nodes/:id',
    async ({ params, set }) => {
      try {
        const node = await resolveNodeId(params.id);
        const result = await deleteNodeCore(node.id);

        return createSuccessResponse({
          deleted: result,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Nodes'],
        summary: 'Delete node',
        description: 'Delete a node and all its edges',
      },
    },
  )

  // POST /nodes/:id/tags - Add tags to a node
  .post(
    '/nodes/:id/tags',
    async ({ params, body, set }) => {
      try {
        const node = await resolveNodeId(params.id);
        const data = body as any;

        if (!data.tags || !Array.isArray(data.tags) || data.tags.length === 0) {
          throw new ValidationError('tags is required and must be a non-empty array of strings');
        }

        const tagsToAdd: string[] = data.tags.map((t: string) => t.trim().replace(/^#/, '').toLowerCase()).filter((t: string) => t.length > 0);
        const currentNode = await getNodeById(node.id);
        if (!currentNode) throw new ValidationError('Node not found after resolve');

        const nextTags = Array.from(new Set([...currentNode.tags, ...tagsToAdd].map((t) => t.toLowerCase()))).sort();
        await updateNodeIndexData(node.id, nextTags, currentNode.tokenCounts);

        return createSuccessResponse({
          nodeId: node.id,
          added: tagsToAdd,
          tags: nextTags,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Nodes'],
        summary: 'Add tags to node',
        description: 'Add one or more tags to a node',
      },
    },
  )

  // DELETE /nodes/:id/tags - Remove tags from a node
  .delete(
    '/nodes/:id/tags',
    async ({ params, body, set }) => {
      try {
        const node = await resolveNodeId(params.id);
        const data = body as any;

        if (!data.tags || !Array.isArray(data.tags) || data.tags.length === 0) {
          throw new ValidationError('tags is required and must be a non-empty array of strings');
        }

        const tagsToRemove = new Set(data.tags.map((t: string) => t.trim().replace(/^#/, '').toLowerCase()));
        const currentNode = await getNodeById(node.id);
        if (!currentNode) throw new ValidationError('Node not found after resolve');

        const before = currentNode.tags.map((t) => t.toLowerCase());
        const nextTags = before.filter((t) => !tagsToRemove.has(t)).sort();
        const removed = before.filter((t) => tagsToRemove.has(t));

        await updateNodeIndexData(node.id, nextTags, currentNode.tokenCounts);

        return createSuccessResponse({
          nodeId: node.id,
          removed,
          tags: nextTags,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Nodes'],
        summary: 'Remove tags from node',
        description: 'Remove one or more tags from a node',
      },
    },
  )

  // GET /nodes/:id/neighborhood - Get node neighborhood for graph traversal
  .get(
    '/nodes/:id/neighborhood',
    async ({ params, query, set }) => {
      try {
        const node = await resolveNodeId(params.id);
        const depth = parseQueryInt(query.depth as string | undefined, 1, 1, 3);
        const limit = parseQueryInt(query.limit as string | undefined, 50, 1, 200);

        const { payload } = await buildNeighborhoodPayload(node.id, depth, limit);

        return createSuccessResponse(payload);
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Nodes'],
        summary: 'Get node neighborhood',
        description: 'Get neighborhood graph data for a node (nodes and edges within depth)',
      },
    },
  )

  // POST /nodes/synthesize - Synthesize from multiple nodes
  .post(
    '/nodes/synthesize',
    async ({ body, set }) => {
      try {
        const data = body as any;

        if (!data.nodeIds || !Array.isArray(data.nodeIds) || data.nodeIds.length < 2) {
          throw new ValidationError('nodeIds must be an array of at least 2 node IDs');
        }

        // Resolve all node IDs server-side
        const resolvedIds: string[] = [];
        for (const idRef of data.nodeIds) {
          const node = await resolveNodeId(String(idRef));
          resolvedIds.push(node.id);
        }

        // Call synthesis core (LLM call happens server-side)
        const result = await synthesizeNodesCore(resolvedIds, {
          model: data.model,
          reasoning: data.reasoning,
          verbosity: data.verbosity,
          maxTokens: data.maxTokens,
        });

        // Optionally save as new node
        let nodeData: any = undefined;
        let linkingData: any = undefined;

        if (!data.preview) {
          const autoLink = data.autoLink !== false;
          const nodeResult = await createNodeCore({
            title: result.title,
            body: result.body,
            tags: result.suggestedTags,
            autoLink,
            metadata: {
              origin: 'synthesize',
              createdBy: 'ai',
              model: result.model,
              sourceNodes: result.sourceNodeIds,
            },
          });
          nodeData = formatNodeForDetail(nodeResult.node);
          linkingData = nodeResult.linking;
        }

        return createSuccessResponse({
          title: result.title,
          body: result.body,
          suggestedTags: result.suggestedTags,
          sourceNodeIds: result.sourceNodeIds,
          model: result.model,
          reasoningEffort: result.reasoningEffort,
          verbosity: result.verbosity,
          cost: result.cost,
          tokensUsed: result.tokensUsed,
          node: nodeData,
          linking: linkingData,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Nodes'],
        summary: 'Synthesize nodes',
        description: 'Synthesize a new article from multiple source nodes using LLM',
      },
    },
  )

  // POST /nodes/write - Write an article on a topic
  .post(
    '/nodes/write',
    async ({ body, set }) => {
      try {
        const data = body as any;

        if (!data.topic || typeof data.topic !== 'string' || data.topic.trim().length === 0) {
          throw new ValidationError('topic is required and must be a non-empty string');
        }

        // Call write core (LLM call happens server-side)
        const result = await writeArticleCore(data.topic, {
          model: data.model,
          reasoning: data.reasoning,
          verbosity: data.verbosity,
          maxTokens: data.maxTokens,
        });

        // Optionally save as new node
        let nodeData: any = undefined;
        let linkingData: any = undefined;

        if (!data.preview) {
          const autoLink = data.autoLink !== false;
          const nodeResult = await createNodeCore({
            title: result.title,
            body: result.body,
            tags: result.suggestedTags,
            autoLink,
            metadata: {
              origin: 'write',
              createdBy: 'ai',
              model: result.model,
            },
          });
          nodeData = formatNodeForDetail(nodeResult.node);
          linkingData = nodeResult.linking;
        }

        return createSuccessResponse({
          title: result.title,
          body: result.body,
          suggestedTags: result.suggestedTags,
          model: result.model,
          reasoningEffort: result.reasoningEffort,
          verbosity: result.verbosity,
          cost: result.cost,
          tokensUsed: result.tokensUsed,
          node: nodeData,
          linking: linkingData,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Nodes'],
        summary: 'Write article',
        description: 'Use LLM to write a comprehensive article on a topic',
      },
    },
  )

  // POST /nodes/link - Create a bridge tag linking two nodes
  .post(
    '/nodes/link',
    async ({ body, set }) => {
      try {
        const data = body as any;

        if (!data.sourceId || !data.targetId) {
          throw new ValidationError('sourceId and targetId are required');
        }

        const { linkNodesCore } = await import('../../core/link');

        const sourceNode = await resolveNodeId(data.sourceId);
        const targetNode = await resolveNodeId(data.targetId);

        const result = await linkNodesCore({
          sourceId: sourceNode.id,
          targetId: targetNode.id,
          name: data.name,
        });

        return createSuccessResponse(result);
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Nodes'],
        summary: 'Link nodes',
        description: 'Create a bridge tag (#link/...) linking two nodes',
      },
    },
  );
