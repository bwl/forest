import { getBackend } from '../shared/remote';
import { formatId, handleError } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';

type ClercModule = typeof import('clerc');

type DiffFlags = {
  since?: string;
  limit?: number;
  json?: boolean;
  tldr?: string;
};

type GrowthFlags = {
  since?: string;
  until?: string;
  limit?: number;
  metric?: string;
  json?: boolean;
  tldr?: string;
};

type SnapshotFlags = {
  list?: boolean;
  limit?: number;
  since?: string;
  until?: string;
  snapshotType?: string;
  auto?: boolean;
  json?: boolean;
  tldr?: string;
};

export function createDiffCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'diff',
      description: 'Show graph changes since a point in time',
      flags: {
        since: { type: String, description: 'Baseline time (e.g. "1 week ago", "2026-01-01")' },
        limit: { type: Number, description: 'Max items per section', default: 25 },
        json: { type: Boolean, description: 'Emit JSON output' },
        tldr: { type: String, description: 'Output command metadata for agent consumption (--tldr or --tldr=json)' },
      },
    },
    async ({ flags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.diff, getVersion(), jsonMode);
        }
        await runDiff(flags as DiffFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

export function createGrowthCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'growth',
      description: 'Show graph growth over time from snapshots',
      flags: {
        since: { type: String, description: 'Start time (default: 30 days ago)' },
        until: { type: String, description: 'End time (default: now)' },
        limit: { type: Number, description: 'Max timeline points', default: 120 },
        metric: { type: String, description: 'nodes|edges|tags|all (default: all)' },
        json: { type: Boolean, description: 'Emit JSON output' },
        tldr: { type: String, description: 'Output command metadata for agent consumption (--tldr or --tldr=json)' },
      },
    },
    async ({ flags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.growth, getVersion(), jsonMode);
        }
        await runGrowth(flags as GrowthFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

export function createSnapshotCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'snapshot',
      description: 'Create or list graph snapshots',
      flags: {
        list: { type: Boolean, description: 'List snapshots instead of creating one' },
        auto: { type: Boolean, description: 'Create an auto-labeled snapshot (default: manual)' },
        snapshotType: { type: String, description: 'Filter type for --list: manual|auto' },
        since: { type: String, description: 'Filter snapshots since time' },
        until: { type: String, description: 'Filter snapshots until time' },
        limit: { type: Number, description: 'Max snapshots to list', default: 50 },
        json: { type: Boolean, description: 'Emit JSON output' },
        tldr: { type: String, description: 'Output command metadata for agent consumption (--tldr or --tldr=json)' },
      },
    },
    async ({ flags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.snapshot, getVersion(), jsonMode);
        }
        await runSnapshot(flags as SnapshotFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runDiff(flags: DiffFlags) {
  const backend = getBackend();
  const sinceRaw = flags.since ?? '1 week ago';
  const since = parseTimeExpression(sinceRaw);
  if (!since) {
    throw new Error(`Could not parse --since value: "${sinceRaw}"`);
  }

  const limit = normalizeInt(flags.limit, 25, 1, 200);
  const result = await backend.getGraphDiff({
    since: since.toISOString(),
    limit,
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('forest diff');
  console.log(`Requested since: ${result.requestedSince}`);
  if (result.effectiveSince !== result.requestedSince) {
    console.log(`Effective since: ${result.effectiveSince}`);
  }
  console.log(`Baseline snapshot: #${result.baselineSnapshot.id} (${result.baselineSnapshot.snapshotType}) @ ${result.baselineSnapshot.takenAt}`);
  console.log(`Generated: ${result.generatedAt}`);
  if (result.warnings.length > 0) {
    console.log('');
    for (const warning of result.warnings) {
      console.log(`⚠ ${warning}`);
    }
  }

  console.log('');
  console.log(
    `Nodes: +${result.summary.nodesAdded}  -${result.summary.nodesRemoved}  ~${result.summary.nodesUpdated}  (${result.summary.baseline.nodes} → ${result.summary.current.nodes})`,
  );
  console.log(
    `Edges: +${result.summary.edgesAdded}  -${result.summary.edgesRemoved}  ~${result.summary.edgesChanged}  (${result.summary.baseline.edges} → ${result.summary.current.edges})`,
  );
  console.log(`Tags : ${result.summary.baseline.tags} → ${result.summary.current.tags}`);

  printNodeSection('Added nodes', '+', result.nodes.added.items, result.nodes.added.truncated);
  printNodeSection('Removed nodes', '-', result.nodes.removed.items, result.nodes.removed.truncated);
  printNodeSection('Updated nodes', '~', result.nodes.updated.items, result.nodes.updated.truncated);

  printEdgeSection('Added edges', '+', result.edges.added.items, result.edges.added.truncated);
  printEdgeSection('Removed edges', '-', result.edges.removed.items, result.edges.removed.truncated);
  printEdgeSection('Changed edges', '~', result.edges.changed.items, result.edges.changed.truncated);
}

async function runGrowth(flags: GrowthFlags) {
  const backend = getBackend();
  const since = flags.since ? parseTimeExpression(flags.since) : undefined;
  if (flags.since && !since) {
    throw new Error(`Could not parse --since value: "${flags.since}"`);
  }
  const until = flags.until ? parseTimeExpression(flags.until) : undefined;
  if (flags.until && !until) {
    throw new Error(`Could not parse --until value: "${flags.until}"`);
  }
  const limit = normalizeInt(flags.limit, 120, 1, 500);

  const metricRaw = (flags.metric ?? 'all').toLowerCase();
  const metric: 'nodes' | 'edges' | 'tags' | 'all' =
    metricRaw === 'nodes' || metricRaw === 'edges' || metricRaw === 'tags'
      ? metricRaw
      : 'all';

  const result = await backend.getGraphGrowth({
    since: since?.toISOString(),
    until: until?.toISOString(),
    limit,
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('forest growth');
  console.log(`Range: ${result.from} -> ${result.to}`);
  console.log(`Generated: ${result.generatedAt}`);
  if (result.warnings.length > 0) {
    console.log('');
    for (const warning of result.warnings) {
      console.log(`⚠ ${warning}`);
    }
  }

  console.log('');
  console.log(`Points: ${result.summary.points} (${result.summary.snapshots} snapshots)`);
  console.log(`Delta: nodes ${signed(result.summary.nodeDelta)}, edges ${signed(result.summary.edgeDelta)}, tags ${signed(result.summary.tagDelta)}`);
  console.log('');
  console.log('Timeline:');
  console.log('  time                       kind       nodes   edges   tags');
  for (const point of result.points) {
    const kind = point.source === 'live' ? 'live' : point.snapshotType ?? 'snapshot';
    console.log(
      `  ${point.takenAt.padEnd(26, ' ')} ${kind.padEnd(9, ' ')} ${String(point.nodeCount).padStart(6, ' ')} ${String(point.edgeCount).padStart(7, ' ')} ${String(point.tagCount).padStart(6, ' ')}`,
    );
  }

  if (result.points.length > 1) {
    if (metric === 'all' || metric === 'nodes') {
      printMetricChart('Nodes', result.points.map((p) => ({ label: p.takenAt.slice(0, 10), value: p.nodeCount })));
    }
    if (metric === 'all' || metric === 'edges') {
      printMetricChart('Edges', result.points.map((p) => ({ label: p.takenAt.slice(0, 10), value: p.edgeCount })));
    }
    if (metric === 'all' || metric === 'tags') {
      printMetricChart('Tags', result.points.map((p) => ({ label: p.takenAt.slice(0, 10), value: p.tagCount })));
    }
  }
}

async function runSnapshot(flags: SnapshotFlags) {
  const backend = getBackend();

  if (flags.list) {
    const limit = normalizeInt(flags.limit, 50, 1, 500);
    const since = flags.since ? parseTimeExpression(flags.since) : undefined;
    if (flags.since && !since) {
      throw new Error(`Could not parse --since value: "${flags.since}"`);
    }
    const until = flags.until ? parseTimeExpression(flags.until) : undefined;
    if (flags.until && !until) {
      throw new Error(`Could not parse --until value: "${flags.until}"`);
    }

    const snapshotTypeRaw = flags.snapshotType?.toLowerCase();
    const snapshotType: 'manual' | 'auto' | undefined =
      snapshotTypeRaw === 'manual' || snapshotTypeRaw === 'auto'
        ? snapshotTypeRaw
        : undefined;

    const result = await backend.listGraphSnapshots({
      limit,
      since: since?.toISOString(),
      until: until?.toISOString(),
      snapshotType,
    });

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`forest snapshot --list (${result.total} shown)`);
    if (result.snapshots.length === 0) {
      console.log('No snapshots found.');
      return;
    }
    console.log('  id    taken_at                  type    nodes  edges  tags');
    for (const snapshot of result.snapshots) {
      console.log(
        `  ${String(snapshot.id).padStart(4, ' ')}  ${snapshot.takenAt}  ${snapshot.snapshotType.padEnd(6, ' ')}  ${String(snapshot.nodeCount).padStart(5, ' ')}  ${String(snapshot.edgeCount).padStart(5, ' ')}  ${String(snapshot.tagCount).padStart(4, ' ')}`,
      );
    }
    return;
  }

  const snapshotType: 'manual' | 'auto' = flags.auto ? 'auto' : 'manual';
  const result = await backend.createGraphSnapshot({ snapshotType });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const snapshot = result.snapshot;
  console.log(`✔ Captured ${snapshot.snapshotType} snapshot #${snapshot.id}`);
  console.log(`   taken_at: ${snapshot.takenAt}`);
  console.log(`   nodes: ${snapshot.nodeCount}, edges: ${snapshot.edgeCount}, tags: ${snapshot.tagCount}`);
}

function parseTimeExpression(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const now = new Date();

  if (lower === 'now') {
    return now;
  }
  if (lower === 'today') {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    return date;
  }
  if (lower === 'yesterday') {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  const agoMatch = /^(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|months?|mos?|years?|yrs?|y)\s*ago$/.exec(lower);
  if (agoMatch) {
    const amount = Number.parseInt(agoMatch[1]!, 10);
    const unit = agoMatch[2]!;
    return subtractFromNow(amount, unit, now);
  }

  const shortMatch = /^(\d+)\s*(s|m|h|d|w|mo|y)$/.exec(lower);
  if (shortMatch) {
    const amount = Number.parseInt(shortMatch[1]!, 10);
    const unit = shortMatch[2]!;
    return subtractFromNow(amount, unit, now);
  }

  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00.000Z` : trimmed;
  const parsed = new Date(iso);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function subtractFromNow(amount: number, rawUnit: string, now: Date): Date {
  const unit = rawUnit.toLowerCase();
  const date = new Date(now);

  if (unit === 's' || unit.startsWith('sec')) {
    date.setSeconds(date.getSeconds() - amount);
    return date;
  }
  if (unit === 'm' || unit.startsWith('min')) {
    date.setMinutes(date.getMinutes() - amount);
    return date;
  }
  if (unit === 'h' || unit.startsWith('hr') || unit.startsWith('hour')) {
    date.setHours(date.getHours() - amount);
    return date;
  }
  if (unit === 'd' || unit.startsWith('day')) {
    date.setDate(date.getDate() - amount);
    return date;
  }
  if (unit === 'w' || unit.startsWith('week')) {
    date.setDate(date.getDate() - amount * 7);
    return date;
  }
  if (unit === 'mo' || unit.startsWith('month')) {
    date.setMonth(date.getMonth() - amount);
    return date;
  }
  if (unit === 'y' || unit.startsWith('yr') || unit.startsWith('year')) {
    date.setFullYear(date.getFullYear() - amount);
    return date;
  }

  date.setDate(date.getDate() - amount);
  return date;
}

function normalizeInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function printNodeSection(
  title: string,
  prefix: string,
  items: Array<{ id: string; title: string; updatedAt: string }>,
  truncated: number,
) {
  console.log('');
  console.log(`${title}:`);
  if (items.length === 0) {
    console.log('  (none)');
    return;
  }
  for (const item of items) {
    console.log(`  ${prefix} ${formatId(item.id)}  ${item.title}  (${item.updatedAt})`);
  }
  if (truncated > 0) {
    console.log(`  ... ${truncated} more`);
  }
}

function printEdgeSection(
  title: string,
  prefix: string,
  items: Array<{
    sourceId: string;
    targetId: string;
    sourceTitle: string;
    targetTitle: string;
    scoreBefore: number | null;
    scoreAfter: number | null;
    delta: number | null;
  }>,
  truncated: number,
) {
  console.log('');
  console.log(`${title}:`);
  if (items.length === 0) {
    console.log('  (none)');
    return;
  }
  for (const item of items) {
    const left = `${formatId(item.sourceId)} "${truncate(item.sourceTitle, 24)}"`;
    const right = `${formatId(item.targetId)} "${truncate(item.targetTitle, 24)}"`;
    const scoreText =
      item.scoreBefore !== null && item.scoreAfter !== null
        ? `${item.scoreBefore.toFixed(3)} -> ${item.scoreAfter.toFixed(3)} (${signed(item.delta ?? 0, 3)})`
        : item.scoreAfter !== null
          ? `${item.scoreAfter.toFixed(3)}`
          : item.scoreBefore !== null
            ? `${item.scoreBefore.toFixed(3)}`
            : '-';
    console.log(`  ${prefix} ${left} -> ${right}  ${scoreText}`);
  }
  if (truncated > 0) {
    console.log(`  ... ${truncated} more`);
  }
}

function printMetricChart(title: string, points: Array<{ label: string; value: number }>) {
  console.log('');
  console.log(`${title} trend:`);
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const width = 28;
  for (const point of points) {
    const filled = Math.round((point.value / maxValue) * width);
    const bar = '#'.repeat(filled).padEnd(width, '.');
    console.log(`  ${point.label} |${bar}| ${point.value}`);
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function signed(value: number, precision = 0): string {
  const fixed = value.toFixed(precision);
  return value >= 0 ? `+${fixed}` : fixed;
}
