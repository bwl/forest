import { formatId, handleError } from '../shared/utils';
import { getBackend } from '../shared/remote';

type ClercModule = typeof import('clerc');
type ClercInstance = ReturnType<ClercModule['Clerc']['create']>;

type DocumentsListFlags = {
  json?: boolean;
};

type DocumentsShowFlags = {
  json?: boolean;
  chunks?: boolean;
};

async function runDocumentsList(flags: DocumentsListFlags) {
  const backend = getBackend();
  const result = await backend.listDocuments();

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.documents.length === 0) {
    console.log('No documents found.');
    return;
  }

  console.log(`\nFound ${result.documents.length} document(s):\n`);

  for (const doc of result.documents) {
    const metadata = doc.metadata as any;
    const chunkCount = metadata?.chunkCount ?? 0;
    const version = doc.version;

    console.log(`  ${formatId(doc.id)} ${doc.title}`);
    console.log(`    version: ${version}, chunks: ${chunkCount}, updated: ${doc.updatedAt.split('T')[0]}`);
  }

  console.log();
}

async function resolveDocumentId(idRef: string): Promise<string | null> {
  const backend = getBackend();
  const { documents } = await backend.listDocuments();
  // Exact match first
  const exact = documents.find((d) => d.id === idRef);
  if (exact) return exact.id;

  // Prefix match (case-insensitive, dash-insensitive)
  const prefix = idRef.replace(/-/g, '').toLowerCase();
  const matches = documents.filter((d) =>
    d.id.replace(/-/g, '').toLowerCase().startsWith(prefix)
  );

  if (matches.length === 1) return matches[0].id;

  if (matches.length > 1) {
    console.error(`✖ Ambiguous document ID '${idRef}' matches ${matches.length} documents:`);
    for (const m of matches.slice(0, 5)) {
      console.error(`  ${formatId(m.id)}  ${m.title}`);
    }
    return null;
  }

  console.error(`✖ No document matching '${idRef}'`);
  return null;
}

