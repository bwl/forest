import {
  beginBatch,
  bulkSyncNodeTags,
  bulkUpdateEdgesV2,
  countEdges,
  deleteSelfLoopEdges,
  endBatch,
  getDegreeConsistencyReport,
  listDocuments,
  getDocumentChunks,
  getNodeById,
  listEdges,
  listNodes,
  rebuildAcceptedDegreeCounters,
  rebuildTagIdf,
  updateNode,
} from '../../lib/db';
import { computeEmbeddingForNode, embeddingsEnabled } from '../../lib/embeddings';
import { buildTagIdfContext, classifyEdgeScores, computeEdgeScore, normalizeEdgePair } from '../../lib/scoring';
import { extractTagsAsync } from '../../lib/text';
import { loadConfig } from '../../lib/config';
import { getHealthReport, isHealthy, HealthCheck } from '../../core/health';
import { composeChunkTitle } from '../../core/import';
import { rescoreNode } from '../shared/linking';

import { handleError } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { getBackend } from '../shared/remote';

type ClercModule = typeof import('clerc');
type ClercInstance = ReturnType<ClercModule['Clerc']['create']>;

// === Flag Types ===

type AdminEmbeddingsFlags = {
  rescore?: boolean;
  tldr?: string;
};

type AdminRescoreFlags = {
  tldr?: string;
};

type AdminRebuildDegreesFlags = {
  'clean-self-loops'?: boolean;
  json?: boolean;
  tldr?: string;
};

type AdminTagsFlags = {
  'dry-run'?: boolean;
  limit?: number;
  skip?: number;
  'skip-unchanged'?: boolean;
  tldr?: string;
};

type AdminHealthFlags = {
  json?: boolean;
  tldr?: string;
};

type AdminDoctorFlags = {
  tldr?: string;
};

type AdminMigrateV2Flags = {
  tldr?: string;
};

type AdminBackfillChunkTitlesFlags = {
  'dry-run'?: boolean;
  tldr?: string;
};

type AdminBaseFlags = {
  tldr?: string;
};

// === Command Registration ===

