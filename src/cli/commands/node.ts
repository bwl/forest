import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';

import {
  NodeRecord,
  deleteNode,
  updateNode,
  DocumentRecord,
  DocumentChunkRecord,
  DocumentMetadata,
  upsertDocument,
  replaceDocumentChunks,
  updateNodeChunkOrder,
} from '../../lib/db';
import { extractTags, tokenize } from '../../lib/text';
import { computeEmbeddingForNode } from '../../lib/embeddings';

import { buildNeighborhoodPayload, printNodeOverview } from '../shared/explore';
import {
  DEFAULT_NEIGHBORHOOD_LIMIT,
  formatId,
  resolveBodyInput,
  resolveNodeReference,
} from '../shared/utils';
import { rescoreNode } from '../shared/linking';
import {
  loadDocumentSessionForNode,
  buildDocumentEditorBuffer,
  parseDocumentEditorBuffer,
  type LoadedDocumentSession,
  type DocumentSegment,
  type ParsedDocumentEdit,
} from '../shared/document-session';
import { synthesizeNodesCore, SynthesisModel, ReasoningEffort, TextVerbosity } from '../../core/synthesize';
import { createNodeCore } from '../../core/nodes';
import { importDocumentCore } from '../../core/import';
import { reconstructDocument } from '../../lib/reconstruction';
import { loadConfig } from '../../lib/config';
import { renderMarkdownToTerminal } from '../formatters';


export type NodeReadFlags = {
  meta?: boolean;
  json?: boolean;
  longIds?: boolean;
  raw?: boolean;
  tldr?: string;
};

export type NodeRefreshFlags = {
  title?: string;
  body?: string;
  file?: string;
  stdin?: boolean;
  tags?: string;
  autoLink?: boolean;
  noAutoLink?: boolean;
  tldr?: string;
};

export type NodeEditFlags = {
  editor?: string;
  autoLink?: boolean;
  noAutoLink?: boolean;
  tldr?: string;
};

export type NodeDeleteFlags = {
  force?: boolean;
  tldr?: string;
};

export type NodeSynthesizeFlags = {
  model?: string;
  reasoning?: string;
  verbosity?: string;
  preview?: boolean;
  autoLink?: boolean;
  maxTokens?: number;
  tldr?: string;
};

export type NodeImportFlags = {
  file?: string;
  stdin?: boolean;
  title?: string;
  tags?: string;
  chunkStrategy?: string;
  maxTokens?: number;
  overlap?: number;
  noParent?: boolean;
  noSequential?: boolean;
  noAutoLink?: boolean;
  json?: boolean;
  tldr?: string;
};

