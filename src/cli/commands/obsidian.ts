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
  const nodeTagsById = new Map(nodes.map((n) => [n.id, new Set(n.tags ?? [])]));

  // Fetch full document records (with body) and chunk mappings
  type DocWithBody = DocumentSummary & { body: string };
  const documents: DocWithBody[] = [];
  const chunkNodeIds = new Set<string>();
  const chunkToDocRoot = new Map<string, string>(); // chunkNodeId -> rootNodeId
  const rootNodeToDocId = new Map<string, string>();
  const docChunkNodeIds = new Map<string, string[]>(); // docId -> chunk node IDs

  for (const summary of documentsResult.documents) {
    const full = await backend.getDocument(summary.id);
    const doc = full.document as DocWithBody;
    doc.body = doc.body ?? '';
    documents.push(doc);

    if (doc.rootNodeId) {
      rootNodeToDocId.set(doc.rootNodeId, doc.id);
    }
    // Fetch chunks and track which nodes belong to this document
    const chunksResult = await backend.getDocumentChunks(doc.id);
    const chunkIds: string[] = [];
    for (const chunk of chunksResult.chunks) {
      chunkNodeIds.add(chunk.nodeId);
      chunkIds.push(chunk.nodeId);
      if (doc.rootNodeId) {
        chunkToDocRoot.set(chunk.nodeId, doc.rootNodeId);
      }
    }
    docChunkNodeIds.set(doc.id, chunkIds);
  }

  // Resolve a node ID to its "canonical" ID for the export.
  // Chunk nodes map to their parent document's root node;
  // everything else maps to itself.
  function canonicalId(id: string): string {
    return chunkToDocRoot.get(id) ?? id;
  }

  // Compute shared tags between two nodes from the export data
  function computeSharedTags(idA: string, idB: string): string[] {
    const tagsA = nodeTagsById.get(idA);
    const tagsB = nodeTagsById.get(idB);
    if (!tagsA || !tagsB) return [];
    const shared: string[] = [];
    for (const t of tagsA) {
      if (tagsB.has(t)) shared.push(t);
    }
    return shared;
  }

  // Build adjacency using canonical IDs so chunk edges roll up to documents.
  // Key = canonical node ID, Value = map of peerId -> best EdgeInfo (deduped).
  type EdgeInfo = {
    peerId: string;
    score: number;
    sharedTags: string[];
  };
  const adjacencyMap = new Map<string, Map<string, EdgeInfo>>();

  function addEdge(rawFrom: string, rawTo: string, score: number) {
    const from = canonicalId(rawFrom);
    const to = canonicalId(rawTo);
    if (from === to) return; // skip self-links (e.g. chunk-to-root within same doc)

    const peers = adjacencyMap.get(from) ?? new Map<string, EdgeInfo>();
    const existing = peers.get(to);
    // Keep the highest score if multiple chunk edges connect the same pair
    if (!existing || score > existing.score) {
      peers.set(to, {
        peerId: to,
        score,
        sharedTags: computeSharedTags(rawFrom, rawTo),
      });
    }
    adjacencyMap.set(from, peers);
  }

  for (const edge of edges) {
    addEdge(edge.sourceId, edge.targetId, edge.score);
    addEdge(edge.targetId, edge.sourceId, edge.score);
  }

  // Flatten to adjacency lists
  const adjacency = new Map<string, EdgeInfo[]>();
  for (const [nodeId, peers] of adjacencyMap) {
    adjacency.set(nodeId, [...peers.values()]);
  }

  // Track filenames for wikilink resolution: nodeId -> filename (without .md)
  const nodeFilenames = new Map<string, string>();

  // Determine filenames first (need this for wikilinks)
  const usedFilenames = new Set<string>();

  function pickFilename(id: string, title: string): string {
    const sid = shortId(id);
    const base = sanitizeFilename(`${sid} ${title}`);
    let name = base || sid;
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
    nodeFilenames.set(doc.id, filename);
    if (doc.rootNodeId) {
      nodeFilenames.set(doc.rootNodeId, filename);
    }
  }

  // Pass 2: Assign filenames for non-chunk, non-document-root regular nodes
  for (const node of nodes) {
    if (chunkNodeIds.has(node.id)) continue;
    if (nodeFilenames.has(node.id)) continue;
    const filename = pickFilename(node.id, node.title);
    nodeFilenames.set(node.id, filename);
  }

  /**
   * Build the connections section with [[wikilinks]].
   */
  function buildConnectionsSection(nodeId: string): string {
    const edgeInfos = adjacency.get(nodeId);
    if (!edgeInfos || edgeInfos.length === 0) return '';

    const sorted = [...edgeInfos].sort((a, b) => b.score - a.score);

    const lines: string[] = ['', '## Connections', ''];
    for (const info of sorted) {
      const peerFilename = nodeFilenames.get(info.peerId);
      if (!peerFilename) continue;

      const scoreParts: string[] = [];
      scoreParts.push(info.score.toFixed(2));
      if (info.sharedTags.length > 0) {
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

    // Aggregate tags from root node + all chunk nodes
    const allTags = new Set<string>();
    const rootNode = doc.rootNodeId ? nodeById.get(doc.rootNodeId) : null;
    if (rootNode?.tags) {
      for (const t of rootNode.tags) allTags.add(t);
    }
    for (const chunkId of docChunkNodeIds.get(doc.id) ?? []) {
      const chunkNode = nodeById.get(chunkId);
      if (chunkNode?.tags) {
        for (const t of chunkNode.tags) allTags.add(t);
      }
    }

    const frontMatter = buildFrontMatter({
      forest_id: shortId(doc.id),
      tags: [...allTags],
      created: doc.createdAt,
      modified: doc.updatedAt,
      type: 'document',
    });

    const body = doc.body || '';
    // Use root node ID for connections (that's where adjacency is keyed)
    const connections = doc.rootNodeId ? buildConnectionsSection(doc.rootNodeId) : '';

    const content = `${frontMatter}\n\n${body}${connections}\n`;
    fs.writeFileSync(path.join(targetDir, `${filename}.md`), content, 'utf-8');
    fileCount++;
  }

  // Write regular node files
  for (const node of nodes) {
    if (chunkNodeIds.has(node.id)) continue;
    if (rootNodeToDocId.has(node.id)) continue;

    const filename = nodeFilenames.get(node.id)!;

    const frontMatter = buildFrontMatter({
      forest_id: shortId(node.id),
      tags: node.tags ?? [],
      created: node.createdAt,
      modified: node.updatedAt,
    });

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
