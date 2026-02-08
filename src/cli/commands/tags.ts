import { formatId, handleError } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { colorize } from '../formatters';
import { getBackend } from '../shared/remote';

import type { HandlerContext } from '@clerc/core';

type ClercModule = typeof import('clerc');
type ClercInstance = ReturnType<ClercModule['Clerc']['create']>;

type TagsListFlags = {
  top?: number;
  json?: boolean;
  tldr?: string;
};

type TagsStatsFlags = {
  tag?: string;
  minCount?: number;
  top?: number;
  json?: boolean;
  tldr?: string;
};

export type TagsModifyFlags = {
  json?: boolean;
  tldr?: string;
};

export function registerTagsCommands(cli: ClercInstance, clerc: ClercModule) {
  const addCommand = clerc.defineCommand(
    {
      name: 'tags add',
      description: 'Add one or more tags to a note',
      parameters: ['<ref>', '<tags>'],
      flags: {
        json: {
          type: Boolean,
          description: 'Emit JSON output',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ parameters, flags }: { parameters: { ref?: string; tags?: string }; flags: TagsModifyFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['tags.add'], getVersion(), jsonMode);
        }
        await runTagsAdd(parameters.ref, parameters.tags, flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(addCommand);

  const removeCommand = clerc.defineCommand(
    {
      name: 'tags remove',
      description: 'Remove one or more tags from a note',
      parameters: ['<ref>', '<tags>'],
      flags: {
        json: {
          type: Boolean,
          description: 'Emit JSON output',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ parameters, flags }: { parameters: { ref?: string; tags?: string }; flags: TagsModifyFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['tags.remove'], getVersion(), jsonMode);
        }
        await runTagsRemove(parameters.ref, parameters.tags, flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(removeCommand);

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
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }: { flags: TagsListFlags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['tags.list'], getVersion(), jsonMode);
        }
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
      flags: {
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ parameters, flags }: { parameters: { old?: string; next?: string }; flags?: { tldr?: string } }) => {
      try {
        // Handle TLDR request first
        if (flags?.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['tags.rename'], getVersion(), jsonMode);
        }
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
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }: { flags: TagsStatsFlags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['tags.stats'], getVersion(), jsonMode);
        }
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
          '  add     Add tag(s) to a note',
          '  remove  Remove tag(s) from a note',
          '  list    List tags with usage counts',
          '  rename  Rename a tag across all notes',
          '  stats   Show tag co-occurrence statistics',
          '',
          'Use `forest tags <subcommand> --help` for flag details.',
        ],
        examples: [
          ['$ forest tags list', 'Show the most common tags'],
          ['$ forest tags add @0 to-review', 'Add a tag to the most recent note'],
          ['$ forest tags rename old new', 'Rename a tag across all notes'],
        ],
      },
      flags: {
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async (ctx: HandlerContext) => {
      try {
        // Handle TLDR request first
        if ((ctx as any).flags?.tldr !== undefined) {
          const jsonMode = (ctx as any).flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.tags, getVersion(), jsonMode);
        }
        await runTagsDashboard();
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(baseCommand);
}

async function runTagsDashboard() {
  const backend = getBackend();
  const result = await backend.listTags({ sort: 'count', order: 'desc' });

  const totalTags = result.total;
  const topTags = result.tags.slice(0, 10);

  console.log('');
  console.log(`Total unique tags: ${totalTags}`);
  console.log('');

  if (topTags.length > 0) {
    console.log('Top 10 tags:');
    console.log('');
    topTags.forEach((item) => {
      console.log(`  ${String(item.count).padStart(3, ' ')}  ${item.name}`);
    });
    console.log('');
  }

  console.log('Quick actions:');
  console.log('  forest tags add <ref> <tag>        Add a tag to a note');
  console.log('  forest tags remove <ref> <tag>     Remove a tag from a note');
  console.log('  forest tags list                 List all tags');
  console.log('  forest tags stats                Tag co-occurrence stats');
  console.log('  forest tags rename <old> <new>   Rename a tag');
  console.log('');
}

function parseTagList(value: string | undefined): string[] {
  if (typeof value !== 'string') return [];
  return Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .map((tag) => (tag.startsWith('#') ? tag.slice(1) : tag))
        .map((tag) => tag.toLowerCase()),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export async function runTagsAdd(ref: string | undefined, tagsArg: string | undefined, flags: TagsModifyFlags) {
  if (!ref) {
    console.error('✖ Provide a node reference.');
    process.exitCode = 1;
    return;
  }

  const tags = parseTagList(tagsArg);
  if (tags.length === 0) {
    console.error('✖ Provide one or more tags (comma-separated).');
    process.exitCode = 1;
    return;
  }

  const backend = getBackend();
  const result = await backend.addTags(ref, tags);

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`${colorize.success('✔')} Added ${tags.length} tag(s) to ${result.nodeId.slice(0, 8)}`);
  console.log(`   ${colorize.label('tags:')} ${result.tags.map((t) => colorize.tag(t)).join(', ')}`);
}

async function runTagsRemove(ref: string | undefined, tagsArg: string | undefined, flags: TagsModifyFlags) {
  if (!ref) {
    console.error('✖ Provide a node reference.');
    process.exitCode = 1;
    return;
  }

  const tags = parseTagList(tagsArg);
  if (tags.length === 0) {
    console.error('✖ Provide one or more tags (comma-separated).');
    process.exitCode = 1;
    return;
  }

  const backend = getBackend();
  const result = await backend.removeTags(ref, tags);

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.removed.length === 0) {
    console.log(`${colorize.info('ℹ')} No matching tags to remove on ${result.nodeId.slice(0, 8)}`);
    return;
  }

  console.log(`${colorize.success('✔')} Removed ${result.removed.length} tag(s) from ${result.nodeId.slice(0, 8)}`);
  console.log(`   ${colorize.label('tags:')} ${result.tags.map((t) => colorize.tag(t)).join(', ') || '(none)'}`);
}

async function runTagsList(flags: TagsListFlags) {
  const backend = getBackend();
  const result = await backend.listTags({ sort: 'count', order: 'desc' });

  let items = result.tags;
  const limit = typeof flags.top === 'number' && Number.isFinite(flags.top) && flags.top > 0 ? Math.floor(flags.top) : undefined;
  if (typeof limit === 'number') {
    items = items.slice(0, limit);
  }

  if (flags.json) {
    console.log(JSON.stringify(items.map((t) => ({ tag: t.name, count: t.count })), null, 2));
    return;
  }

  if (items.length === 0) {
    console.log('No tags found.');
    return;
  }

  const maxCount = items.length > 0 ? items[0].count : 1;
  items.forEach((item) => {
    const coloredCount = colorize.count(item.count, maxCount);
    const coloredTag = colorize.tag(item.name);
    console.log(`${String(item.count).padStart(3, ' ')} ${coloredCount}  ${coloredTag}`);
  });
}

async function runTagsRename(oldTag: string | undefined, nextTag: string | undefined) {
  if (!oldTag || !nextTag) {
    console.error('✖ Provide both the existing tag and the new tag.');
    process.exitCode = 1;
    return;
  }

  const backend = getBackend();
  const result = await backend.renameTag(oldTag, nextTag);
  console.log(`${colorize.success('✔')} Renamed tag '${colorize.tag(oldTag)}' to '${colorize.tag(nextTag)}' on ${result.renamed.nodesAffected} notes`);
}

async function runTagsStats(flags: TagsStatsFlags) {
  const backend = getBackend();
  const trimmedTag = typeof flags.tag === 'string' ? flags.tag.trim() : '';
  const result = await backend.getTagStats({
    focusTag: trimmedTag.length > 0 ? trimmedTag : undefined,
    minCount: flags.minCount,
    top: flags.top,
  });

  if (flags.json) {
    if (trimmedTag.length > 0) {
      console.log(JSON.stringify({ tag: trimmedTag, coTags: result.coOccurrences ?? [] }, null, 2));
    } else {
      console.log(JSON.stringify({ topTags: result.topTags, topPairs: [] }, null, 2));
    }
    return;
  }

  if (trimmedTag.length > 0 && result.coOccurrences) {
    if (result.coOccurrences.length === 0) {
      console.log(`No co-occurring tags for '${trimmedTag}'.`);
      return;
    }
    console.log(`Top co-occurring tags with '${trimmedTag}':`);
    result.coOccurrences.forEach((item) => console.log(`  ${String(item.count).padStart(3, ' ')}  ${item.tag}`));
    return;
  }

  if (result.topTags.length > 0) {
    console.log('Top tags:');
    result.topTags.forEach((entry) => {
      console.log(`  ${String(entry.count).padStart(3, ' ')}  ${entry.name}`);
    });
    console.log('');
  } else {
    console.log('No tag pairs found.');
  }
}
