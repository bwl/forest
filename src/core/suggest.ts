import fs from 'fs';
import path from 'path';
import { listNodes, NodeRecord } from '../lib/db';
import { semanticSearchCore } from './search';
import { getEmbeddingProvider } from '../lib/embeddings';

export type SuggestionMatchType = 'tag' | 'semantic';

export type Suggestion = {
  id: string;
  shortId: string;
  title: string;
  tags: string[];
  excerpt: string;
  matchType: SuggestionMatchType;
  score: number | null;
};

export type SuggestResult = {
  project: string;
  source: 'flag' | 'package.json' | 'git' | 'basename';
  suggestions: Suggestion[];
  total: number;
};

export type SuggestOptions = {
  project?: string;
  cwd?: string;
  limit?: number;
};

/**
 * Detect the project name from the working directory.
 * Checks in order: package.json name, git folder name, directory basename.
 */
export function detectProject(cwd: string): { name: string; source: SuggestResult['source'] } | null {
  // 1. package.json → name field
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (typeof pkg.name === 'string' && pkg.name.trim()) {
        return { name: pkg.name.trim(), source: 'package.json' };
      }
    } catch {
      // Malformed package.json, fall through
    }
  }

  // 2. .git directory → use folder name as repo name
  const gitDir = path.join(cwd, '.git');
  if (fs.existsSync(gitDir)) {
    const folderName = path.basename(cwd);
    if (folderName) {
      return { name: folderName, source: 'git' };
    }
  }

  // 3. Fall back to directory basename
  const basename = path.basename(cwd);
  if (basename) {
    return { name: basename, source: 'basename' };
  }

  return null;
}

/**
 * Generate an excerpt from the body text.
 * Returns the first ~80 chars, trimmed to a word boundary.
 */
function makeExcerpt(body: string, maxLen = 80): string {
  if (!body) return '';
  // Collapse whitespace and trim
  const clean = body.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  // Trim to last space before maxLen
  const trimmed = clean.slice(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(' ');
  return (lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed) + '...';
}

/**
 * Filter tags for display: skip project:* and link/* prefixes.
 * Returns up to `max` tags.
 */
function displayTags(tags: string[], max = 3): string[] {
  return tags
    .filter((t) => !t.startsWith('project:') && !t.startsWith('link/'))
    .slice(0, max);
}

function nodeToSuggestion(node: NodeRecord, matchType: SuggestionMatchType, score: number | null): Suggestion {
  return {
    id: node.id,
    shortId: node.id.split('-')[0] ?? node.id.slice(0, 8),
    title: node.title,
    tags: displayTags(node.tags),
    excerpt: makeExcerpt(node.body),
    matchType,
    score,
  };
}

/**
 * Core suggest logic: find nodes relevant to the current project.
 *
 * Two-pass approach:
 *  1. Tag pass — find nodes with `project:<name>` tag (fast, no embeddings)
 *  2. Semantic pass — if embeddings available, search for project name
 * Results are deduplicated, tag matches ranked first.
 */
export async function suggestCore(options: SuggestOptions = {}): Promise<SuggestResult> {
  const cwd = options.cwd ?? process.cwd();
  let projectName: string;
  let source: SuggestResult['source'];

  if (options.project) {
    projectName = options.project;
    source = 'flag';
  } else {
    const detected = detectProject(cwd);
    if (!detected) {
      return { project: '', source: 'basename', suggestions: [], total: 0 };
    }
    projectName = detected.name;
    source = detected.source;
  }

  const limit = options.limit ?? 10;
  const projectTag = `project:${projectName}`;

  // --- Pass 1: Tag match ---
  const allNodes = await listNodes();
  const tagMatches = allNodes.filter((node) =>
    node.tags.some((t) => t.toLowerCase() === projectTag.toLowerCase()),
  );
  const tagMatchIds = new Set(tagMatches.map((n) => n.id));

  const suggestions: Suggestion[] = tagMatches.map((n) => nodeToSuggestion(n, 'tag', null));

  // --- Pass 2: Semantic search (if embeddings are enabled and we haven't hit the limit) ---
  if (suggestions.length < limit) {
    const provider = getEmbeddingProvider();
    if (provider !== 'none') {
      try {
        const semanticResults = await semanticSearchCore(projectName, {
          limit: limit * 2, // fetch extra to account for deduplication
          minScore: 0.3,
        });

        for (const { node, similarity } of semanticResults.nodes) {
          if (tagMatchIds.has(node.id)) continue; // already included from tag pass
          if (suggestions.length >= limit) break;
          suggestions.push(nodeToSuggestion(node, 'semantic', similarity));
        }
      } catch {
        // Embedding failure is non-fatal for suggest — tag results are still useful
      }
    }
  }

  // Trim to limit (tag matches may already exceed it)
  const trimmed = suggestions.slice(0, limit);

  return {
    project: projectName,
    source,
    suggestions: trimmed,
    total: trimmed.length,
  };
}
