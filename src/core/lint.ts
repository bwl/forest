import { listNodes, NodeRecord } from '../lib/db';
import { listTagsCore, TagWithCount } from './tags';

export type LintIssueType =
  | 'orphan_tag'        // tag used by only 1 node
  | 'possible_typo'     // two tags within edit distance 1
  | 'long_title'        // title > 120 chars
  | 'tag_sprawl'        // node has > 15 tags
  | 'empty_body'        // node body is empty/whitespace-only
  | 'missing_tags';     // node has zero tags

export type LintIssue = {
  type: LintIssueType;
  message: string;
  nodeId?: string;
  nodeTitle?: string;
  tag?: string;
  suggestion?: string;
};

export type LintResult = {
  issues: LintIssue[];
  nodesChecked: number;
  tagsChecked: number;
};

export type LintOptions = {
  fix?: boolean;
};

/**
 * Simple Levenshtein distance for short strings (tags)
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export async function lintCore(options: LintOptions = {}): Promise<LintResult> {
  const nodes = await listNodes();
  const { tags: tagList } = await listTagsCore({ sort: 'count', order: 'desc' });
  const issues: LintIssue[] = [];

  // --- Per-node checks ---
  for (const node of nodes) {
    // Empty body
    if (!node.body || node.body.trim().length === 0) {
      issues.push({
        type: 'empty_body',
        message: `Node has empty body`,
        nodeId: node.id,
        nodeTitle: node.title,
      });
    }

    // Long title
    if (node.title && node.title.length > 120) {
      issues.push({
        type: 'long_title',
        message: `Title is ${node.title.length} chars (>120)`,
        nodeId: node.id,
        nodeTitle: node.title.slice(0, 60) + '...',
        suggestion: 'Consider shortening the title',
      });
    }

    // Tag sprawl
    if (node.tags.length > 15) {
      issues.push({
        type: 'tag_sprawl',
        message: `Node has ${node.tags.length} tags (>15)`,
        nodeId: node.id,
        nodeTitle: node.title,
        suggestion: 'Consider removing less relevant tags',
      });
    }

    // Missing tags
    if (node.tags.length === 0) {
      issues.push({
        type: 'missing_tags',
        message: `Node has no tags`,
        nodeId: node.id,
        nodeTitle: node.title,
        suggestion: 'Run `forest tag <id> <tags>` to add tags',
      });
    }
  }

  // --- Global tag checks ---

  // Orphan tags (count === 1)
  for (const tag of tagList) {
    if (tag.count === 1) {
      issues.push({
        type: 'orphan_tag',
        message: `Tag "${tag.name}" is used by only 1 node`,
        tag: tag.name,
        suggestion: 'May be a typo or overly specific tag',
      });
    }
  }

  // Possible typos (edit distance 1 between different tags)
  const tagNames = tagList.map((t) => t.name);
  const typosSeen = new Set<string>();
  for (let i = 0; i < tagNames.length; i++) {
    for (let j = i + 1; j < tagNames.length; j++) {
      const a = tagNames[i];
      const b = tagNames[j];
      // Skip if lengths differ by more than 1 (can't be edit distance 1)
      if (Math.abs(a.length - b.length) > 1) continue;
      // Skip very short tags (2-3 char tags often legitimately differ by 1)
      if (a.length <= 3 || b.length <= 3) continue;
      const key = [a, b].sort().join('::');
      if (typosSeen.has(key)) continue;
      if (levenshtein(a, b) === 1) {
        typosSeen.add(key);
        issues.push({
          type: 'possible_typo',
          message: `Tags "${a}" and "${b}" differ by 1 edit`,
          tag: a,
          suggestion: `forest tags rename ${a} ${b}  (or vice versa)`,
        });
      }
    }
  }

  return {
    issues,
    nodesChecked: nodes.length,
    tagsChecked: tagList.length,
  };
}
