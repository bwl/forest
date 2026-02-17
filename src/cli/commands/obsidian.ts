import fs from 'fs';
import path from 'path';

import { handleError } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { getBackend } from '../shared/remote';

import type { DocumentSummary } from '../../lib/client';

type ClercModule = typeof import('clerc');
type ClercInstance = ReturnType<ClercModule['Clerc']['create']>;

type ExportObsidianFlags = {
  dir?: string;
  tldr?: string;
};

/**
 * Sanitize a string for use as a filename.
 * Removes characters that are illegal on Windows/macOS/Linux filesystems.
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/**
 * Build YAML front-matter block from metadata fields.
 */
function buildFrontMatter(fields: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${String(item)}`);
      }
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/**
 * Format a short ID (first 8 hex chars of UUID).
 */
function shortId(id: string): string {
  return (id.split('-')[0] ?? id).slice(0, 8);
}

export function registerExportObsidianCommand(cli: ClercInstance, clerc: ClercModule) {
  const obsidianCommand = clerc.defineCommand(
    {
      name: 'export obsidian',
      description: 'Export the graph as an Obsidian-compatible vault of Markdown files',
      flags: {
        dir: {
          type: String,
          description: 'Target directory for the vault (created if it does not exist)',
          alias: 'd',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }: { flags: ExportObsidianFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['export.obsidian'], getVersion(), jsonMode);
        }
        await runExportObsidian(flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(obsidianCommand);
}

async function runExportObsidian(flags: ExportObsidianFlags) {
  if (!flags.dir || typeof flags.dir !== 'string' || flags.dir.trim().length === 0) {
    console.error('Provide --dir with the target directory for the Obsidian vault.');
    process.exitCode = 1;
    return;
  }

  const targetDir = path.resolve(flags.dir);
  fs.mkdirSync(targetDir, { recursive: true });

  const backend = getBackend();

  // Fetch all data
  const jsonExport = await backend.exportJson({ body: true, edges: true });
  const documentsResult = await backend.listDocuments();

  const nodes = jsonExport.nodes;
  const edges = jsonExport.edges;

  // Build lookup maps
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Fetch full document records (with body) and chunk mappings
  type DocWithBody = DocumentSummary & { body: string };
  const documents: DocWithBody[] = [];
  const chunkNodeIds = new Set<string>();
  const rootNodeToDocId = new Map<string, string>();

  for (const summary of documentsResult.documents) {
    const full = await backend.getDocument(summary.id);
    const doc = full.document as DocWithBody;
    doc.body = doc.body ?? '';
    documents.push(doc);

    if (doc.rootNodeId) {
      rootNodeToDocId.set(doc.rootNodeId, doc.id);
    }
    // Fetch chunks for this document and mark them as subsumed
    const chunksResult = await backend.getDocumentChunks(doc.id);
    for (const chunk of chunksResult.chunks) {
      chunkNodeIds.add(chunk.nodeId);
    }
  }

  // Build adjacency: nodeId -> list of { targetId, score, sharedTags, semanticScore, tagScore }
  type EdgeInfo = {
    peerId: string;
    score: number;
    semanticScore?: number | null;
    tagScore?: number | null;
    sharedTags?: string[];
  };
  const adjacency = new Map<string, EdgeInfo[]>();

  for (const edge of edges) {
    const addEdge = (from: string, to: string) => {
      const list = adjacency.get(from) ?? [];
      list.push({
        peerId: to,
        score: edge.score,
        semanticScore: (edge as any).semanticScore,
        tagScore: (edge as any).tagScore,
        sharedTags: (edge as any).sharedTags,
      });
      adjacency.set(from, list);
    };
    addEdge(edge.sourceId, edge.targetId);
    addEdge(edge.targetId, edge.sourceId);
  }

  // Track filenames for wikilink resolution: nodeId -> filename (without .md)
  const nodeFilenames = new Map<string, string>();

  // Determine filenames first (need this for wikilinks)
  const usedFilenames = new Set<string>();

  function pickFilename(id: string, title: string): string {
    const sid = shortId(id);
    const base = sanitizeFilename(`${sid} ${title}`);
    let name = base || sid;
    // Deduplicate
    if (usedFilenames.has(name.toLowerCase())) {
      let i = 2;
      while (usedFilenames.has(`${name} ${i}`.toLowerCase())) i++;
      name = `${name} ${i}`;
    }
    usedFilenames.add(name.toLowerCase());
    return name;
  }

  // Pass 1: Assign filenames for documents (assembled)
  for (const doc of documents) {
    const filename = pickFilename(doc.id, doc.title);
    // Map the document ID itself
    nodeFilenames.set(doc.id, filename);
    // Also map the root node to this filename
    if (doc.rootNodeId) {
      nodeFilenames.set(doc.rootNodeId, filename);
    }
  }

  // Pass 2: Assign filenames for non-chunk, non-document-root regular nodes
  for (const node of nodes) {
    if (chunkNodeIds.has(node.id)) continue;
    if (nodeFilenames.has(node.id)) continue; // already mapped as document root
    const filename = pickFilename(node.id, node.title);
    nodeFilenames.set(node.id, filename);
  }

  /**
   * Build the connections section with [[wikilinks]].
   */
  function buildConnectionsSection(nodeId: string): string {
    const edgeInfos = adjacency.get(nodeId);
    if (!edgeInfos || edgeInfos.length === 0) return '';

    // Sort by score descending
    const sorted = [...edgeInfos].sort((a, b) => b.score - a.score);

    const lines: string[] = ['', '## Connections', ''];
    for (const info of sorted) {
      const peerFilename = nodeFilenames.get(info.peerId);
      if (!peerFilename) continue; // chunk node without a mapping

      const scoreParts: string[] = [];
      scoreParts.push(info.score.toFixed(2));
      if (info.sharedTags && info.sharedTags.length > 0) {
        scoreParts.push(`tags: ${info.sharedTags.join(', ')}`);
      }

      lines.push(`- [[${peerFilename}]] (${scoreParts.join(' | ')})`);
    }
    return lines.join('\n');
  }

  let fileCount = 0;

  // Write document files (assembled)
  for (const doc of documents) {
    const filename = nodeFilenames.get(doc.id)!;
    const rootNode = doc.rootNodeId ? nodeById.get(doc.rootNodeId) : null;

    // Collect all tags from document chunks + root node
    const allTags = new Set<string>();
    if (rootNode?.tags) {
      for (const t of rootNode.tags) allTags.add(t);
    }

    const frontMatter = buildFrontMatter({
      forest_id: shortId(doc.id),
      tags: [...allTags],
      created: doc.createdAt,
      modified: doc.updatedAt,
      type: 'document',
    });

    // Use the document's assembled body
    const body = doc.body || '';

    // Connections from the root node (if it exists)
    const connections = doc.rootNodeId ? buildConnectionsSection(doc.rootNodeId) : '';

    const content = `${frontMatter}\n\n${body}${connections}\n`;
    fs.writeFileSync(path.join(targetDir, `${filename}.md`), content, 'utf-8');
    fileCount++;
  }

  // Write regular node files
  for (const node of nodes) {
    if (chunkNodeIds.has(node.id)) continue;
    if (rootNodeToDocId.has(node.id)) continue; // handled as document above

    const filename = nodeFilenames.get(node.id)!;

    const metaFields: Record<string, unknown> = {
      forest_id: shortId(node.id),
      tags: node.tags ?? [],
      created: node.createdAt,
      modified: node.updatedAt,
    };

    const frontMatter = buildFrontMatter(metaFields);
    const body = node.body ?? '';
    const connections = buildConnectionsSection(node.id);

    const content = `${frontMatter}\n\n${body}${connections}\n`;
    fs.writeFileSync(path.join(targetDir, `${filename}.md`), content, 'utf-8');
    fileCount++;
  }

  console.log('');
  console.log(`Exported ${fileCount} files to ${targetDir}`);
  console.log(`  Nodes: ${fileCount - documents.length}`);
  console.log(`  Documents (assembled): ${documents.length}`);
  console.log('');
  console.log('Open this directory as a vault in Obsidian to explore your Forest graph.');
}
