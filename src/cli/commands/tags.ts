import { listNodes, updateNodeIndexData } from '../../lib/db';

import { handleError } from '../shared/utils';

import type { HandlerContext } from '@clerc/core';

type ClercModule = typeof import('clerc');
type ClercInstance = ReturnType<ClercModule['Clerc']['create']>;

type TagsListFlags = {
  top?: number;
  json?: boolean;
};

type TagsStatsFlags = {
  tag?: string;
  minCount?: number;
  top?: number;
  json?: boolean;
};

export function registerTagsCommands(cli: ClercInstance, clerc: ClercModule) {
  const listCommand = clerc.defineCommand(
    {
      name: 'tags list',
      description: 'List tags with usage counts',
      flags: {
        top: {
          type: Number,
          description: 'Limit to top N',
        },
        json: {
          type: Boolean,
          description: 'Emit JSON output',
        },
      },
    },
    async ({ flags }: { flags: TagsListFlags }) => {
      try {
        await runTagsList(flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(listCommand);

  const renameCommand = clerc.defineCommand(
    {
      name: 'tags rename',
      description: 'Rename a tag across all notes',
      parameters: ['<old>', '<next>'],
    },
    async ({ parameters }: { parameters: { old?: string; next?: string } }) => {
      try {
        await runTagsRename(parameters.old, parameters.next);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(renameCommand);

  const statsCommand = clerc.defineCommand(
    {
      name: 'tags stats',
      description: 'Show tag co-occurrence statistics',
      flags: {
        tag: {
          type: String,
          description: 'Focus on a single tag and show co-occurring tags',
        },
        minCount: {
          type: Number,
          description: 'Only show items with count >= N',
          default: 0,
        },
        top: {
          type: Number,
          description: 'Top N results to show',
          default: 10,
        },
        json: {
          type: Boolean,
          description: 'Emit JSON output',
        },
      },
    },
    async ({ flags }: { flags: TagsStatsFlags }) => {
      try {
        await runTagsStats(flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(statsCommand);

  const baseCommand = clerc.defineCommand(
    {
      name: 'tags',
      description: 'Tag management',
      help: {
        notes: [
          'Subcommands:',
          '  list    List tags with usage counts',
          '  rename  Rename a tag across all notes',
          '  stats   Show tag co-occurrence statistics',
          '',
          'Use `forest tags <subcommand> --help` for flag details.',
        ],
        examples: [
          ['$ forest tags list', 'Show the most common tags'],
          ['$ forest tags rename old new', 'Rename a tag across all notes'],
        ],
      },
    },
    async (_ctx: HandlerContext) => {
      try {
        await runTagsDashboard();
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(baseCommand);
}

async function runTagsDashboard() {
  const nodes = await listNodes();
  const counts = new Map<string, number>();
  for (const node of nodes) {
    for (const tag of node.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  const totalTags = counts.size;
  const topTags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  console.log('');
  console.log(`Total unique tags: ${totalTags}`);
  console.log('');

  if (topTags.length > 0) {
    console.log('Top 10 tags:');
    console.log('');
    topTags.forEach(([tag, count]) => {
      console.log(`  ${String(count).padStart(3, ' ')}  ${tag}`);
    });
    console.log('');
  }

  console.log('Quick actions:');
  console.log('  forest tags list                 List all tags');
  console.log('  forest tags stats                Tag co-occurrence stats');
  console.log('  forest tags rename <old> <new>   Rename a tag');
  console.log('');
}

async function runTagsList(flags: TagsListFlags) {
  const nodes = await listNodes();
  const counts = new Map<string, number>();
  for (const node of nodes) {
    for (const tag of node.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  let items = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const limit =
    typeof flags.top === 'number' && Number.isFinite(flags.top) && flags.top > 0 ? Math.floor(flags.top) : undefined;
  if (typeof limit === 'number') {
    items = items.slice(0, limit);
  }

  if (flags.json) {
    console.log(JSON.stringify(items.map(([tag, count]) => ({ tag, count })), null, 2));
    return;
  }

  if (items.length === 0) {
    console.log('No tags found.');
    return;
  }

  items.forEach(([tag, count]) => {
    console.log(`${String(count).padStart(3, ' ')}  ${tag}`);
  });
}

async function runTagsRename(oldTag: string | undefined, nextTag: string | undefined) {
  if (!oldTag || !nextTag) {
    console.error('✖ Provide both the existing tag and the new tag.');
    process.exitCode = 1;
    return;
  }

  const nodes = await listNodes();
  let changed = 0;
  for (const node of nodes) {
    if (!node.tags.includes(oldTag)) continue;
    const next = Array.from(new Set(node.tags.map((tag) => (tag === oldTag ? nextTag : tag))));
    await updateNodeIndexData(node.id, next, node.tokenCounts);
    changed += 1;
  }

  console.log(`✔ Renamed tag '${oldTag}' to '${nextTag}' on ${changed} notes`);
}

async function runTagsStats(flags: TagsStatsFlags) {
  const nodes = await listNodes();
  const min =
    typeof flags.minCount === 'number' && Number.isFinite(flags.minCount) ? Math.max(0, Math.floor(flags.minCount)) : 0;
  const top =
    typeof flags.top === 'number' && Number.isFinite(flags.top) && flags.top > 0 ? Math.floor(flags.top) : 10;
  const tagCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();

  for (const node of nodes) {
    const uniqueTags = Array.from(new Set(node.tags));
    for (const tag of uniqueTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    for (let i = 0; i < uniqueTags.length; i += 1) {
      for (let j = i + 1; j < uniqueTags.length; j += 1) {
        const a = uniqueTags[i];
        const b = uniqueTags[j];
        const key = a < b ? `${a}::${b}` : `${b}::${a}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const trimmedTag = typeof flags.tag === 'string' ? flags.tag.trim() : '';
  if (trimmedTag.length > 0) {
    const items: Array<{ tag: string; count: number }> = [];
    for (const [pair, count] of pairCounts.entries()) {
      const [a, b] = pair.split('::');
      if (a === trimmedTag) items.push({ tag: b, count });
      else if (b === trimmedTag) items.push({ tag: a, count });
    }
    const filtered = items.filter((item) => item.count >= min);
    const ranked = filtered.sort((a, b) => b.count - a.count).slice(0, top);
    if (flags.json) {
      console.log(JSON.stringify({ tag: trimmedTag, coTags: ranked }, null, 2));
      return;
    }
    if (ranked.length === 0) {
      console.log(`No co-occurring tags for '${trimmedTag}'.`);
      return;
    }
    console.log(`Top co-occurring tags with '${trimmedTag}':`);
    ranked.forEach((item) => console.log(`  ${String(item.count).padStart(3, ' ')}  ${item.tag}`));
    return;
  }

  const topTags = [...tagCounts.entries()]
    .filter(([, count]) => count >= min)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([tag, count]) => ({ tag, count }));
  const topPairs = [...pairCounts.entries()]
    .filter(([, count]) => count >= min)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([pair, count]) => ({ pair, count }));

  if (flags.json) {
    console.log(JSON.stringify({ topTags, topPairs }, null, 2));
    return;
  }

  if (topTags.length > 0) {
    console.log('Top tags:');
    topTags.forEach((entry) => {
      console.log(`  ${String(entry.count).padStart(3, ' ')}  ${entry.tag}`);
    });
    console.log('');
  }
  if (topPairs.length > 0) {
    console.log('Top tag pairs:');
    topPairs.forEach((entry) => {
      console.log(`  ${String(entry.count).padStart(3, ' ')}  ${entry.pair.replace('::', ' + ')}`);
    });
  } else if (topTags.length === 0) {
    console.log('No tag pairs found.');
  }
}
