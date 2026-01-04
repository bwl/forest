import { writeArticleCore, WriteModel, WriteReasoningEffort, WriteVerbosity } from '../../core/write';
import { createNodeCore } from '../../core/nodes';
import { loadConfig } from '../../lib/config';
import { formatId, handleError } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';

type ClercModule = typeof import('clerc');

type WriteFlags = {
  model?: string;
  reasoning?: string;
  verbosity?: string;
  preview?: boolean;
  autoLink?: boolean;
  maxTokens?: number;
  tldr?: string;
};

export function createWriteCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'write',
      description: 'Use GPT-5 to write a comprehensive article on any topic',
      parameters: ['<topic>'],
      flags: {
        model: {
          type: String,
          description: 'Model to use: gpt-5, gpt-5-mini, or gpt-4o (default: gpt-5)',
        },
        reasoning: {
          type: String,
          description: 'Reasoning effort: minimal, low, medium, high (default: high)',
        },
        verbosity: {
          type: String,
          description: 'Output verbosity: low, medium, high (default: high)',
        },
        preview: {
          type: Boolean,
          description: 'Preview article without saving as a new node',
        },
        autoLink: {
          type: Boolean,
          description: 'Auto-link the new node to related nodes (default: true)',
          default: true,
        },
        maxTokens: {
          type: Number,
          description: 'Maximum output tokens (default: auto-set by verbosity - low:4096, medium:8192, high:16384)',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ parameters, flags }: { parameters: { topic?: string }; flags: WriteFlags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.write, getVersion());
        }
        await runWrite(parameters.topic, flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runWrite(topic: string | undefined, flags: WriteFlags) {
  if (!topic || topic.trim().length === 0) {
    console.error('✖ Provide a topic to write about.');
    console.error('   Usage: forest write "topic description"');
    console.error('   Example: forest write "the role of mycorrhizal networks in forest ecology"');
    process.exitCode = 1;
    return;
  }

  // Validate model and reasoning options
  const config = loadConfig();
  const defaultModel = config.writeModel || 'gpt-5';

  const model = validateModel(flags.model, defaultModel);
  const reasoning = validateReasoning(flags.reasoning);
  const verbosity = validateVerbosity(flags.verbosity);

  console.log('');
  console.log('Writing configuration:');
  console.log(`  Topic: ${topic}`);
  console.log(`  Model: ${model}`);
  console.log(`  Reasoning: ${reasoning}`);
  console.log(`  Verbosity: ${verbosity}`);
  console.log('');
  console.log('Calling OpenAI API to generate article...');
  console.log('(This may take 30-60 seconds for high reasoning)');
  console.log('');

  // Call write core
  const result = await writeArticleCore(topic, {
    model,
    reasoning,
    verbosity,
    maxTokens: flags.maxTokens,
  });

  // Display results
  console.log('='.repeat(80));
  console.log(`ARTICLE GENERATED`);
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
  console.log(`  Article length: ${result.body.length} characters, ~${Math.round(result.body.split(/\s+/).length)} words`);
  console.log('');

  // If preview mode, stop here
  if (flags.preview) {
    console.log('Preview mode - article not saved.');
    console.log('');
    console.log('Full article:');
    console.log('='.repeat(80));
    console.log(result.body);
    console.log('='.repeat(80));
    return;
  }

  // Save as new node
  console.log('Saving article as new node...');
  const autoLink = typeof flags.autoLink === 'boolean' ? flags.autoLink : true;

  const nodeResult = await createNodeCore({
    title: result.title,
    body: result.body,
    tags: result.suggestedTags,
    autoLink,
  });

  console.log('');
  console.log(`✔ Created article node: ${nodeResult.node.title}`);
  console.log(`   id: ${formatId(nodeResult.node.id)}`);
  console.log(`   tags: ${nodeResult.node.tags.join(', ')}`);
  if (autoLink) {
    console.log(`   edges: ${nodeResult.linking.edgesCreated} accepted`);
  }
  console.log('');
}

function validateModel(modelFlag: string | undefined, defaultModel: WriteModel): WriteModel {
  if (!modelFlag) return defaultModel;
  const normalized = modelFlag.toLowerCase();
  if (normalized === 'gpt-5' || normalized === 'gpt-5-mini' || normalized === 'gpt-4o') {
    return normalized as WriteModel;
  }
  console.error(`⚠ Invalid model "${modelFlag}", using default: ${defaultModel}`);
  return defaultModel;
}

function validateReasoning(reasoningFlag: string | undefined): WriteReasoningEffort {
  if (!reasoningFlag) return 'high'; // Default to high for quality articles
  const normalized = reasoningFlag.toLowerCase();
  if (['minimal', 'low', 'medium', 'high'].includes(normalized)) {
    return normalized as WriteReasoningEffort;
  }
  console.error(`⚠ Invalid reasoning effort "${reasoningFlag}", using default: high`);
  return 'high';
}

function validateVerbosity(verbosityFlag: string | undefined): WriteVerbosity {
  if (!verbosityFlag) return 'high'; // Default to high for comprehensive articles
  const normalized = verbosityFlag.toLowerCase();
  if (['low', 'medium', 'high'].includes(normalized)) {
    return normalized as WriteVerbosity;
  }
  console.error(`⚠ Invalid verbosity "${verbosityFlag}", using default: high`);
  return 'high';
}