export async function runNodeRead(idRef: string | undefined, flags: NodeReadFlags) {
  if (!idRef || idRef.trim().length === 0) {
    console.error('✖ Provide a node id or unique short id (run `forest explore` to discover ids).');
    process.exitCode = 1;
    return;
  }

  const node = await resolveNodeReference(idRef.trim());
  if (!node) {
    console.error('✖ No node found. Provide a full id or unique short id.');
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  const markdownOptions = {
    width: config.markdown?.width ?? 90,
    reflowText: config.markdown?.reflowText ?? true,
  };

  // Check if this node is part of a chunked document
  const reconstructed = await reconstructDocument(node);

  // Raw mode: output only the markdown body (for piping to glow, bat, etc.)
  if (flags.raw) {
    if (reconstructed) {
      console.log(reconstructed.fullBody);
    } else {
      console.log(node.body);
    }
    return;
  }

  if (flags.json) {
    if (reconstructed) {
      // For reconstructed documents, return full document in JSON
      console.log(
        JSON.stringify(
          {
            node: {
              id: reconstructed.rootNode.id,
              title: reconstructed.rootNode.title,
              tags: reconstructed.rootNode.tags,
              createdAt: reconstructed.rootNode.createdAt,
              updatedAt: reconstructed.rootNode.updatedAt,
            },
            body: reconstructed.fullBody,
            metadata: {
              isReconstructed: true,
              totalChunks: reconstructed.metadata.totalChunks,
              chunks: reconstructed.chunks.map((c) => ({
                id: c.id,
                title: c.title,
                order: c.chunkOrder,
              })),
            },
          },
          null,
          2,
        ),
      );
    } else {
      // Regular node output
      console.log(
        JSON.stringify(
          {
            node: {
              id: node.id,
              title: node.title,
              tags: node.tags,
              createdAt: node.createdAt,
              updatedAt: node.updatedAt,
            },
            body: node.body,
          },
          null,
          2,
        ),
      );
    }
    return;
  }

  // Text output
  if (reconstructed) {
    // Use the root node for overview
    const displayNode = reconstructed.rootNode;
    const { directEdges } = await buildNeighborhoodPayload(displayNode.id, 1, DEFAULT_NEIGHBORHOOD_LIMIT);
    printNodeOverview(displayNode, directEdges, { longIds: Boolean(flags.longIds) });

    if (!flags.meta) {
      console.log('');
      console.log(`[Document with ${reconstructed.metadata.totalChunks} chunks - automatically reconstructed]`);
      console.log('');
      console.log(renderMarkdownToTerminal(reconstructed.fullBody, markdownOptions));
      console.log('');
      console.log('---');
      console.log(`Chunks: ${reconstructed.chunks.map((c) => formatId(c.id)).join(', ')}`);
    }
  } else {
    // Regular node output
    const { directEdges } = await buildNeighborhoodPayload(node.id, 1, DEFAULT_NEIGHBORHOOD_LIMIT);
    printNodeOverview(node, directEdges, { longIds: Boolean(flags.longIds) });

    if (!flags.meta) {
      console.log('');
      console.log(renderMarkdownToTerminal(node.body, markdownOptions));
    }
  }
}

export async function runNodeRefresh(idRef: string | undefined, flags: NodeRefreshFlags) {
  if (!idRef) {
    console.error('✖ Missing required parameter "id".');
    process.exitCode = 1;
    return;
  }

  const node = await resolveNodeReference(String(idRef));
  if (!node) {
    console.error('✖ No node found. Provide a full id or unique short id.');
    process.exitCode = 1;
    return;
  }

  const nextTitle = typeof flags.title === 'string' ? flags.title : node.title;

  const bodyResult = await resolveBodyInput(flags.body, flags.file, flags.stdin);
  const nextBody = bodyResult.provided ? bodyResult.value : node.body;

  const combinedText = `${nextTitle}\n${nextBody}`;
  const tokenCounts = tokenize(combinedText);
  const tags = resolveTags(flags.tags, combinedText, tokenCounts);

  const embedding = await computeEmbeddingForNode({ title: nextTitle, body: nextBody });

  await updateNode(node.id, {
    title: nextTitle,
    body: nextBody,
    tags,
    tokenCounts,
    embedding,
  });

  const autoLink = computeAutoLinkIntent(flags);
  const updatedAt = new Date().toISOString();
  const updatedNode: NodeRecord = {
    ...node,
    title: nextTitle,
    body: nextBody,
    tags,
    tokenCounts,
    embedding,
    updatedAt,
  };

  // Persist updated node to database
  await updateNode(node.id, {
    title: nextTitle,
    body: nextBody,
    tags,
    tokenCounts,
    embedding,
  });

  let accepted = 0;
  if (autoLink) {
    ({ accepted } = await rescoreNode(updatedNode));
  }

  console.log(`✔ Refreshed note: ${nextTitle}`);
  console.log(`   id: ${node.id}`);
  if (tags.length > 0) console.log(`   tags: ${tags.join(', ')}`);
  if (autoLink) {
    console.log(`   links after rescore: ${accepted} edges`);
  } else {
    console.log('   links: rescoring skipped (--no-auto-link)');
  }

  if (updatedNode.isChunk && updatedNode.parentDocumentId) {
    const session = await loadDocumentSessionForNode(updatedNode);
    if (session) {
      const target = session.segments.find((segment) => segment.node.id === updatedNode.id);
      if (target) {
        const overrides = new Map([[target.mapping.segmentId, normalizeEditorContent(nextBody)]]);
        const { updatedDocument, changedSegmentIds } = await applyDocumentChunkUpdates(
          session,
          overrides,
          updatedAt,
          updatedNode.id
        );
        if (changedSegmentIds.size > 0 || updatedDocument.version !== session.document.version) {
          console.log(
            `   document updated: ${updatedDocument.title} (version ${session.document.version} → ${updatedDocument.version}, segments touched: ${changedSegmentIds.size})`
          );
        } else {
          console.log(`   document unchanged (no structural delta)`);
        }
      }
    }
  }
}

export async function runNodeEdit(idRef: string | undefined, flags: NodeEditFlags) {
  if (!idRef) {
    console.error('✖ Missing required parameter "id".');
    process.exitCode = 1;
    return;
  }

  const node = await resolveNodeReference(String(idRef));
  if (!node) {
    console.error('✖ No node found. Provide a full id or unique short id.');
    process.exitCode = 1;
    return;
  }

  const documentSession = await loadDocumentSessionForNode(node);

  let editorCommand: EditorCommand;
  try {
    editorCommand = resolveEditorCommand(flags.editor);
  } catch (error) {
    console.error(`✖ ${(error as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-edit-'));
  const fileName = documentSession
    ? `${formatId((documentSession.document.rootNodeId ?? documentSession.document.id))}-doc.md`
    : `${formatId(node.id)}.md`;
  const filePath = path.join(tempDir, fileName);

  const focusSegmentId =
    documentSession?.segments.find((segment) => segment.node.id === node.id)?.mapping.segmentId ?? undefined;

  const initialBuffer = documentSession
    ? buildDocumentEditorBuffer(documentSession, { focusSegmentId })
    : buildEditorDraft(node);

  if (documentSession) {
    console.log(
      `Editing node within document: ${documentSession.document.title} (${documentSession.segments.length} segments)`
    );
  }

  await fs.writeFile(filePath, initialBuffer, 'utf8');

  let preserveTempDir = false;

  try {
    const result = spawnSync(editorCommand.command, [...editorCommand.args, filePath], {
      stdio: 'inherit',
    });

    if (result.error) {
      console.error(`✖ Failed to launch editor (${editorCommand.display}): ${(result.error as Error).message}`);
      process.exitCode = 1;
      return;
    }

    if (typeof result.status === 'number' && result.status !== 0) {
      console.error(`✖ Editor exited with code ${result.status}. Aborting save.`);
      process.exitCode = result.status;
      return;
    }

    const editedBuffer = await fs.readFile(filePath, 'utf8');
    if (documentSession) {
      const outcome = await applyDocumentEditSession({
        node,
        session: documentSession,
        flags,
        initialBuffer,
        editedBuffer,
        filePath,
      });
      preserveTempDir = outcome.preserveTempDir;
    } else {
      const outcome = await applySingleNodeEdit({
        node,
        flags,
        initialBuffer,
        editedBuffer,
        filePath,
      });
      preserveTempDir = outcome.preserveTempDir;
    }
  } finally {
    if (!preserveTempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export async function runNodeDelete(idRef: string | undefined, _flags: NodeDeleteFlags) {
  if (!idRef) {
    console.error('✖ Missing required parameter "id".');
    process.exitCode = 1;
    return;
  }

  const node = await resolveNodeReference(String(idRef));
  if (!node) {
    console.error('✖ No node found. Provide a full id or unique short id.');
    process.exitCode = 1;
    return;
  }

  const result = await deleteNode(node.id);
  if (!result.nodeRemoved) {
    console.error('✖ Node could not be removed.');
    process.exitCode = 1;
    return;
  }

  console.log(`✔ Deleted note ${formatId(node.id)} (${node.title})`);
  console.log(`   removed ${result.edgesRemoved} associated edges`);
}

function resolveTags(tagsOption: string | undefined, combinedText: string, tokenCounts: NodeRecord['tokenCounts']) {
  if (typeof tagsOption === 'string') {
    return tagsOption
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
  return extractTags(combinedText, tokenCounts);
}

function computeAutoLinkIntent(flags: { autoLink?: boolean; noAutoLink?: boolean }) {
  if (typeof flags.noAutoLink === 'boolean') return !flags.noAutoLink;
  if (typeof flags.autoLink === 'boolean') return flags.autoLink;
  return true;
}

type EditorCommand = {
  command: string;
  args: string[];
  display: string;
};

type ParsedEditorDraft = {
  title: string;
  tags: string[];
  body: string;
};

function resolveEditorCommand(override?: string): EditorCommand {
  const candidates = [
    override,
    process.env.FOREST_EDITOR,
    process.env.VISUAL,
    process.env.EDITOR,
    process.platform === 'win32' ? 'notepad' : null,
    process.platform === 'win32' ? null : 'nano',
    process.platform === 'win32' ? null : 'vi',
  ].filter((entry): entry is string => Boolean(entry && entry.trim().length > 0));

  for (const candidate of candidates) {
    const parts = splitEditorArgs(candidate);
    if (parts.length === 0) continue;
    return {
      command: parts[0],
      args: parts.slice(1),
      display: candidate,
    };
  }

  throw new Error('No editor configured. Set $FOREST_EDITOR/$VISUAL/$EDITOR or pass --editor.');
}

function splitEditorArgs(command: string): string[] {
  const result: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escapeNext = false;

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i]!;

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\' && quote !== "'") {
      escapeNext = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        result.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (quote) {
    // Unclosed quote -- treat remaining buffer as literal
    if (current.length > 0) result.push(current);
  } else if (current.length > 0) {
    result.push(current);
  }

  return result;
}

function buildEditorDraft(node: NodeRecord): string {
  const header = [
    '# Forest Node Editor',
    '# Edit Title and Tags below; lines starting with # are ignored.',
    '# Leave Tags blank to auto-detect when saving.',
    `Title: ${node.title}`,
    `Tags: ${node.tags.join(', ')}`,
    '',
  ];
  const body = node.body.replace(/\r\n/g, '\n');
  const content = [...header, body].join('\n');
  return content.endsWith('\n') ? content : `${content}\n`;
}

function parseEditorDraft(content: string): ParsedEditorDraft {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const meaningful = lines.filter((line) => !line.startsWith('#'));

  while (meaningful.length > 0 && meaningful[0]!.trim() === '') {
    meaningful.shift();
  }

  const titleLine = meaningful.shift();
  if (!titleLine || !titleLine.startsWith('Title:')) {
    throw new Error('Updated file missing required "Title:" line.');
  }
  const title = titleLine.slice('Title:'.length).trim();

  let tags: string[] = [];
  if (meaningful.length > 0 && meaningful[0]!.startsWith('Tags:')) {
    const tagLine = meaningful.shift()!;
    const raw = tagLine.slice('Tags:'.length).trim();
    if (raw.length > 0) {
      tags = raw
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    }
  }

  if (meaningful.length > 0 && meaningful[0]!.trim() === '') {
    meaningful.shift();
  }

  const body = meaningful.join('\n');
  return { title, tags, body };
}

type SingleNodeEditContext = {
  node: NodeRecord;
  flags: NodeEditFlags;
  initialBuffer: string;
  editedBuffer: string;
  filePath: string;
};

type DocumentEditContext = {
  node: NodeRecord;
  session: LoadedDocumentSession;
  flags: NodeEditFlags;
  initialBuffer: string;
  editedBuffer: string;
  filePath: string;
};

type EditOutcome = { preserveTempDir: boolean };

function normalizeEditorContent(buffer: string): string {
  return buffer.replace(/\r\n/g, '\n');
}

function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

async function applyDocumentChunkUpdates(
  session: LoadedDocumentSession,
  overrides: Map<string, string>,
  updatedAt: string,
  editedNodeId: string
): Promise<{ updatedDocument: DocumentRecord; changedSegmentIds: Set<string> }> {
  const segments = [...session.segments].sort((a, b) => a.mapping.chunkOrder - b.mapping.chunkOrder);
  const canonicalParts: string[] = [];
  const chunkRecords: DocumentChunkRecord[] = [];
  const changedSegmentIds = new Set<string>();

  let offset = 0;
  segments.forEach((segment, index) => {
    const override = overrides.get(segment.mapping.segmentId);
    const body = normalizeEditorContent(override ?? segment.node.body);
    const originalBody = normalizeEditorContent(segment.node.body);
    const isChanged = override !== undefined && body !== originalBody;
    if (isChanged) changedSegmentIds.add(segment.mapping.segmentId);

    canonicalParts.push(body);
    chunkRecords.push({
      documentId: session.document.id,
      segmentId: segment.mapping.segmentId,
      nodeId: segment.node.id,
      offset,
      length: body.length,
      chunkOrder: segment.mapping.chunkOrder,
      checksum: hashContent(body),
      createdAt: segment.mapping.createdAt,
      updatedAt: isChanged ? updatedAt : segment.mapping.updatedAt,
    });
    offset += body.length;
    if (index < segments.length - 1) offset += 2;
  });

  const canonicalBody = canonicalParts.join('\n\n');
  if (changedSegmentIds.size === 0 && canonicalBody === session.document.body) {
    return { updatedDocument: session.document, changedSegmentIds };
  }
  const updatedMetadata: DocumentMetadata = {
    ...(session.document.metadata ?? {}),
    lastEditedAt: updatedAt,
    lastEditedNodeId: editedNodeId,
  };

  const updatedDocument: DocumentRecord = {
    ...session.document,
    body: canonicalBody,
    metadata: updatedMetadata,
    version: session.document.version + 1,
    updatedAt,
  };

  await upsertDocument(updatedDocument);
  await replaceDocumentChunks(session.document.id, chunkRecords);

  return { updatedDocument, changedSegmentIds };
}

async function applySingleNodeEdit(context: SingleNodeEditContext): Promise<EditOutcome> {
  const { node, flags, initialBuffer, editedBuffer, filePath } = context;

  if (normalizeEditorContent(editedBuffer) === normalizeEditorContent(initialBuffer)) {
    console.log('No changes detected. Nothing to save.');
    return { preserveTempDir: false };
  }

  let parsed: ParsedEditorDraft;
  try {
    parsed = parseEditorDraft(editedBuffer);
  } catch (error) {
    console.error(`✖ ${String((error as Error).message)}`);
    console.error(`   Temporary file preserved at: ${filePath}`);
    process.exitCode = 1;
    return { preserveTempDir: true };
  }

  const { title, tags: explicitTags, body } = parsed;
  const combinedText = `${title}\n${body}`;
  const tokenCounts = tokenize(combinedText);
  const tags = explicitTags.length > 0 ? explicitTags : extractTags(combinedText, tokenCounts);
  const embedding = await computeEmbeddingForNode({ title, body });

  await updateNode(node.id, {
    title,
    body,
    tags,
    tokenCounts,
    embedding,
  });

  const autoLink = computeAutoLinkIntent(flags);
  let accepted = 0;
  if (autoLink) {
    const updatedNode: NodeRecord = {
      ...node,
      title,
      body,
      tags,
      tokenCounts,
      embedding,
    };
    ({ accepted } = await rescoreNode(updatedNode));
  }

  console.log(`✔ Saved note: ${title}`);
  console.log(`   id: ${node.id}`);
  if (tags.length > 0) console.log(`   tags: ${tags.join(', ')}`);
  if (autoLink) {
    console.log(`   links after rescore: ${accepted} accepted`);
  } else {
    console.log('   links: rescoring skipped (--no-auto-link)');
  }

  return { preserveTempDir: false };
}

async function applyDocumentEditSession(context: DocumentEditContext): Promise<EditOutcome> {
  const { node, session, flags, initialBuffer, editedBuffer, filePath } = context;

  if (normalizeEditorContent(editedBuffer) === normalizeEditorContent(initialBuffer)) {
    console.log('No changes detected. Nothing to save.');
    return { preserveTempDir: false };
  }

  let parsedEdit: ParsedDocumentEdit;
  try {
    parsedEdit = parseDocumentEditorBuffer(session, editedBuffer);
  } catch (error) {
    console.error(`✖ ${String((error as Error).message)}`);
    console.error(`   Temporary file preserved at: ${filePath}`);
    process.exitCode = 1;
    return { preserveTempDir: true };
  }

  try {
    const segmentMap = new Map(session.segments.map((segment) => [segment.mapping.segmentId, segment]));

    const contentChanges: {
      segment: DocumentSegment;
      content: string;
      newOrder: number;
    }[] = [];
    let orderChanged = false;

    for (let index = 0; index < parsedEdit.segments.length; index += 1) {
      const parsedSegment = parsedEdit.segments[index]!;
      const segment = segmentMap.get(parsedSegment.segmentId);
      if (!segment) {
        throw new Error(`Unknown segment ${parsedSegment.segmentId} encountered during save.`);
      }
      if (segment.node.id !== parsedSegment.nodeId) {
        throw new Error(
          `Segment ${parsedSegment.segmentId} references node ${parsedSegment.nodeId}, expected ${segment.node.id}.`
        );
      }
      const originalBody = normalizeEditorContent(segment.node.body);
      const newBody = normalizeEditorContent(parsedSegment.content);
      const contentChanged = originalBody !== newBody;
      if (segment.mapping.chunkOrder !== index) {
        orderChanged = true;
      }
      if (contentChanged) {
        contentChanges.push({
          segment,
          content: parsedSegment.content,
          newOrder: index,
        });
      }
    }

    if (contentChanges.length === 0 && !orderChanged) {
      console.log('No segment changes detected. Nothing to save.');
      return { preserveTempDir: false };
    }

    const now = new Date().toISOString();
    const updatedMetadata: DocumentMetadata = {
      ...(session.document.metadata ?? {}),
      lastEditedAt: now,
      lastEditedNodeId: node.id,
    };

    const updatedDocument: DocumentRecord = {
      ...session.document,
      body: parsedEdit.canonicalBody,
      metadata: updatedMetadata,
      version: session.document.version + 1,
      updatedAt: now,
    };

    const autoLink = computeAutoLinkIntent(flags);
    let totalAccepted = 0;

    for (const { segment, content, newOrder } of contentChanges) {
      const combinedText = `${segment.node.title}\n${content}`;
      const tokenCounts = tokenize(combinedText);
      // Preserve existing tags - only auto-extract if node had no tags
      const tags = segment.node.tags.length > 0 ? segment.node.tags : extractTags(combinedText, tokenCounts);
      const embedding = await computeEmbeddingForNode({ title: segment.node.title, body: content });

      await updateNode(segment.node.id, {
        body: content,
        tags,
        tokenCounts,
        embedding,
      });

      if (autoLink) {
        const updatedNode: NodeRecord = {
          ...segment.node,
          body: content,
          tags,
          tokenCounts,
          embedding,
          chunkOrder: newOrder,
          updatedAt: now,
        };
        const rescore = await rescoreNode(updatedNode);
        totalAccepted += rescore.accepted;
      }
    }

    for (let index = 0; index < parsedEdit.segments.length; index += 1) {
      const parsedSegment = parsedEdit.segments[index]!;
      const segment = segmentMap.get(parsedSegment.segmentId)!;
      if (segment.node.chunkOrder !== index) {
        try {
          await updateNodeChunkOrder(segment.node.id, index);
        } catch (error) {
          console.warn(`⚠ Failed to update chunk order for node ${segment.node.id}: ${(error as Error).message}`);
        }
      }
    }

    await upsertDocument(updatedDocument);

    const contentChangeMap = new Map(contentChanges.map((entry) => [entry.segment.mapping.segmentId, entry]));
    const updatedChunkRecords: DocumentChunkRecord[] = [];
    let offset = 0;
    for (let index = 0; index < parsedEdit.segments.length; index += 1) {
      const parsedSegment = parsedEdit.segments[index]!;
      const segment = segmentMap.get(parsedSegment.segmentId)!;
      const length = parsedSegment.content.length;
      const contentChanged = contentChangeMap.has(parsedSegment.segmentId);

      updatedChunkRecords.push({
        documentId: session.document.id,
        segmentId: parsedSegment.segmentId,
        nodeId: segment.node.id,
        offset,
        length,
        chunkOrder: index,
        checksum: hashContent(parsedSegment.content),
        createdAt: segment.mapping.createdAt,
        updatedAt: contentChanged || segment.mapping.chunkOrder !== index ? now : segment.mapping.updatedAt,
      });

      offset += length;
      if (index < parsedEdit.segments.length - 1) {
        offset += 2;
      }
    }

    await replaceDocumentChunks(session.document.id, updatedChunkRecords);

    console.log(`✔ Updated document: ${updatedDocument.title}`);
    console.log(`   version: ${session.document.version} → ${updatedDocument.version}`);
    console.log(`   segments changed: ${contentChanges.length}/${parsedEdit.segments.length}`);
    if (contentChanges.length > 0) {
      contentChanges.forEach(({ segment }) => {
        console.log(`     • ${formatId(segment.node.id)} ${segment.node.title}`);
      });
    }
    if (orderChanged) {
      console.log('   segment order updated');
    }
    if (autoLink) {
      console.log(`   links rescored: ${totalAccepted} accepted`);
    } else {
      console.log('   links: rescoring skipped (--no-auto-link)');
    }

    return { preserveTempDir: false };
  } catch (error) {
    console.error(`✖ ${String((error as Error).message)}`);
    console.error(`   Temporary file preserved at: ${filePath}`);
    process.exitCode = 1;
    return { preserveTempDir: true };
  }
}

export async function runNodeSynthesize(ids: string[] | undefined, flags: NodeSynthesizeFlags) {
  if (!ids || ids.length < 2) {
    console.error('✖ Provide at least 2 node IDs to synthesize.');
    console.error('');
    console.error('Usage:');
    console.error('  forest synthesize <id1> <id2> [id3...]');
    console.error('');
    console.error('Example:');
    console.error('  forest synthesize abc123 def456 --preview');
    console.error('');
    console.error('Options:');
    console.error('  --model=gpt-5|gpt-5-mini       Model to use (default: gpt-5)');
    console.error('  --reasoning=minimal|low|medium|high  Reasoning effort (default: high)');
    console.error('  --verbosity=low|medium|high    Output detail (default: high)');
    console.error('  --preview                      Preview without saving');
    console.error('  --max-tokens=N                 Max output tokens (default: auto)');
    console.error('');
    process.exitCode = 1;
    return;
  }

  // Resolve all node IDs
  const resolvedIds: string[] = [];
  console.log(`Resolving ${ids.length} source nodes...`);
  for (const idRef of ids) {
    const node = await resolveNodeReference(idRef.trim());
    if (!node) {
      console.error(`✖ Node not found: ${idRef}`);
      process.exitCode = 1;
      return;
    }
    resolvedIds.push(node.id);
    console.log(`  ✓ ${formatId(node.id)} - ${node.title}`);
  }

  // Validate model and reasoning options
  const config = loadConfig();
  const defaultModel = config.synthesizeModel || 'gpt-5';
  const model = validateModel(flags.model, defaultModel);
  const reasoning = validateReasoning(flags.reasoning);
  const verbosity = validateVerbosity(flags.verbosity);

  console.log('');
  console.log('Synthesis configuration:');
  console.log(`  Model: ${model}`);
  console.log(`  Reasoning: ${reasoning}`);
  console.log(`  Verbosity: ${verbosity}`);
  console.log('');
  console.log('Calling OpenAI API...');

  // Call synthesis core
  const result = await synthesizeNodesCore(resolvedIds, {
    model,
    reasoning,
    verbosity,
    maxTokens: flags.maxTokens,
  });

  // Display results
  console.log('');
  console.log('='.repeat(80));
  console.log(`SYNTHESIS RESULT`);
  console.log('='.repeat(80));
  console.log('');
  console.log(`Title: ${result.title}`);
  console.log('');
  console.log('Tags:', result.suggestedTags.join(', '));
  console.log('');
  console.log('Body Preview (first 500 chars):');
  console.log('-'.repeat(80));
  console.log(result.body.slice(0, 500) + (result.body.length > 500 ? '...' : ''));
  console.log('-'.repeat(80));
  console.log('');
  console.log('Metadata:');
  console.log(`  Model: ${result.model}`);
  console.log(`  Reasoning effort: ${result.reasoningEffort}`);
  console.log(`  Verbosity: ${result.verbosity}`);
  console.log(`  Tokens used: ${result.tokensUsed.reasoning} reasoning + ${result.tokensUsed.output} output`);
  console.log(`  Estimated cost: $${result.cost.toFixed(4)}`);
  console.log(`  Source nodes: ${result.sourceNodeIds.length}`);
  console.log('');

  // If preview mode, stop here
  if (flags.preview) {
    console.log('Preview mode - synthesis not saved.');
    console.log('');
    console.log('Full body:');
    console.log('='.repeat(80));
    console.log(result.body);
    console.log('='.repeat(80));
    return;
  }

  // Save as new node
  console.log('Saving synthesis as new node...');
  const autoLink = typeof flags.autoLink === 'boolean' ? flags.autoLink : true;

  const nodeResult = await createNodeCore({
    title: result.title,
    body: result.body,
    tags: result.suggestedTags,
    autoLink,
  });

  console.log('');
  console.log(`✔ Created synthesis node: ${nodeResult.node.title}`);
  console.log(`   id: ${formatId(nodeResult.node.id)}`);
  console.log(`   tags: ${nodeResult.node.tags.join(', ')}`);
  if (autoLink) {
    console.log(`   edges: ${nodeResult.linking.edgesCreated} accepted`);
  }
  console.log('');
}

export async function runNodeImport(flags: NodeImportFlags) {
  // Resolve document input
  const bodyResult = await resolveBodyInput(undefined, flags.file, flags.stdin);
  const documentText = bodyResult.value;

  if (!documentText || documentText.trim().length === 0) {
    console.error('✖ No document content provided. Use --file or --stdin.');
    process.exitCode = 1;
    return;
  }

  console.log(`Importing document (${documentText.length} characters)...`);

  // Parse tags if provided
  let tags: string[] | undefined;
  if (flags.tags) {
    tags = flags.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  // Call core import function
  const result = await importDocumentCore(documentText, {
    documentTitle: flags.title,
    tags,
    chunkStrategy: validateChunkStrategy(flags.chunkStrategy),
    maxTokens: flags.maxTokens,
    overlap: flags.overlap,
    autoLink: !flags.noAutoLink,
    createParent: !flags.noParent,
    linkSequential: !flags.noSequential,
  });

  // Emit output
  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          documentTitle: result.documentTitle,
          rootNode: result.rootNode
            ? {
                id: result.rootNode.id,
                title: result.rootNode.title,
                tags: result.rootNode.tags,
              }
            : null,
          chunks: result.chunks.map((c) => ({
            id: c.node.id,
            title: c.node.title,
            tags: c.node.tags,
            chunkIndex: c.chunk.metadata.chunkIndex,
            estimatedTokens: c.chunk.metadata.estimatedTokens,
          })),
          totalChunks: result.totalChunks,
          linking: result.linking,
        },
        null,
        2
      )
    );
    return;
  }

  // Text output
  console.log('');
  console.log(`✔ Imported document: ${result.documentTitle}`);
  console.log(`   Total chunks: ${result.totalChunks}`);

  if (result.rootNode) {
    console.log(`   Root node: ${formatId(result.rootNode.id)} - ${result.rootNode.title}`);
  }

  console.log('');
  console.log('Chunks:');
  for (const { node, chunk } of result.chunks) {
    console.log(`  ${formatId(node.id)} - ${node.title} (~${chunk.metadata.estimatedTokens} tokens)`);
  }

  console.log('');
  console.log('Linking:');
  console.log(`  Parent-child edges: ${result.linking.parentChildEdges}`);
  console.log(`  Sequential edges: ${result.linking.sequentialEdges}`);
  console.log(`  Semantic edges: ${result.linking.semanticAccepted} accepted`);
  console.log('');
}

function validateChunkStrategy(strategyFlag: string | undefined): 'headers' | 'size' | 'hybrid' {
  if (!strategyFlag) return 'headers';
  const normalized = strategyFlag.toLowerCase();
  if (normalized === 'headers' || normalized === 'size' || normalized === 'hybrid') {
    return normalized;
  }
  console.error(`⚠ Invalid chunk strategy "${strategyFlag}", using default: headers`);
  return 'headers';
}

function validateModel(modelFlag: string | undefined, defaultModel: SynthesisModel): SynthesisModel {
  if (!modelFlag) return defaultModel;
  const normalized = modelFlag.toLowerCase();
  if (normalized === 'gpt-5' || normalized === 'gpt-5-mini') {
    return normalized as SynthesisModel;
  }
  console.error(`⚠ Invalid model "${modelFlag}", using default: ${defaultModel}`);
  return defaultModel;
}

function validateReasoning(reasoningFlag: string | undefined): ReasoningEffort {
  if (!reasoningFlag) return 'high';
  const normalized = reasoningFlag.toLowerCase();
  if (['minimal', 'low', 'medium', 'high'].includes(normalized)) {
    return normalized as ReasoningEffort;
  }
  console.error(`⚠ Invalid reasoning effort "${reasoningFlag}", using default: high`);
  return 'high';
}

function validateVerbosity(verbosityFlag: string | undefined): TextVerbosity {
  if (!verbosityFlag) return 'high';
  const normalized = verbosityFlag.toLowerCase();
  if (['low', 'medium', 'high'].includes(normalized)) {
    return normalized as TextVerbosity;
  }
  console.error(`⚠ Invalid verbosity "${verbosityFlag}", using default: high`);
  return 'high';
}
