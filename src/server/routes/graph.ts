import { Elysia, t } from 'elysia';
import { findPath } from '../../core/graph';
import {
  getGraphDiffCore,
  getGraphGrowthCore,
  listGraphSnapshotsCore,
  createGraphSnapshotCore,
} from '../../core/temporal';
import {
  createSuccessResponse,
  resolveNodeId,
  parseQueryInt,
  parseQueryDate,
} from '../utils/helpers';
import { ForestError, ValidationError, createErrorResponse } from '../utils/errors';

export const graphRoutes = new Elysia({ prefix: '/api/v1' })
  // GET /graph/path - Find shortest path between two nodes
  .get(
    '/graph/path',
    async ({ query, set }) => {
      try {
        const from = query.from as string | undefined;
        const to = query.to as string | undefined;

        if (!from || !to) {
          throw new ValidationError('Both "from" and "to" query parameters are required');
        }

        const fromNode = await resolveNodeId(from);
        const toNode = await resolveNodeId(to);

        const result = await findPath(fromNode.id, toNode.id);

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
        tags: ['Graph'],
        summary: 'Find path',
        description: 'Find the shortest path between two nodes',
      },
    },
  );

// GET /graph/diff - Temporal graph diff from baseline to now
graphRoutes.get(
  '/graph/diff',
  async ({ query, set }) => {
    try {
      const sinceRaw = query.since as string | undefined;
      if (!sinceRaw || sinceRaw.trim().length === 0) {
        throw new ValidationError('"since" query parameter is required');
      }
      const since = parseQueryDate(sinceRaw);
      if (!since) {
        throw new ValidationError('Invalid "since" value');
      }
      const limit = parseQueryInt(query.limit as string | undefined, 25, 1, 200);

      const result = await getGraphDiffCore({
        since,
        limit,
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
      tags: ['Graph'],
      summary: 'Graph diff',
      description: 'Show graph changes since a specific time',
    },
  },
);

// GET /graph/growth - Graph growth timeline
graphRoutes.get(
  '/graph/growth',
  async ({ query, set }) => {
    try {
      const since = parseQueryDate(query.since as string | undefined);
      const until = parseQueryDate(query.until as string | undefined);
      const limit = parseQueryInt(query.limit as string | undefined, 120, 1, 500);

      const result = await getGraphGrowthCore({
        since: since ?? undefined,
        until: until ?? undefined,
        limit,
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
      tags: ['Graph'],
      summary: 'Graph growth',
      description: 'Show graph growth timeline points over time',
    },
  },
);

// GET /graph/snapshots - List graph snapshots
graphRoutes.get(
  '/graph/snapshots',
  async ({ query, set }) => {
    try {
      const since = parseQueryDate(query.since as string | undefined);
      const until = parseQueryDate(query.until as string | undefined);
      const limit = parseQueryInt(query.limit as string | undefined, 50, 1, 500);
      const snapshotTypeRaw = query.snapshotType as string | undefined;
      const snapshotType: 'auto' | 'manual' | undefined =
        snapshotTypeRaw === 'auto' || snapshotTypeRaw === 'manual'
          ? snapshotTypeRaw
          : undefined;

      const result = await listGraphSnapshotsCore({
        limit,
        since: since ?? undefined,
        until: until ?? undefined,
        snapshotType,
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
      tags: ['Graph'],
      summary: 'List graph snapshots',
      description: 'List graph snapshot records in descending time order',
    },
  },
);

// POST /graph/snapshots - Create manual/auto snapshot on demand
graphRoutes.post(
  '/graph/snapshots',
  async ({ body, set }) => {
    try {
      const data = (body ?? {}) as { snapshotType?: 'auto' | 'manual' };
      const snapshotType = data.snapshotType === 'auto' ? 'auto' : 'manual';
      const result = await createGraphSnapshotCore(snapshotType);
      set.status = 201;
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
    body: t.Object({
      snapshotType: t.Optional(t.Union([t.Literal('manual'), t.Literal('auto')])),
    }),
    detail: {
      tags: ['Graph'],
      summary: 'Create graph snapshot',
      description: 'Create a graph snapshot now',
    },
  },
);