export function registerAdminCommands(cli: ClercInstance, clerc: ClercModule) {
  // admin migrate-v2
  const migrateV2Command = clerc.defineCommand(
    {
      name: 'admin migrate-v2',
      description: 'Migrate database to scoring v2 (dual semantic/tag scores)',
      flags: {
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }: { flags: AdminMigrateV2Flags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['admin.migrate-v2'], getVersion(), jsonMode);
        }
        await runAdminMigrateV2();
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(migrateV2Command);

  // admin embeddings
  const embeddingsCommand = clerc.defineCommand(
    {
      name: 'admin embeddings',
      description: 'Recompute embeddings for all nodes; optionally rescore links',
      flags: {
        rescore: {
          type: Boolean,
          description: 'Rescore all edges after computing embeddings',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }: { flags: AdminEmbeddingsFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['admin.embeddings'], getVersion(), jsonMode);
        }
        await runAdminEmbeddings(flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(embeddingsCommand);

  // admin rescore
  const rescoreCommand = clerc.defineCommand(
    {
      name: 'admin rescore',
      description: 'Rescore all edges using current embeddings and scoring rules',
      flags: {
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }: { flags: AdminRescoreFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['admin.rescore'], getVersion(), jsonMode);
        }
        await runAdminRescore();
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(rescoreCommand);

  // admin rebuild-degrees
  const rebuildDegreesCommand = clerc.defineCommand(
    {
      name: 'admin rebuild-degrees',
      description: 'Rebuild accepted_degree counters from the current edge table',
      flags: {
        'clean-self-loops': {
          type: Boolean,
          description: 'Delete self-loop edges before rebuilding counters',
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
    async ({ flags }: { flags: AdminRebuildDegreesFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['admin.rebuild-degrees'], getVersion(), jsonMode);
        }
        await runAdminRebuildDegrees(flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(rebuildDegreesCommand);

  // admin tags
  const tagsCommand = clerc.defineCommand(
    {
      name: 'admin tags',
      description: 'Regenerate tags for all nodes using current tagging method',
      flags: {
        'dry-run': {
          type: Boolean,
          description: 'Preview changes without saving',
        },
        limit: {
          type: Number,
          description: 'Only retag N nodes (for testing)',
        },
        skip: {
          type: Number,
          description: 'Skip first N nodes before starting',
          default: 0,
        },
        'skip-unchanged': {
          type: Boolean,
          description: 'Skip nodes where tags would not change',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }: { flags: AdminTagsFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['admin.tags'], getVersion(), jsonMode);
        }
        await runAdminTags(flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(tagsCommand);

  // admin health
  const healthCommand = clerc.defineCommand(
    {
      name: 'admin health',
      description: 'Check system health and configuration status',
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
    async ({ flags }: { flags: AdminHealthFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['admin.health'], getVersion(), jsonMode);
        }
        await runAdminHealth(flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(healthCommand);

  // admin doctor
  const doctorCommand = clerc.defineCommand(
    {
      name: 'admin doctor',
      description: 'Guided setup and troubleshooting wizard',
      flags: {
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }: { flags: AdminDoctorFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['admin.doctor'], getVersion(), jsonMode);
        }
        await runAdminDoctor();
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(doctorCommand);

  // admin backfill-chunk-titles
  const backfillChunkTitlesCommand = clerc.defineCommand(
    {
      name: 'admin backfill-chunk-titles',
      description: 'Rename existing chunk nodes to use the new "Doc [2/7] Section" format',
      flags: {
        'dry-run': {
          type: Boolean,
          description: 'Preview changes without saving',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }: { flags: AdminBackfillChunkTitlesFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['admin.backfill-chunk-titles'], getVersion(), jsonMode);
        }
        await runAdminBackfillChunkTitles(flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(backfillChunkTitlesCommand);

  // admin (base command)
  const baseCommand = clerc.defineCommand(
    {
      name: 'admin',
      description: 'System maintenance and diagnostics',
      flags: {
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
      help: {
        notes: [
          'Administrative commands for system maintenance.',
          '',
          'Subcommands:',
          '  migrate-v2              Migrate database to scoring v2',
          '  embeddings              Recompute embeddings for all nodes',
          '  rescore                 Rescore all edges using current embeddings',
          '  rebuild-degrees         Rebuild degree counters from edge rows',
          '  tags                    Regenerate tags using current method',
          '  backfill-chunk-titles   Rename chunks to "Doc [2/7] Section" format',
          '  health                  Check system health and configuration',
          '  doctor                  Guided setup and troubleshooting',
          '',
          'Use `forest admin <subcommand> --help` for flag details.',
        ],
        examples: [
          ['$ forest admin health', 'Check system health'],
          ['$ forest admin embeddings --rescore', 'Recompute embeddings and rescore edges'],
          ['$ forest admin rescore', 'Rescore edges without recomputing embeddings'],
          ['$ forest admin rebuild-degrees --clean-self-loops', 'Repair stale counters and remove self-loops'],
          ['$ forest admin tags --dry-run', 'Preview tag regeneration'],
        ],
      },
    },
    async ({ flags }: { flags: AdminBaseFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.admin, getVersion(), jsonMode);
        }
        // Show help summary when invoked without subcommand
        console.log('forest admin - System maintenance and diagnostics');
        console.log('');
        console.log('Subcommands:');
        console.log('  migrate-v2              Migrate database to scoring v2');
        console.log('  embeddings              Recompute embeddings for all nodes');
        console.log('  rescore                 Rescore all edges using current embeddings');
        console.log('  rebuild-degrees         Rebuild degree counters from edge rows');
        console.log('  tags                    Regenerate tags using current method');
        console.log('  backfill-chunk-titles   Rename chunks to "Doc [2/7] Section" format');
        console.log('  health                  Check system health and configuration');
        console.log('  doctor                  Guided setup and troubleshooting');
        console.log('');
        console.log('Use `forest admin <subcommand> --help` for details.');
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(baseCommand);
}

// === Implementation Functions ===

async function runAdminMigrateV2() {
  console.log('forest admin migrate-v2');
  console.log('');

  const nodes = await listNodes();
  const edges = await listEdges('all');

  console.log(`Found ${nodes.length} nodes and ${edges.length} edges`);
  console.log('');

  console.log('1) Backfilling node_tags...');
  await bulkSyncNodeTags(nodes.map((node) => ({ nodeId: node.id, tags: node.tags })));
  console.log('   ✔ node_tags updated');

  console.log('2) Rebuilding tag_idf...');
  const idf = await rebuildTagIdf();
  console.log(`   ✔ tag_idf rebuilt (${idf.totalTags} tags, N=${idf.totalNodes})`);

  console.log('3) Backfilling edge v2 columns...');
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const context = buildTagIdfContext(nodes);

  const updates: Array<{
    sourceId: string;
    targetId: string;
    semanticScore: number | null;
    tagScore: number | null;
    sharedTags: string[];
    metadata: Record<string, unknown> | null;
  }> = [];
  let skipped = 0;

  for (const edge of edges) {
    const a = nodeMap.get(edge.sourceId);
    const b = nodeMap.get(edge.targetId);
    if (!a || !b) {
      skipped += 1;
      continue;
    }

    const computed = computeEdgeScore(a, b, context);
    const shouldBackfillSemanticScore = edge.edgeType === 'semantic' && edge.semanticScore === null && edge.tagScore === null;

    const prevMetadata = edge.metadata && typeof edge.metadata === 'object' ? edge.metadata : {};
    const prevComponents =
      (prevMetadata as any).components && typeof (prevMetadata as any).components === 'object'
        ? (prevMetadata as any).components
        : {};

    updates.push({
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      // Migration path: preserve legacy `score` and copy it into semantic_score for now.
      semanticScore: shouldBackfillSemanticScore ? edge.score : edge.semanticScore,
      tagScore: edge.tagScore ?? computed.tagScore,
      sharedTags: edge.tagScore === null ? computed.sharedTags : edge.sharedTags,
      metadata: {
        ...prevMetadata,
        components: {
          ...prevComponents,
          tag: computed.components.tag,
        },
      },
    });
  }

  const result = await bulkUpdateEdgesV2(updates);
  console.log(`   ✔ updated ${result.updated} edges (${skipped} skipped: missing endpoints)`);
  console.log('');
  console.log('Migration complete.');
}

async function runAdminEmbeddings(flags: AdminEmbeddingsFlags) {
  if (!embeddingsEnabled()) {
    console.log('Embeddings are disabled (FOREST_EMBED_PROVIDER=none). Nothing to do.');
    return;
  }

  const nodes = await listNodes();
  let updated = 0;
  for (const node of nodes) {
    const embedding = await computeEmbeddingForNode({ title: node.title, body: node.body });
    if (!embedding) continue;
    await updateNode(node.id, { embedding });
    updated += 1;
  }
  console.log(`Recomputed embeddings for ${updated} nodes`);

  if (!flags.rescore) return;

  console.log('Rescoring graph using updated embeddings...');
  const result = await rescoreAllEdges();
  console.log(`Rescored graph: ${result.finalAcceptedEdges} accepted edges (${result.edgesTouched} writes)`);
}

async function runAdminRescore() {
  console.log('forest admin rescore');
  console.log('');
  console.log('Rescoring all edges using current embeddings, thresholds, and project-edge caps...');
  const result = await rescoreAllEdges();
  console.log(`Processed: ${result.processedNodes} nodes`);
  console.log(`Touched:   ${result.edgesTouched} edge writes`);
  console.log(`Accepted:  ${result.finalAcceptedEdges} edges in graph`);
  if (result.selfLoopsRemoved > 0) {
    console.log(`Removed:   ${result.selfLoopsRemoved} self-loop edges`);
  }
  if (result.degreeRepair.before.mismatchedNodes > 0 || result.degreeRepair.after.mismatchedNodes > 0) {
    console.log(
      `Degree repair: ${result.degreeRepair.before.mismatchedNodes} -> ${result.degreeRepair.after.mismatchedNodes} mismatches`,
    );
  }
}

async function rescoreAllEdges(): Promise<{
  processedNodes: number;
  edgesTouched: number;
  finalAcceptedEdges: number;
  selfLoopsRemoved: number;
  degreeRepair: Awaited<ReturnType<typeof rebuildAcceptedDegreeCounters>>;
}> {
  const refreshed = await listNodes();
  const selfLoopCleanup = await deleteSelfLoopEdges();

  let edgesTouched = 0;
  await beginBatch();
  try {
    for (const node of refreshed) {
      const result = await rescoreNode(node, {
        allNodes: refreshed,
        manageBatch: false,
      });
      edgesTouched += result.accepted;
    }
  } finally {
    await endBatch();
  }

  const degreeRepair = await rebuildAcceptedDegreeCounters();
  const finalAcceptedEdges = await countEdges('accepted');
  return {
    processedNodes: refreshed.length,
    edgesTouched,
    finalAcceptedEdges,
    selfLoopsRemoved: selfLoopCleanup.removed,
    degreeRepair,
  };
}

async function runAdminRebuildDegrees(flags: AdminRebuildDegreesFlags) {
  const cleanSelfLoops = Boolean(flags['clean-self-loops']);
  const asJson = Boolean(flags.json);

  const before = await getDegreeConsistencyReport();
  let selfLoopsRemoved = 0;
  if (cleanSelfLoops) {
    const cleaned = await deleteSelfLoopEdges();
    selfLoopsRemoved = cleaned.removed;
  }
  const rebuilt = await rebuildAcceptedDegreeCounters();
  const edgeCount = await countEdges('accepted');

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          selfLoopsRemoved,
          edgesAccepted: edgeCount,
          before,
          rebuild: rebuilt,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log('forest admin rebuild-degrees');
  console.log('');
  if (cleanSelfLoops) {
    console.log(`Self-loops removed: ${selfLoopsRemoved}`);
  }
  console.log(`Degree mismatches: ${before.mismatchedNodes} -> ${rebuilt.after.mismatchedNodes}`);
  console.log(`Max degree delta:  ${before.maxAbsDelta} -> ${rebuilt.after.maxAbsDelta}`);
  console.log(`Accepted edges:    ${edgeCount}`);
}

async function runAdminTags(flags: AdminTagsFlags) {
  const dryRun = flags['dry-run'] || false;
  const limit = flags.limit;
  const skip = flags.skip || 0;
  const skipUnchanged = flags['skip-unchanged'] || false;

  const config = loadConfig();

  // Show tagging method
  console.log(`Tagging method: ${config.taggingMethod || 'lexical'}`);
  if (config.taggingMethod === 'llm') {
    console.log(`LLM model: ${config.llmTaggerModel || 'gpt-5-nano'}`);
  }
  if (dryRun) {
    console.log('DRY RUN - no changes will be saved\n');
  }

  // Load all nodes
  const allNodes = await listNodes();
  const endIndex = limit ? skip + limit : allNodes.length;
  const nodes = allNodes.slice(skip, endIndex);

  if (skip > 0) {
    console.log(`Skipping first ${skip} nodes...`);
  }
  console.log(`Processing ${nodes.length} nodes (${skip + 1}-${skip + nodes.length} of ${allNodes.length})...\n`);

  let changed = 0;
  let unchanged = 0;
  let errors = 0;
  let totalCost = 0;

  const samples: Array<{ id: string; title: string; before: string[]; after: string[] }> = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const progress = `[${skip + i + 1}/${allNodes.length}]`;

    try {
      // Generate new tags
      const text = `${node.title}\n${node.body}`;
      const newTags = await extractTagsAsync(text, node.title);

      // Check if tags changed
      const oldTagsSet = new Set(node.tags);
      const newTagsSet = new Set(newTags);
      const tagsChanged =
        oldTagsSet.size !== newTagsSet.size ||
        ![...oldTagsSet].every((tag) => newTagsSet.has(tag));

      if (!tagsChanged && skipUnchanged) {
        console.log(`${progress} SKIP ${node.id.slice(0, 8)} - tags unchanged`);
        unchanged++;
        continue;
      }

      // Track sample changes
      if (samples.length < 5 && tagsChanged) {
        samples.push({
          id: node.id.slice(0, 8),
          title: node.title.slice(0, 50),
          before: node.tags,
          after: newTags,
        });
      }

      if (tagsChanged) {
        if (!dryRun) {
          // Update node in database
          await updateNode(node.id, {
            tags: newTags,
          });
        }

        console.log(
          `${progress} UPDATE ${node.id.slice(0, 8)} - ${node.title.slice(0, 40)}`,
        );
        console.log(`  Before: ${node.tags.join(', ')}`);
        console.log(`  After:  ${newTags.join(', ')}`);
        changed++;
      } else {
        unchanged++;
      }

      // Estimate cost if using LLM
      if (config.taggingMethod === 'llm') {
        // Rough estimate: ~$0.000005 per note for gpt-5-nano
        const costPerNote = 0.000005;
        totalCost += costPerNote;
      }
    } catch (err: any) {
      console.error(`${progress} ERROR ${node.id.slice(0, 8)} - ${err.message}`);
      errors++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Processed: ${nodes.length} nodes`);
  console.log(`Changed:   ${changed}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Errors:    ${errors}`);

  if (config.taggingMethod === 'llm') {
    console.log(`Est. cost: $${totalCost.toFixed(4)}`);
  }

  if (dryRun) {
    console.log('\nDRY RUN - no changes were saved');
  }

  // Show sample changes
  if (samples.length > 0) {
    console.log('\nSample tag changes:');
    for (const sample of samples) {
      console.log(`\n  ${sample.id} - ${sample.title}`);
      console.log(`    Before: ${sample.before.join(', ')}`);
      console.log(`    After:  ${sample.after.join(', ')}`);
    }
  }

  console.log('\nRetagging complete');
}

async function runAdminHealth(flags: AdminHealthFlags) {
  const backend = getBackend();

  if (backend.isRemote) {
    const health = await backend.getHealth();
    if (flags.json) {
      console.log(JSON.stringify(health, null, 2));
      return;
    }

    console.log('forest health (remote)');
    console.log('');
    console.log(`Status: ${health.status}`);
    console.log(`Database: ${health.database.connected ? 'connected' : 'disconnected'}${health.database.path ? ` (${health.database.path})` : ''}`);
    if (typeof health.database.size === 'number') {
      const sizeMB = (health.database.size / (1024 * 1024)).toFixed(2);
      console.log(`  size: ${sizeMB} MB`);
    }
    console.log(`Embeddings: ${health.embeddings.provider} (${health.embeddings.available ? 'available' : 'unavailable'})`);
    if (health.invariants?.degreeConsistency) {
      const degree = health.invariants.degreeConsistency;
      console.log(`Degree counters: ${degree.status}${typeof degree.mismatchedNodes === 'number' ? ` (${degree.mismatchedNodes} mismatches)` : ''}`);
      if (degree.message) {
        console.log(`  ${degree.message}`);
      }
    }
    console.log(`Uptime: ${Math.floor(health.uptime)}s`);
    return;
  }

  // Local mode: use detailed health report
  const report = await getHealthReport();

  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('forest health');
  console.log('');

  printCheck('Database', report.database);
  if (report.database.path) {
    console.log(`  path: ${report.database.path}`);
  }
  if (typeof report.database.sizeBytes === 'number') {
    const sizeMB = (report.database.sizeBytes / (1024 * 1024)).toFixed(2);
    console.log(`  size: ${sizeMB} MB`);
  }
  console.log('');

  printCheck('Degree Counters', report.degreeConsistency);
  if (typeof report.degreeConsistency.mismatchedNodes === 'number') {
    console.log(`  mismatched nodes: ${report.degreeConsistency.mismatchedNodes}`);
  }
  if (typeof report.degreeConsistency.maxAbsDelta === 'number') {
    console.log(`  max absolute delta: ${report.degreeConsistency.maxAbsDelta}`);
  }
  console.log('');

  printCheck('Embedding Provider', report.embeddingProvider);
  if (report.embeddingProvider.provider) {
    console.log(`  provider: ${report.embeddingProvider.provider}`);
  }
  if (report.embeddingProvider.model) {
    console.log(`  model: ${report.embeddingProvider.model}`);
  }
  console.log('');

  if (report.openaiKey) {
    printCheck('OpenAI API Key', report.openaiKey);
    console.log('');
  }

  if (report.openrouterKey) {
    printCheck('OpenRouter API Key', report.openrouterKey);
    console.log('');
  }

  if (isHealthy(report)) {
    console.log('All systems operational');
  } else {
    console.log('Some checks failed. Review the output above.');
    process.exitCode = 1;
  }
}

function printCheck(label: string, check: HealthCheck) {
  const icon = check.status === 'ok' ? '+' : check.status === 'warning' ? '!' : 'x';
  console.log(`[${icon}] ${label}: ${check.message}`);
}

async function runAdminBackfillChunkTitles(flags: AdminBackfillChunkTitlesFlags) {
  const dryRun = flags['dry-run'] || false;

  if (dryRun) {
    console.log('DRY RUN - no changes will be saved\n');
  }

  const documents = await listDocuments();
  if (documents.length === 0) {
    console.log('No documents found. Nothing to backfill.');
    return;
  }

  console.log(`Found ${documents.length} document(s). Scanning chunks...\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const samples: Array<{ id: string; before: string; after: string }> = [];

  if (!dryRun) {
    await beginBatch();
  }

  try {
    for (const doc of documents) {
      const chunks = await getDocumentChunks(doc.id);
      if (chunks.length === 0) continue;

      const totalChunks = chunks.length;

      for (const chunk of chunks) {
        const node = await getNodeById(chunk.nodeId);
        if (!node) {
          errors++;
          continue;
        }

        // The current node.title IS the raw section title for old chunks.
        // For already-backfilled chunks, composeChunkTitle should produce the same title.
        const newTitle = composeChunkTitle(doc.title, chunk.chunkOrder, totalChunks, node.title);

        if (newTitle === node.title) {
          skipped++;
          continue;
        }

        if (samples.length < 5) {
          samples.push({
            id: node.id.slice(0, 8),
            before: node.title,
            after: newTitle,
          });
        }

        if (!dryRun) {
          await updateNode(node.id, { title: newTitle });
        }

        console.log(`[${node.id.slice(0, 8)}] "${node.title}" → "${newTitle}"`);
        updated++;
      }
    }
  } finally {
    if (!dryRun) {
      await endBatch();
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Documents: ${documents.length}`);
  console.log(`Updated:   ${updated}`);
  console.log(`Skipped:   ${skipped} (already correct)`);
  console.log(`Errors:    ${errors}`);

  if (dryRun) {
    console.log('\nDRY RUN - no changes were saved');
  }

  if (samples.length > 0) {
    console.log('\nSample renames:');
    for (const s of samples) {
      console.log(`  ${s.id}: "${s.before}" → "${s.after}"`);
    }
  }

  console.log('\nBackfill complete.');
}

async function runAdminDoctor() {
  console.log('forest admin doctor');
  console.log('');
  console.log('This wizard helps diagnose and fix common issues.');
  console.log('');

  // Run health check first
  const report = await getHealthReport();

  console.log('Checking system health...');
  console.log('');

  const issues: string[] = [];

  // Check database
  if (report.database.status !== 'ok') {
    issues.push(`Database: ${report.database.message}`);
  }

  // Check degree consistency
  if (report.degreeConsistency.status !== 'ok') {
    issues.push(`Degree counters: ${report.degreeConsistency.message}`);
    console.log('Tip: Run `forest admin rebuild-degrees --clean-self-loops` to repair counters.');
    console.log('');
  }

  // Check embedding provider
  if (report.embeddingProvider.status !== 'ok') {
    issues.push(`Embedding provider: ${report.embeddingProvider.message}`);
    console.log('Tip: Set FOREST_EMBED_PROVIDER to configure embeddings.');
    console.log('  Options: openrouter (default), openai, none');
    console.log('');
  }

  // Check OpenAI key if using OpenAI
  if (report.openaiKey && report.openaiKey.status !== 'ok') {
    issues.push(`OpenAI API Key: ${report.openaiKey.message}`);
    console.log('Tip: Set OPENAI_API_KEY environment variable for OpenAI features.');
    console.log('');
  }

  // Check OpenRouter key if using OpenRouter
  if (report.openrouterKey && report.openrouterKey.status !== 'ok') {
    issues.push(`OpenRouter API Key: ${report.openrouterKey.message}`);
    console.log('Tip: Set FOREST_OR_KEY environment variable for OpenRouter embeddings.');
    console.log('');
  }

  if (issues.length === 0) {
    console.log('No issues found! Your Forest installation is healthy.');
    console.log('');
    console.log('Quick tips:');
    console.log('  - Run `forest capture` to add your first note');
    console.log('  - Run `forest stats` to see your knowledge graph');
    console.log('  - Run `forest search <term>` to find notes');
  } else {
    console.log(`Found ${issues.length} issue(s):`);
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
    console.log('');
    console.log('Fix these issues and run `forest admin doctor` again.');
  }
}
