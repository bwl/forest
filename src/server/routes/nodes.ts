import { Elysia, t } from 'elysia';
import { getNodeById } from '../../lib/db.js';
import {
  listNodesCore,
  getNodeCore,
  getNodeContentCore,
  getNodeEdgesCore,
  createNodeCore,
  updateNodeCore,
  deleteNodeCore,
} from '../../core/nodes.js';
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
} from '../utils/helpers.js';
import { ForestError, ValidationError, createErrorResponse } from '../utils/errors.js';

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
        const includeSuggestions = parseQueryBoolean(
          query.includeSuggestions as string | undefined,
          true,
        );
        const edgesLimit = parseQueryInt(query.edgesLimit as string | undefined, 50, 1, 200);
        const suggestionsLimit = parseQueryInt(
          query.suggestionsLimit as string | undefined,
          20,
          1,
          100,
        );

        const result = await getNodeCore(node.id, {
          includeBody,
          includeEdges,
          includeSuggestions,
          edgesLimit,
          suggestionsLimit,
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

        const formattedSuggestions = await Promise.all(
          result.suggestions.map(async (edge) => {
            const connectedNodeId =
              edge.sourceId === node.id ? edge.targetId : edge.sourceId;
            const connectedNode = await getNodeById(connectedNodeId);
            return formatEdgeForResponse(edge, connectedNode, { includeRef: true });
          }),
        );

        return createSuccessResponse({
          node: formatNodeForDetail(result.node, { includeBody }),
          edges: formattedEdges,
          suggestions: formattedSuggestions,
          edgesTotal: result.edgesTotal,
          suggestionsTotal: result.suggestionsTotal,
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
        description: 'Get full node details including edges and suggestions',
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
        const status = (query.status as 'accepted' | 'suggested' | 'all') ?? 'accepted';
        const limit = parseQueryInt(query.limit as string | undefined, 50, 1, 200);
        const offset = parseQueryInt(query.offset as string | undefined, 0, 0);

        validatePaginationParams(limit, offset);

        const result = await getNodeEdgesCore(node.id, {
          status,
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

        const result = await createNodeCore({
          title: data.title,
          body: data.body,
          tags: data.tags,
          autoLink: data.autoLink !== false,
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
  );