async function runDocumentsShow(idRef: string | undefined, flags: DocumentsShowFlags) {
  if (!idRef) {
    console.error('✖ Provide a document ID');
    process.exitCode = 1;
    return;
  }

  const resolvedId = await resolveDocumentId(idRef);
  if (!resolvedId) {
    process.exitCode = 1;
    return;
  }

  const backend = getBackend();
  const result = await backend.getDocument(resolvedId);
  const document = result.document;

  if (flags.json) {
    const output: any = { document };
    if (flags.chunks) {
      const chunksResult = await backend.getDocumentChunks(document.id);
      output.chunks = chunksResult.chunks;
    }
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const metadata = document.metadata as any;

  console.log(`\nDocument: ${document.title}`);
  console.log(`  ID: ${document.id}`);
  console.log(`  Version: ${document.version}`);
  console.log(`  Root Node: ${document.rootNodeId ? formatId(document.rootNodeId) : '(none)'}`);
  console.log(`  Created: ${document.createdAt}`);
  console.log(`  Updated: ${document.updatedAt}`);

  if (metadata) {
    console.log(`\n  Metadata:`);
    if (metadata.chunkStrategy) console.log(`    Chunk Strategy: ${metadata.chunkStrategy}`);
    if (metadata.chunkCount) console.log(`    Chunk Count: ${metadata.chunkCount}`);
    if (metadata.maxTokens) console.log(`    Max Tokens: ${metadata.maxTokens}`);
    if (metadata.overlap) console.log(`    Overlap: ${metadata.overlap}`);
    if (metadata.source) console.log(`    Source: ${metadata.source}`);
    if (metadata.lastEditedAt) console.log(`    Last Edited: ${metadata.lastEditedAt}`);
    if (metadata.lastEditedNodeId) console.log(`    Last Edited Node: ${formatId(metadata.lastEditedNodeId)}`);
  }

  if (flags.chunks) {
    const chunksResult = await backend.getDocumentChunks(document.id);
    console.log(`\n  Chunks (${chunksResult.chunks.length}):`);
    for (const chunk of chunksResult.chunks) {
      console.log(`    [${chunk.chunkOrder}] ${formatId(chunk.segmentId)}`);
      console.log(`        offset: ${chunk.offset}, length: ${chunk.length}, checksum: ${chunk.checksum.substring(0, 8)}`);
    }
  }

  console.log();
}

type DocumentsDeleteFlags = {
  force?: boolean;
  json?: boolean;
};

async function runDocumentsDelete(idRef: string | undefined, flags: DocumentsDeleteFlags) {
  if (!idRef) {
    console.error('Provide a document ID');
    process.exitCode = 1;
    return;
  }

  const resolvedId = await resolveDocumentId(idRef);
  if (!resolvedId) {
    process.exitCode = 1;
    return;
  }

  const backend = getBackend();
  const { document } = await backend.getDocument(resolvedId);
  const metadata = document.metadata as any;
  const chunkCount = metadata?.chunkCount ?? 0;

  if (!flags.force) {
    console.log(`\nAbout to delete document: "${document.title}" (${formatId(document.id)})`);
    console.log(`  This will remove the document record, its root node, and ${chunkCount} chunk(s).`);
    console.log(`  Use --force to confirm.\n`);
    return;
  }

  const result = await backend.deleteDocument(resolvedId);

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Deleted "${document.title}" (${formatId(document.id)})`);
  console.log(`  ${result.deleted.nodesRemoved} nodes removed, ${result.deleted.edgesRemoved} edges removed`);
}

async function runDocumentsStats(flags: { json?: boolean }) {
  const backend = getBackend();
  const stats = await backend.getDocumentStats();

  if (flags.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log(`\nDocument Statistics:\n`);
  console.log(`  Total Documents: ${stats.totalDocuments}`);
  console.log(`  Total Chunks: ${stats.totalChunks}`);
  console.log(`  Avg Chunks/Doc: ${stats.avgChunksPerDocument}`);
  console.log(`  Avg Version: ${stats.avgVersion}`);

  if (Object.keys(stats.bySource).length > 0) {
    console.log(`\n  By Source:`);
    for (const [source, count] of Object.entries(stats.bySource)) {
      console.log(`    ${source}: ${count}`);
    }
  }

  if (Object.keys(stats.byStrategy).length > 0) {
    console.log(`\n  By Strategy:`);
    for (const [strategy, count] of Object.entries(stats.byStrategy)) {
      console.log(`    ${strategy}: ${count}`);
    }
  }

  console.log();
}

export function registerDocumentsCommands(cli: ClercInstance, clerc: ClercModule) {
  const documentsCommand = clerc.defineCommand({
    name: 'documents',
    description: 'Manage canonical documents',
  });

  const listCommand = clerc.defineCommand(
    {
      name: 'documents list',
      description: 'List all canonical documents',
      flags: {
        json: {
          type: Boolean,
          description: 'Output as JSON',
        },
      },
    },
    async (ctx: any) => {
      await runDocumentsList(ctx.flags as DocumentsListFlags);
    }
  );

  const showCommand = clerc.defineCommand(
    {
      name: 'documents show',
      description: 'Show document details',
      parameters: ['[id]'],
      flags: {
        json: {
          type: Boolean,
          description: 'Output as JSON',
        },
        chunks: {
          type: Boolean,
          description: 'Include chunk details',
        },
      },
    },
    async (ctx: any) => {
      await runDocumentsShow(ctx.parameters.id as string | undefined, ctx.flags as DocumentsShowFlags);
    }
  );

  const statsCommand = clerc.defineCommand(
    {
      name: 'documents stats',
      description: 'Show document statistics',
      flags: {
        json: {
          type: Boolean,
          description: 'Output as JSON',
        },
      },
    },
    async (ctx: any) => {
      await runDocumentsStats(ctx.flags as { json?: boolean });
    }
  );

  const deleteCommand = clerc.defineCommand(
    {
      name: 'documents delete',
      description: 'Delete a document and all its chunks',
      parameters: ['[id]'],
      flags: {
        force: {
          type: Boolean,
          description: 'Skip confirmation',
        },
        json: {
          type: Boolean,
          description: 'Output as JSON',
        },
      },
    },
    async (ctx: any) => {
      await runDocumentsDelete(ctx.parameters.id as string | undefined, ctx.flags as DocumentsDeleteFlags);
    }
  );

  cli.command(listCommand);
  cli.command(showCommand);
  cli.command(deleteCommand);
  cli.command(statsCommand);
  cli.command(documentsCommand);
}
