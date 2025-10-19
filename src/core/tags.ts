import { NodeRecord, listNodes, updateNodeIndexData } from '../lib/db';
import { eventBus } from '../server/events/eventBus';

export type TagWithCount = {
  name: string;
  count: number;
  lastUsed: string;
};

export type ListTagsOptions = {
  sort?: 'name' | 'count';
  order?: 'asc' | 'desc';
};

export type ListTagsResult = {
  tags: TagWithCount[];
  total: number;
};

export type GetNodesByTagOptions = {
  limit?: number;
  offset?: number;
};

export type GetNodesByTagResult = {
  tag: string;
  nodes: NodeRecord[];
  total: number;
};

export type RenameTagResult = {
  from: string;
  to: string;
  nodesAffected: number;
};

export type TagCoOccurrence = {
  tag: string;
  count: number;
};

export type TagStatsOptions = {
  focusTag?: string;
  minCount?: number;
  top?: number;
};

export type TagStatsResult = {
  totalTags: number;
  topTags: TagWithCount[];
  coOccurrences?: TagCoOccurrence[];
};

export async function listTagsCore(options: ListTagsOptions = {}): Promise<ListTagsResult> {
  const nodes = await listNodes();
  const tagMap = new Map<string, { count: number; lastUsed: string }>();

  // Build tag counts and last used timestamps
  for (const node of nodes) {
    for (const tag of node.tags) {
      const existing = tagMap.get(tag);
      if (!existing) {
        tagMap.set(tag, {
          count: 1,
          lastUsed: node.updatedAt,
        });
      } else {
        existing.count += 1;
        // Update lastUsed if this node is more recent
        if (new Date(node.updatedAt) > new Date(existing.lastUsed)) {
          existing.lastUsed = node.updatedAt;
        }
      }
    }
  }

  // Convert to array
  let tags: TagWithCount[] = Array.from(tagMap.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    lastUsed: data.lastUsed,
  }));

  // Apply sorting
  const sort = options.sort ?? 'count';
  const order = options.order ?? 'desc';

  tags.sort((a, b) => {
    let comparison = 0;

    if (sort === 'count') {
      comparison = a.count - b.count;
    } else if (sort === 'name') {
      comparison = a.name.localeCompare(b.name);
    }

    return order === 'asc' ? comparison : -comparison;
  });

  return {
    tags,
    total: tags.length,
  };
}

export async function getNodesByTagCore(
  tagName: string,
  options: GetNodesByTagOptions = {},
): Promise<GetNodesByTagResult> {
  const nodes = await listNodes();
  const taggedNodes = nodes.filter((node) => node.tags.includes(tagName));

  // Sort by updated date descending
  taggedNodes.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const total = taggedNodes.length;

  // Apply pagination
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const paginatedNodes = taggedNodes.slice(offset, offset + limit);

  return {
    tag: tagName,
    nodes: paginatedNodes,
    total,
  };
}

export async function renameTagCore(
  oldName: string,
  newName: string,
): Promise<RenameTagResult> {
  if (!oldName || !newName) {
    throw new Error('Both old and new tag names are required');
  }

  if (oldName === newName) {
    throw new Error('Old and new tag names must be different');
  }

  const nodes = await listNodes();
  let nodesAffected = 0;

  for (const node of nodes) {
    if (node.tags.includes(oldName)) {
      const updatedTags = node.tags.map((tag) => (tag === oldName ? newName : tag));
      await updateNodeIndexData(node.id, updatedTags, node.tokenCounts);
      nodesAffected += 1;
    }
  }

  // Emit event
  eventBus.emitTagRenamed(oldName, newName, nodesAffected);

  return {
    from: oldName,
    to: newName,
    nodesAffected,
  };
}

export async function getTagStatsCore(
  options: TagStatsOptions = {},
): Promise<TagStatsResult> {
  const nodes = await listNodes();
  const tagCounts = new Map<string, { count: number; lastUsed: string }>();

  // Build tag counts
  for (const node of nodes) {
    for (const tag of node.tags) {
      const existing = tagCounts.get(tag);
      if (!existing) {
        tagCounts.set(tag, {
          count: 1,
          lastUsed: node.updatedAt,
        });
      } else {
        existing.count += 1;
        if (new Date(node.updatedAt) > new Date(existing.lastUsed)) {
          existing.lastUsed = node.updatedAt;
        }
      }
    }
  }

  // Convert to array and filter by minCount
  const minCount = options.minCount ?? 0;
  let tags: TagWithCount[] = Array.from(tagCounts.entries())
    .filter(([_, data]) => data.count >= minCount)
    .map(([name, data]) => ({
      name,
      count: data.count,
      lastUsed: data.lastUsed,
    }));

  // Sort by count descending
  tags.sort((a, b) => b.count - a.count);

  // Limit to top N
  const top = options.top ?? 10;
  const topTags = tags.slice(0, top);

  // Compute co-occurrences if focusTag is specified
  let coOccurrences: TagCoOccurrence[] | undefined;

  if (options.focusTag) {
    const coOccurrenceMap = new Map<string, number>();
    const focusNodes = nodes.filter((node) => node.tags.includes(options.focusTag!));

    for (const node of focusNodes) {
      for (const tag of node.tags) {
        if (tag !== options.focusTag) {
          coOccurrenceMap.set(tag, (coOccurrenceMap.get(tag) ?? 0) + 1);
        }
      }
    }

    coOccurrences = Array.from(coOccurrenceMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .filter((item) => item.count >= minCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, top);
  }

  return {
    totalTags: tags.length,
    topTags,
    coOccurrences,
  };
}
