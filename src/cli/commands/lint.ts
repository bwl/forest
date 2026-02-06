import { lintCore, LintIssue, LintIssueType } from '../../core/lint';
import { formatId, handleError } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { colorize } from '../formatters';

type ClercModule = typeof import('clerc');

type LintFlags = {
  json?: boolean;
  type?: string;
  tldr?: string;
};

export function createLintCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'lint',
      description: 'Check tag and note hygiene, report issues',
      flags: {
        json: {
          type: Boolean,
          description: 'Emit JSON output',
        },
        type: {
          type: String,
          description: 'Filter by issue type (orphan_tag, possible_typo, long_title, tag_sprawl, empty_body, missing_tags)',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.lint, getVersion(), jsonMode);
        }
        await runLint(flags as LintFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runLint(flags: LintFlags) {
  const result = await lintCore();

  let issues = result.issues;

  // Filter by type if specified
  if (flags.type) {
    issues = issues.filter((issue) => issue.type === flags.type);
  }

  if (flags.json) {
    console.log(JSON.stringify({
      nodesChecked: result.nodesChecked,
      tagsChecked: result.tagsChecked,
      totalIssues: issues.length,
      issues,
    }, null, 2));
    return;
  }

  // Text output
  console.log(`Checked ${result.nodesChecked} nodes, ${result.tagsChecked} tags\n`);

  if (issues.length === 0) {
    console.log(`${colorize.success('✔')} No issues found`);
    return;
  }

  // Group by type
  const grouped = new Map<LintIssueType, LintIssue[]>();
  for (const issue of issues) {
    const list = grouped.get(issue.type) ?? [];
    list.push(issue);
    grouped.set(issue.type, list);
  }

  const typeLabels: Record<LintIssueType, string> = {
    orphan_tag: 'Orphan tags (used by only 1 node)',
    possible_typo: 'Possible typos',
    long_title: 'Long titles',
    tag_sprawl: 'Tag sprawl (>15 tags)',
    empty_body: 'Empty bodies',
    missing_tags: 'Missing tags',
  };

  for (const [type, group] of grouped) {
    console.log(`${typeLabels[type]} (${group.length}):`);
    for (const issue of group.slice(0, 20)) {
      const prefix = issue.nodeId ? `  ${colorize.nodeId(formatId(issue.nodeId))}` : ' ';
      console.log(`${prefix} ${issue.message}`);
      if (issue.suggestion) {
        console.log(`${' '.repeat(prefix.length)} ${colorize.label('fix:')} ${issue.suggestion}`);
      }
    }
    if (group.length > 20) {
      console.log(`  ... and ${group.length - 20} more`);
    }
    console.log('');
  }

  console.log(`Total: ${issues.length} issue(s)`);
}
