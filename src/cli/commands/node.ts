import { NodeRecord, deleteNode, updateNode, listNodes } from '../../lib/db';
import { EdgeRecord, EdgeStatus, insertOrUpdateEdge } from '../../lib/db';
import { extractTags, tokenize } from '../../lib/text';
import { computeEmbeddingForNode } from '../../lib/embeddings';
import { computeScore, normalizeEdgePair } from '../../lib/scoring';

import { buildNeighborhoodPayload, printNodeOverview } from '../shared/explore';
import {
  DEFAULT_NEIGHBORHOOD_LIMIT,
  edgeIdentifier,
  formatId,
  handleError,
  resolveBodyInput,
  resolveNodeReference,
} from '../shared/utils';
import { rescoreNode } from '../shared/linking';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { synthesizeNodesCore, SynthesisModel, ReasoningEffort, TextVerbosity } from '../../core/synthesize';
import { createNodeCore } from '../../core/nodes';
import { importDocumentCore } from '../../core/import';

import type { HandlerContext } from '@clerc/core';

type ClercModule = typeof import('clerc');
type ClercInstance = ReturnType<ClercModule['Clerc']['create']>;

type NodeReadFlags = {
  meta?: boolean;
  json?: boolean;
  longIds?: boolean;
  tldr?: string;
};

type NodeEditFlags = {
  title?: string;
  body?: string;
  file?: string;
  stdin?: boolean;
  tags?: string;
  autoLink?: boolean;
  tldr?: string;
};

type NodeDeleteFlags = {
  force?: boolean;
  tldr?: string;
};

type NodeLinkFlags = {
  score?: number;
  suggest?: boolean;
  explain?: boolean;
  tldr?: string;
};

type NodeSynthesizeFlags = {
  model?: string;
  reasoning?: string;
  verbosity?: string;
  preview?: boolean;
  autoLink?: boolean;
  maxTokens?: number;
  tldr?: string;
};

