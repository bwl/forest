import { listNodes, updateNode } from '../../lib/db';
import { computeEmbeddingForNode, embeddingsEnabled } from '../../lib/embeddings';
import { classifyScore, computeScore, normalizeEdgePair, getEdgeThreshold } from '../../lib/scoring';
import { extractTagsAsync } from '../../lib/text';
import { loadConfig } from '../../lib/config';
import { getHealthReport, isHealthy, HealthCheck } from '../../core/health';
import {
  EdgeRecord,
  deleteEdgeBetween,
  insertOrUpdateEdge,
} from '../../lib/db';

import { edgeIdentifier, handleError } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';

type ClercModule = typeof import('clerc');
type ClercInstance = ReturnType<ClercModule['Clerc']['create']>;

// === Flag Types ===

type AdminEmbeddingsFlags = {
  rescore?: boolean;
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

type AdminBaseFlags = {
  tldr?: string;
};

// === Command Registration ===

export function registerAdminCommands(cli: ClercInstance, clerc: ClercModule) {
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
          emitTldrAndExit(COMMAND_TLDR['admin.embeddings'], getVersion());
        }
        await runAdminEmbeddings(flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(embeddingsCommand);

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
          emitTldrAndExit(COMMAND_TLDR['admin.tags'], getVersion());
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
          emitTldrAndExit(COMMAND_TLDR['admin.health'], getVersion());
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
          emitTldrAndExit(COMMAND_TLDR['admin.doctor'], getVersion());
        }
        await runAdminDoctor();
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(doctorCommand);

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
          '  embeddings  Recompute embeddings for all nodes',
          '  tags        Regenerate tags using current method',
          '  health      Check system health and configuration',
          '  doctor      Guided setup and troubleshooting',
          '',
          'Use `forest admin <subcommand> --help` for flag details.',
        ],
        examples: [
          ['$ forest admin health', 'Check system health'],
          ['$ forest admin embeddings --rescore', 'Recompute embeddings and rescore edges'],
          ['$ forest admin tags --dry-run', 'Preview tag regeneration'],
        ],
      },
    },
    async ({ flags }: { flags: AdminBaseFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          emitTldrAndExit(COMMAND_TLDR.admin, getVersion());
        }
        // Show help summary when invoked without subcommand
        console.log('forest admin - System maintenance and diagnostics');
        console.log('');
        console.log('Subcommands:');
        console.log('  embeddings  Recompute embeddings for all nodes');
        console.log('  tags        Regenerate tags using current method');
        console.log('  health      Check system health and configuration');
        console.log('  doctor      Guided setup and troubleshooting');
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

  let accepted = 0;
  const refreshed = await listNodes();
  for (let i = 0; i < refreshed.length; i += 1) {
    const a = refreshed[i];
    for (let j = i + 1; j < refreshed.length; j += 1) {
      const b = refreshed[j];
      const { score, components } = computeScore(a, b);
      const status = classifyScore(score);
      const [sourceId, targetId] = normalizeEdgePair(a.id, b.id);

      if (status === 'discard') {
        await deleteEdgeBetween(sourceId, targetId);
        continue;
      }

      const edge: EdgeRecord = {
        id: edgeIdentifier(sourceId, targetId),
        sourceId,
        targetId,
        score,
        status,
        edgeType: 'semantic',
        metadata: { components },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await insertOrUpdateEdge(edge);
      accepted += 1;
    }
  }
  console.log(`Rescored graph: ${accepted} edges created`);
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
