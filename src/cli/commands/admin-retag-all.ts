import { listNodes, updateNode } from '../../lib/db';
import { extractTagsAsync } from '../../lib/text';
import { loadConfig } from '../../lib/config';

type ClercModule = typeof import('clerc');

export function createAdminRetagAllCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'admin:retag-all',
      description: 'Regenerate tags for all nodes using current tagging method',
      flags: {
        'dry-run': {
          type: Boolean,
          description: 'Preview changes without saving',
        },
        limit: {
          type: Number,
          description: 'Only retag N nodes (for testing)',
          default: undefined,
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
      },
    },
    async (flags: any) => {
      const dryRun = flags['dry-run'] || flags.flags?.['dry-run'] || false;
      const limit = flags.limit || flags.flags?.limit;
      const skip = flags.skip || flags.flags?.skip || 0;
      const skipUnchanged = flags['skip-unchanged'] || flags.flags?.['skip-unchanged'] || false;

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

      console.log('\n✔ Retagging complete');
    },
  );
}