type NodeImportFlags = {
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

export function registerNodeCommands(cli: ClercInstance, clerc: ClercModule) {
  const readCommand = clerc.defineCommand(
    {
      name: 'node read',
      description: 'Show the full content of a note',
      parameters: ['<id>'],
      flags: {
        meta: {
          type: Boolean,
          description: 'Show metadata summary without the body text',
        },
        json: {
          type: Boolean,
          description: 'Emit JSON output',
        },
        longIds: {
          type: Boolean,
          description: 'Display full ids in text output',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ parameters, flags }: { parameters: { id?: string }; flags: NodeReadFlags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['node.read'], jsonMode);
        }
        await runNodeRead(parameters.id, flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(readCommand);

  const editCommand = clerc.defineCommand(
    {
      name: 'node edit',
      description: 'Edit an existing note and optionally rescore links',
      parameters: ['<id>'],
      flags: {
        title: {
          type: String,
          description: 'New title',
        },
        body: {
          type: String,
          description: 'New body content',
        },
        file: {
          type: String,
          description: 'Read new body from file',
        },
        stdin: {
          type: Boolean,
          description: 'Read new body from standard input',
        },
        tags: {
          type: String,
          description: 'Comma-separated list of tags to set (overrides auto-detected tags)',
        },
        autoLink: {
          type: Boolean,
          description: 'Rescore/link against existing nodes',
          default: true,
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ parameters, flags }: { parameters: { id?: string }; flags: NodeEditFlags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['node.edit'], jsonMode);
        }
        await runNodeEdit(parameters.id, flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(editCommand);

  const deleteCommand = clerc.defineCommand(
    {
      name: 'node delete',
      description: 'Delete a note and its edges',
      parameters: ['<id>'],
      flags: {
        force: {
          type: Boolean,
          description: 'Do not prompt for confirmation (non-interactive mode)',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ parameters, flags }: { parameters: { id?: string }; flags: NodeDeleteFlags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['node.delete'], jsonMode);
        }
        await runNodeDelete(parameters.id, flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(deleteCommand);

  const linkCommand = clerc.defineCommand(
    {
      name: 'node link',
      description: 'Manually create an edge between two notes',
      parameters: ['<a>', '<b>'],
      flags: {
        score: {
          type: Number,
          description: 'Override score value',
        },
        suggest: {
          type: Boolean,
          description: 'Create as a suggestion instead of accepted',
        },
        explain: {
          type: Boolean,
          description: 'Print scoring components',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ parameters, flags }: { parameters: { a?: string; b?: string }; flags: NodeLinkFlags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['node.link'], jsonMode);
        }
        await runNodeLink(parameters.a, parameters.b, flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(linkCommand);

  const synthesizeCommand = clerc.defineCommand(
    {
      name: 'node synthesize',
      description: 'Use GPT-5 to synthesize a new article from 2+ existing notes',
      parameters: ['<ids...>'],
      flags: {
        model: {
          type: String,
          description: 'Model to use: gpt-5 or gpt-5-mini (default: gpt-5)',
        },
        reasoning: {
          type: String,
          description: 'Reasoning effort: minimal, low, medium, high (default: medium)',
        },
        verbosity: {
          type: String,
          description: 'Output verbosity: low, medium, high (default: medium)',
        },
        preview: {
          type: Boolean,
          description: 'Preview synthesis without saving as a new node',
        },
        autoLink: {
          type: Boolean,
          description: 'Auto-link the new node to source nodes (default: true)',
          default: true,
        },
        maxTokens: {
          type: Number,
          description: 'Maximum output tokens (default: 9001)',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ parameters, flags }: { parameters: { ids?: string[] }; flags: NodeSynthesizeFlags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['node.synthesize'], jsonMode);
        }
        await runNodeSynthesize(parameters.ids, flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(synthesizeCommand);

  const importCommand = clerc.defineCommand(
    {
      name: 'node import',
      description: 'Import a large markdown document by chunking it into multiple linked nodes',
      flags: {
        file: {
          type: String,
          alias: 'f',
          description: 'Read document from file',
        },
        stdin: {
          type: Boolean,
          description: 'Read document from standard input',
        },
        title: {
          type: String,
          alias: 't',
          description: 'Override auto-detected document title',
        },
        tags: {
          type: String,
          description: 'Comma-separated tags for all chunks',
        },
        chunkStrategy: {
          type: String,
          description: 'Chunking strategy: headers, size, hybrid (default: headers)',
        },
        maxTokens: {
          type: Number,
          description: 'Maximum tokens per chunk (default: 2000)',
        },
        overlap: {
          type: Number,
          description: 'Character overlap between chunks for size-based strategy (default: 200)',
        },
        noParent: {
          type: Boolean,
          description: 'Skip creating root/index node',
        },
        noSequential: {
          type: Boolean,
          description: 'Skip linking chunks sequentially',
        },
        noAutoLink: {
          type: Boolean,
          description: 'Skip semantic auto-linking to existing graph',
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
    async ({ flags }: { flags: NodeImportFlags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['node.import'], jsonMode);
        }
        await runNodeImport(flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(importCommand);

  const baseCommand = clerc.defineCommand(
    {
      name: 'node',
      description: 'Manage individual nodes (notes)',
      help: {
        notes: [
          'Subcommands:',
          '  read        Show the full content of a note',
          '  edit        Edit an existing note and optionally rescore links',
          '  delete      Delete a note and its edges',
          '  link        Manually create an edge between two notes',
          '  import      Import a large markdown document by chunking it',
          '  synthesize  Use GPT-5 to synthesize a new article from 2+ notes',
          '',
          'Use `forest node <subcommand> --help` for flag details.',
        ],
        examples: [
          ['$ forest node read abc123', 'Read a note by its short ID'],
          ['$ forest node edit abc123 --title "New title"', 'Edit a note title'],
          ['$ forest node link abc123 def456', 'Create a link between two notes'],
          ['$ forest node synthesize abc123 def456 --preview', 'Preview synthesis without saving'],
        ],
      },
      flags: {
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async (ctx: HandlerContext) => {
      try {
        // Handle TLDR request first
        if ((ctx as any).flags?.tldr !== undefined) {
          const jsonMode = (ctx as any).flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.node, jsonMode);
        }
        await runNodeDashboard();
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(baseCommand);
}

async function runNodeDashboard() {
  const nodes = await listNodes();
  const totalNodes = nodes.length;

  // Sort by creation date (most recent first)
  const recentNodes = nodes
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  console.log('');
  console.log(`Total nodes: ${totalNodes}`);
  console.log('');

  if (recentNodes.length > 0) {
    console.log('Recent nodes:');
    console.log('');
    for (const node of recentNodes) {
      const shortId = formatId(node.id);
      const date = new Date(node.createdAt).toISOString().split('T')[0];
      const tagStr = node.tags.length > 0 ? ` [${node.tags.slice(0, 3).join(', ')}]` : '';
      console.log(`  ${shortId}  ${node.title}${tagStr}`);
      console.log(`         created ${date}`);
    }
    console.log('');
  }

  console.log('Quick actions:');
  console.log('  forest node read <id>        Read a note');
  console.log('  forest node edit <id>        Edit a note');
  console.log('  forest explore <term>        Search all notes');
  console.log('');
}

async function runNodeRead(idRef: string | undefined, flags: NodeReadFlags) {
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

  if (flags.json) {
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
    return;
  }

  const { directEdges } = await buildNeighborhoodPayload(node.id, 1, DEFAULT_NEIGHBORHOOD_LIMIT);
  printNodeOverview(node, directEdges, { longIds: Boolean(flags.longIds) });

  if (!flags.meta) {
    console.log('');
    console.log(node.body);
  }
}

async function runNodeEdit(idRef: string | undefined, flags: NodeEditFlags) {
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

  let accepted = 0;
  let suggested = 0;
  if (autoLink) {
    const updatedNode: NodeRecord = {
      ...node,
      title: nextTitle,
      body: nextBody,
      tags,
      tokenCounts,
      embedding,
    };
    ({ accepted, suggested } = await rescoreNode(updatedNode));
  }

  console.log(`✔ Updated note: ${nextTitle}`);
  console.log(`   id: ${node.id}`);
  if (tags.length > 0) console.log(`   tags: ${tags.join(', ')}`);
  if (autoLink) {
    console.log(`   links after rescore: ${accepted} accepted, ${suggested} pending`);
  } else {
    console.log('   links: rescoring skipped (--no-auto-link)');
  }
}

async function runNodeDelete(idRef: string | undefined, _flags: NodeDeleteFlags) {
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

async function runNodeLink(aRef: string | undefined, bRef: string | undefined, flags: NodeLinkFlags) {
  if (!aRef || !bRef) {
    console.error('✖ Missing required parameters "<a>" and "<b>".');
    process.exitCode = 1;
    return;
  }

  const a = await resolveNodeReference(String(aRef));
  const b = await resolveNodeReference(String(bRef));
  if (!a || !b) {
    console.error('✖ Both endpoints must resolve to existing notes.');
    process.exitCode = 1;
    return;
  }

  const { score: computedScore, components } = computeScore(a, b);
  const scoreOverride =
    typeof flags.score === 'number' && !Number.isNaN(flags.score) ? flags.score : undefined;
  const usedScore = scoreOverride ?? computedScore;

  const status: EdgeStatus = flags.suggest ? 'suggested' : 'accepted';
  const [sourceId, targetId] = normalizeEdgePair(a.id, b.id);

  const edge: EdgeRecord = {
    id: edgeIdentifier(sourceId, targetId),
    sourceId,
    targetId,
    score: usedScore,
    status,
    edgeType: 'manual',
    metadata: { components },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await insertOrUpdateEdge(edge);
  console.log(
    `✔ Linked ${formatId(sourceId)}::${formatId(targetId)}  status=${status}  score=${usedScore.toFixed(3)}`,
  );

  if (flags.explain) {
    console.log('components:');
    for (const [key, value] of Object.entries(components)) {
      if (typeof value === 'number') {
        console.log(`  ${key}: ${value.toFixed(3)}`);
      } else {
        console.log(`  ${key}: ${String(value)}`);
      }
    }
  }
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

function computeAutoLinkIntent(flags: NodeEditFlags) {
  if (typeof flags.autoLink === 'boolean') return flags.autoLink;
  return true;
}

async function runNodeSynthesize(ids: string[] | undefined, flags: NodeSynthesizeFlags) {
  if (!ids || ids.length < 2) {
    console.error('✖ Provide at least 2 node IDs to synthesize.');
    console.error('   Usage: forest node synthesize <id1> <id2> [id3...]');
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
  const model = validateModel(flags.model);
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
    console.log(`   edges: ${nodeResult.linking.edgesCreated} accepted, ${nodeResult.linking.suggestionsCreated} suggested`);
  }
  console.log('');
}

async function runNodeImport(flags: NodeImportFlags) {
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
  console.log(`  Semantic edges: ${result.linking.semanticAccepted} accepted, ${result.linking.semanticSuggested} suggested`);
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

function validateModel(modelFlag: string | undefined): SynthesisModel {
  if (!modelFlag) return 'gpt-5';
  const normalized = modelFlag.toLowerCase();
  if (normalized === 'gpt-5' || normalized === 'gpt-5-mini') {
    return normalized as SynthesisModel;
  }
  console.error(`⚠ Invalid model "${modelFlag}", using default: gpt-5`);
  return 'gpt-5';
}

function validateReasoning(reasoningFlag: string | undefined): ReasoningEffort {
  if (!reasoningFlag) return 'medium';
  const normalized = reasoningFlag.toLowerCase();
  if (['minimal', 'low', 'medium', 'high'].includes(normalized)) {
    return normalized as ReasoningEffort;
  }
  console.error(`⚠ Invalid reasoning effort "${reasoningFlag}", using default: medium`);
  return 'medium';
}

function validateVerbosity(verbosityFlag: string | undefined): TextVerbosity {
  if (!verbosityFlag) return 'medium';
  const normalized = verbosityFlag.toLowerCase();
  if (['low', 'medium', 'high'].includes(normalized)) {
    return normalized as TextVerbosity;
  }
  console.error(`⚠ Invalid verbosity "${verbosityFlag}", using default: medium`);
  return 'medium';
}
