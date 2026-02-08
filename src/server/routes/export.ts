import { Elysia } from 'elysia';
import { listNodes, listEdges, getNodeById } from '../../lib/db';
import {
  createSuccessResponse,
  parseQueryBoolean,
  parseQueryInt,
  resolveNodeId,
} from '../utils/helpers';
import { ForestError, ValidationError, createErrorResponse } from '../utils/errors';
import { formatId } from '../../cli/shared/utils';
import { buildNeighborhoodPayload } from '../../cli/shared/explore';

function escapeLabel(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export const exportRoutes = new Elysia({ prefix: '/api/v1' })
  // GET /export/graphviz - Export neighborhood as DOT
  .get(
    '/export/graphviz',
    async ({ query, set }) => {
      try {
        const idParam = query.id as string | undefined;
        if (!idParam || idParam.trim().length === 0) {
          throw new ValidationError('id query parameter is required');
        }

        const node = await resolveNodeId(idParam);
        const depth = parseQueryInt(query.depth as string | undefined, 1, 1, 5);
        const limit = parseQueryInt(query.limit as string | undefined, 25, 1, 200);

        const { payload } = await buildNeighborhoodPayload(node.id, depth, limit);
        const nodes = await listNodes();
        const nodeMap = new Map(nodes.map((n) => [n.id, n]));

        const lines: string[] = [];
        lines.push('graph forest {');
        lines.push('  rankdir=LR;');
        lines.push('  node [shape=box, fontname="Helvetica"];');

        const defined = new Set<string>();
        const ensureNodeDefined = (id: string) => {
          if (defined.has(id)) return;
          const title = nodeMap.get(id)?.title ?? id;
          lines.push(`  "${id}" [label="${formatId(id)} ${escapeLabel(title)}"];`);
          defined.add(id);
        };

        payload.nodes.forEach((n: any) => ensureNodeDefined(n.id));
        payload.edges.forEach((edge: any) => {
          ensureNodeDefined(edge.source);
          ensureNodeDefined(edge.target);
          lines.push(`  "${edge.source}" -- "${edge.target}" [label="${edge.score.toFixed(3)}"];`);
        });

        lines.push('}');

        return createSuccessResponse({ dot: lines.join('\n') });
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
        tags: ['Export'],
        summary: 'Export as Graphviz DOT',
        description: 'Export a node neighborhood as a Graphviz DOT graph',
      },
    },
  )

  // GET /export/json - Export full database as JSON
  .get(
    '/export/json',
    async ({ query, set }) => {
      try {
        const includeBody = parseQueryBoolean(query.body as string | undefined, true);
        const includeEdges = parseQueryBoolean(query.edges as string | undefined, true);

        const nodes = await listNodes();
        const edges = includeEdges ? await listEdges('all') : [];

        const payload = {
          nodes: nodes.map((node) => ({
            id: node.id,
            title: node.title,
            tags: node.tags,
            body: includeBody ? node.body : undefined,
            tokenCounts: node.tokenCounts,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
          })),
          edges: edges.map((edge) => ({
            id: edge.id,
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            status: edge.status,
            score: edge.score,
            metadata: edge.metadata,
            createdAt: edge.createdAt,
            updatedAt: edge.updatedAt,
          })),
        };

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
        tags: ['Export'],
        summary: 'Export as JSON',
        description: 'Export the full database as JSON',
      },
    },
  );
