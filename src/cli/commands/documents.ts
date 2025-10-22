import { listDocuments, getDocumentById, getDocumentChunks, DocumentRecord } from '../../lib/db';
import { formatId } from '../shared/utils';

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
  const documents = await listDocuments();

  if (flags.json) {
    console.log(JSON.stringify(documents, null, 2));
    return;
  }

  if (documents.length === 0) {
    console.log('No documents found.');
    return;
  }

  console.log(`\nFound ${documents.length} document(s):\n`);

  for (const doc of documents) {
    const metadata = doc.metadata;
    const chunkCount = metadata?.chunkCount ?? 0;
    const version = doc.version;

    console.log(`  ${formatId(doc.id)} ${doc.title}`);
    console.log(`    version: ${version}, chunks: ${chunkCount}, updated: ${doc.updatedAt.split('T')[0]}`);
  }

  console.log();
}

async function runDocumentsShow(idRef: string | undefined, flags: DocumentsShowFlags) {
  if (!idRef) {
    console.error('✖ Provide a document ID');
    process.exitCode = 1;
    return;
  }

  const document = await getDocumentById(idRef);
  if (!document) {
    console.error(`✖ Document with ID '${idRef}' not found`);
    process.exitCode = 1;
    return;
  }

  if (flags.json) {
    const output: any = { document };
    if (flags.chunks) {
      const chunks = await getDocumentChunks(document.id);
      output.chunks = chunks;
    }
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const metadata = document.metadata;

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
    const chunks = await getDocumentChunks(document.id);
    console.log(`\n  Chunks (${chunks.length}):`);
    for (const chunk of chunks) {
      console.log(`    [${chunk.chunkOrder}] ${formatId(chunk.segmentId)}`);
      console.log(`        offset: ${chunk.offset}, length: ${chunk.length}, checksum: ${chunk.checksum.substring(0, 8)}`);
    }
  }

  console.log();
}

async function runDocumentsStats(flags: { json?: boolean }) {
  const documents = await listDocuments();

  let totalChunks = 0;
  let totalVersions = 0;
  const sources = new Map<string, number>();
  const strategies = new Map<string, number>();

  for (const doc of documents) {
    const metadata = doc.metadata;
    totalVersions += doc.version;

    if (metadata) {
      if (metadata.chunkCount) totalChunks += metadata.chunkCount;
      if (metadata.source) {
        sources.set(metadata.source, (sources.get(metadata.source) ?? 0) + 1);
      }
      if (metadata.chunkStrategy) {
        strategies.set(metadata.chunkStrategy, (strategies.get(metadata.chunkStrategy) ?? 0) + 1);
      }
    }
  }

  const avgVersion = documents.length > 0 ? (totalVersions / documents.length).toFixed(1) : '0';
  const avgChunks = documents.length > 0 ? (totalChunks / documents.length).toFixed(1) : '0';

  if (flags.json) {
    console.log(JSON.stringify({
      totalDocuments: documents.length,
      totalChunks,
      avgChunksPerDocument: parseFloat(avgChunks),
      avgVersion: parseFloat(avgVersion),
      bySource: Object.fromEntries(sources),
      byStrategy: Object.fromEntries(strategies),
    }, null, 2));
    return;
  }

  console.log(`\nDocument Statistics:\n`);
  console.log(`  Total Documents: ${documents.length}`);
  console.log(`  Total Chunks: ${totalChunks}`);
  console.log(`  Avg Chunks/Doc: ${avgChunks}`);
  console.log(`  Avg Version: ${avgVersion}`);

  if (sources.size > 0) {
    console.log(`\n  By Source:`);
    for (const [source, count] of sources) {
      console.log(`    ${source}: ${count}`);
    }
  }

  if (strategies.size > 0) {
    console.log(`\n  By Strategy:`);
    for (const [strategy, count] of strategies) {
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
      const [id] = ctx.parameters._;
      await runDocumentsShow(id as string | undefined, ctx.flags as DocumentsShowFlags);
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

  cli.command(listCommand);
  cli.command(showCommand);
  cli.command(statsCommand);
  cli.command(documentsCommand);
}
