import {
  GraphSnapshotRecord,
  GraphSnapshotType,
  GraphSnapshotNodeState,
  GraphSnapshotEdgeState,
  createGraphSnapshot,
  listGraphSnapshots,
  getCurrentGraphSnapshotState,
  getGraphSnapshotAtOrBefore,
  getGraphSnapshotAtOrAfter,
} from '../lib/db';

const EDGE_SCORE_EPSILON = 1e-6;

export type TemporalDiffNode = {
  id: string;
  title: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type TemporalDiffEdge = {
  key: string;
  sourceId: string;
  targetId: string;
  sourceTitle: string;
  targetTitle: string;
  scoreBefore: number | null;
  scoreAfter: number | null;
  delta: number | null;
};

export type TemporalDiffSection<T> = {
  total: number;
  shown: number;
  truncated: number;
  items: T[];
};

export type GraphDiffResult = {
  requestedSince: string;
  effectiveSince: string;
  generatedAt: string;
  baselineSnapshot: {
    id: number;
    takenAt: string;
    snapshotType: GraphSnapshotType;
  };
  warnings: string[];
  summary: {
    baseline: {
      nodes: number;
      edges: number;
      tags: number;
    };
    current: {
      nodes: number;
      edges: number;
      tags: number;
    };
    nodesAdded: number;
    nodesRemoved: number;
    nodesUpdated: number;
    edgesAdded: number;
    edgesRemoved: number;
    edgesChanged: number;
  };
  nodes: {
    added: TemporalDiffSection<TemporalDiffNode>;
    removed: TemporalDiffSection<TemporalDiffNode>;
    updated: TemporalDiffSection<TemporalDiffNode>;
  };
  edges: {
    added: TemporalDiffSection<TemporalDiffEdge>;
    removed: TemporalDiffSection<TemporalDiffEdge>;
    changed: TemporalDiffSection<TemporalDiffEdge>;
  };
};

export type GraphGrowthPoint = {
  takenAt: string;
  source: 'snapshot' | 'live';
  snapshotType: GraphSnapshotType | null;
  nodeCount: number;
  edgeCount: number;
  tagCount: number;
};

export type GraphGrowthResult = {
  from: string;
  to: string;
  generatedAt: string;
  warnings: string[];
  summary: {
    points: number;
    snapshots: number;
    nodeDelta: number;
    edgeDelta: number;
    tagDelta: number;
  };
  points: GraphGrowthPoint[];
};

export type CreateGraphSnapshotResult = {
  snapshot: GraphSnapshotRecord;
};

export type ListGraphSnapshotsResult = {
  snapshots: GraphSnapshotRecord[];
  total: number;
};

function edgeKey(sourceId: string, targetId: string): string {
  return `${sourceId}::${targetId}`;
}

function nodeMap(nodes: GraphSnapshotNodeState[]): Map<string, GraphSnapshotNodeState> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function edgeMap(edges: GraphSnapshotEdgeState[]): Map<string, GraphSnapshotEdgeState> {
  return new Map(edges.map((edge) => [edgeKey(edge.sourceId, edge.targetId), edge]));
}

function toDiffNode(node: GraphSnapshotNodeState): TemporalDiffNode {
  return {
    id: node.id,
    title: node.title,
    tags: node.tags,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}

function toDiffSection<T>(items: T[], limit: number): TemporalDiffSection<T> {
  const safeLimit = Math.max(1, Math.floor(limit));
  const shownItems = items.slice(0, safeLimit);
  return {
    total: items.length,
    shown: shownItems.length,
    truncated: Math.max(0, items.length - shownItems.length),
    items: shownItems,
  };
}

export async function createGraphSnapshotCore(
  snapshotType: GraphSnapshotType = 'manual',
): Promise<CreateGraphSnapshotResult> {
  const snapshot = await createGraphSnapshot(snapshotType);
  return { snapshot };
}

export async function listGraphSnapshotsCore(options: {
  limit?: number;
  since?: Date;
  until?: Date;
  snapshotType?: GraphSnapshotType;
} = {}): Promise<ListGraphSnapshotsResult> {
  const snapshots = await listGraphSnapshots({
    limit: options.limit,
    since: options.since?.toISOString(),
    until: options.until?.toISOString(),
    snapshotType: options.snapshotType,
  });
  return {
    snapshots,
    total: snapshots.length,
  };
}

export async function getGraphDiffCore(options: {
  since: Date;
  limit?: number;
}): Promise<GraphDiffResult> {
  const requestedSince = options.since.toISOString();
  const warnings: string[] = [];
  const limit = typeof options.limit === 'number' && Number.isFinite(options.limit)
    ? Math.max(1, Math.floor(options.limit))
    : 25;

  const before = await getGraphSnapshotAtOrBefore(requestedSince);
  const after = await getGraphSnapshotAtOrAfter(requestedSince);
  let baseline: GraphSnapshotRecord;

  if (before && after) {
    const beforeDelta = Math.abs(new Date(requestedSince).getTime() - new Date(before.takenAt).getTime());
    const afterDelta = Math.abs(new Date(after.takenAt).getTime() - new Date(requestedSince).getTime());
    baseline = beforeDelta <= afterDelta ? before : after;
  } else if (before) {
    baseline = before;
  } else if (after) {
    baseline = after;
  } else {
    const created = await createGraphSnapshot('manual');
    baseline = created;
    warnings.push(
      `No graph snapshots exist yet. Captured initial snapshot at ${created.takenAt}; rerun after changes to see a diff.`,
    );
  }

  if (baseline.takenAt !== requestedSince) {
    warnings.push(
      `No snapshot exists exactly at ${requestedSince}; using nearest snapshot at ${baseline.takenAt}.`,
    );
  }

  const effectiveSince = baseline.takenAt;
  const current = await getCurrentGraphSnapshotState();

  const baselineNodes = nodeMap(baseline.nodes);
  const currentNodes = nodeMap(current.nodes);

  const addedNodes: TemporalDiffNode[] = [];
  const removedNodes: TemporalDiffNode[] = [];
  const updatedNodes: TemporalDiffNode[] = [];

  for (const node of current.nodes) {
    if (!baselineNodes.has(node.id)) {
      addedNodes.push(toDiffNode(node));
      continue;
    }

    if (new Date(node.updatedAt).getTime() > new Date(effectiveSince).getTime()) {
      updatedNodes.push(toDiffNode(node));
    }
  }

  for (const node of baseline.nodes) {
    if (!currentNodes.has(node.id)) {
      removedNodes.push(toDiffNode(node));
    }
  }

  addedNodes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  removedNodes.sort((a, b) => a.title.localeCompare(b.title));
  updatedNodes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const baselineEdges = edgeMap(baseline.edges);
  const currentEdges = edgeMap(current.edges);
  const addedEdges: TemporalDiffEdge[] = [];
  const removedEdges: TemporalDiffEdge[] = [];
  const changedEdges: TemporalDiffEdge[] = [];

  for (const edge of current.edges) {
    const key = edgeKey(edge.sourceId, edge.targetId);
    const prev = baselineEdges.get(key);
    const sourceTitle = currentNodes.get(edge.sourceId)?.title
      ?? baselineNodes.get(edge.sourceId)?.title
      ?? edge.sourceId;
    const targetTitle = currentNodes.get(edge.targetId)?.title
      ?? baselineNodes.get(edge.targetId)?.title
      ?? edge.targetId;

    if (!prev) {
      addedEdges.push({
        key,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        sourceTitle,
        targetTitle,
        scoreBefore: null,
        scoreAfter: edge.score,
        delta: null,
      });
      continue;
    }

    const delta = edge.score - prev.score;
    if (Math.abs(delta) > EDGE_SCORE_EPSILON) {
      changedEdges.push({
        key,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        sourceTitle,
        targetTitle,
        scoreBefore: prev.score,
        scoreAfter: edge.score,
        delta,
      });
    }
  }

  for (const edge of baseline.edges) {
    const key = edgeKey(edge.sourceId, edge.targetId);
    if (currentEdges.has(key)) continue;

    const sourceTitle = currentNodes.get(edge.sourceId)?.title
      ?? baselineNodes.get(edge.sourceId)?.title
      ?? edge.sourceId;
    const targetTitle = currentNodes.get(edge.targetId)?.title
      ?? baselineNodes.get(edge.targetId)?.title
      ?? edge.targetId;

    removedEdges.push({
      key,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      sourceTitle,
      targetTitle,
      scoreBefore: edge.score,
      scoreAfter: null,
      delta: null,
    });
  }

  addedEdges.sort((a, b) => (b.scoreAfter ?? 0) - (a.scoreAfter ?? 0));
  removedEdges.sort((a, b) => (b.scoreBefore ?? 0) - (a.scoreBefore ?? 0));
  changedEdges.sort((a, b) => Math.abs((b.delta ?? 0)) - Math.abs((a.delta ?? 0)));

  return {
    requestedSince,
    effectiveSince,
    generatedAt: new Date().toISOString(),
    baselineSnapshot: {
      id: baseline.id,
      takenAt: baseline.takenAt,
      snapshotType: baseline.snapshotType,
    },
    warnings,
    summary: {
      baseline: {
        nodes: baseline.nodeCount,
        edges: baseline.edgeCount,
        tags: baseline.tagCount,
      },
      current: {
        nodes: current.nodeCount,
        edges: current.edgeCount,
        tags: current.tagCount,
      },
      nodesAdded: addedNodes.length,
      nodesRemoved: removedNodes.length,
      nodesUpdated: updatedNodes.length,
      edgesAdded: addedEdges.length,
      edgesRemoved: removedEdges.length,
      edgesChanged: changedEdges.length,
    },
    nodes: {
      added: toDiffSection(addedNodes, limit),
      removed: toDiffSection(removedNodes, limit),
      updated: toDiffSection(updatedNodes, limit),
    },
    edges: {
      added: toDiffSection(addedEdges, limit),
      removed: toDiffSection(removedEdges, limit),
      changed: toDiffSection(changedEdges, limit),
    },
  };
}

export async function getGraphGrowthCore(options: {
  since?: Date;
  until?: Date;
  limit?: number;
} = {}): Promise<GraphGrowthResult> {
  const now = new Date();
  const from = options.since ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = options.until ?? now;
  const limit = typeof options.limit === 'number' && Number.isFinite(options.limit)
    ? Math.max(1, Math.floor(options.limit))
    : 120;
  const warnings: string[] = [];

  const snapshotsDesc = await listGraphSnapshots({
    since: from.toISOString(),
    until: to.toISOString(),
  });

  let points: GraphGrowthPoint[] = snapshotsDesc
    .slice()
    .reverse()
    .map((snapshot) => ({
      takenAt: snapshot.takenAt,
      source: 'snapshot' as const,
      snapshotType: snapshot.snapshotType,
      nodeCount: snapshot.nodeCount,
      edgeCount: snapshot.edgeCount,
      tagCount: snapshot.tagCount,
    }));

  if (points.length === 0) {
    const bootstrap = await createGraphSnapshot('manual');
    points = [
      {
        takenAt: bootstrap.takenAt,
        source: 'snapshot',
        snapshotType: bootstrap.snapshotType,
        nodeCount: bootstrap.nodeCount,
        edgeCount: bootstrap.edgeCount,
        tagCount: bootstrap.tagCount,
      },
    ];
    warnings.push(
      `No snapshots existed in range. Captured bootstrap snapshot at ${bootstrap.takenAt}.`,
    );
  }

  const current = await getCurrentGraphSnapshotState();
  const latest = points[points.length - 1];
  const latestTime = latest ? new Date(latest.takenAt).getTime() : 0;
  const nowIso = now.toISOString();
  const isCurrentDifferent =
    !latest ||
    latest.nodeCount !== current.nodeCount ||
    latest.edgeCount !== current.edgeCount ||
    latest.tagCount !== current.tagCount;
  const isCurrentStale = !latest || now.getTime() - latestTime > 5 * 60 * 1000;

  if (isCurrentDifferent || isCurrentStale) {
    points.push({
      takenAt: nowIso,
      source: 'live',
      snapshotType: null,
      nodeCount: current.nodeCount,
      edgeCount: current.edgeCount,
      tagCount: current.tagCount,
    });
  }

  if (points.length > limit) {
    points = points.slice(points.length - limit);
    warnings.push(`Showing the most recent ${limit} points.`);
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const snapshotCount = points.filter((point) => point.source === 'snapshot').length;

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    generatedAt: nowIso,
    warnings,
    summary: {
      points: points.length,
      snapshots: snapshotCount,
      nodeDelta: last.nodeCount - first.nodeCount,
      edgeDelta: last.edgeCount - first.edgeCount,
      tagDelta: last.tagCount - first.tagCount,
    },
    points,
  };
}
