import { createCaptureCommand } from './commands/capture.js';
import { createWriteCommand } from './commands/write.js';
import { createAdminRecomputeEmbeddingsCommand } from './commands/admin-recompute-embeddings.js';
import { createAdminRetagAllCommand } from './commands/admin-retag-all.js';
import { createExploreCommand } from './commands/explore.js';
import { createSearchCommand } from './commands/search.js';
import { registerExportCommands } from './commands/export.js';
import { registerEdgesCommands } from './commands/edges.js';
import { registerNodeCommands } from './commands/node.js';
import { registerTagsCommands } from './commands/tags.js';
import { registerDocumentsCommands } from './commands/documents.js';
import { createStatsCommand } from './commands/stats.js';
import { createHealthCommand } from './commands/health.js';
import { createServeCommand } from './commands/serve.js';
import { createConfigCommand } from './commands/config.js';
import { createVersionCommand, displayVersion, getVersion } from './commands/version.js';

type ClercModule = typeof import('clerc');

async function loadClerc(): Promise<ClercModule> {
  return Function('return import("clerc")')();
}

export async function createForestCli() {
  const clerc = await loadClerc();
  const {
    Clerc,
    completionsPlugin,
    friendlyErrorPlugin,
    helpPlugin,
    notFoundPlugin,
    strictFlagsPlugin,
  } = clerc;

  const cli = Clerc.create()
    .name('forest')
    .scriptName('forest')
    .description('Graph-native knowledge base CLI')
    .version(getVersion())
    .use(helpPlugin())
    .use(friendlyErrorPlugin())
    .use(strictFlagsPlugin())
    .use(notFoundPlugin())
    .use(completionsPlugin());

  cli.command(createCaptureCommand(clerc));
  cli.command(createWriteCommand(clerc));
  cli.command(createExploreCommand(clerc));
  cli.command(createSearchCommand(clerc));
  cli.command(createStatsCommand(clerc));
  cli.command(createHealthCommand(clerc));
  cli.command(createServeCommand(clerc));
  cli.command(createConfigCommand(clerc));
  cli.command(createAdminRecomputeEmbeddingsCommand(clerc));
  cli.command(createAdminRetagAllCommand(clerc));
  cli.command(createVersionCommand(clerc));
  registerNodeCommands(cli, clerc);
  registerEdgesCommands(cli, clerc);
  registerTagsCommands(cli, clerc);
  registerDocumentsCommands(cli, clerc);
  registerExportCommands(cli, clerc);

  return cli;
}

export async function runForestCli(argv: readonly string[]): Promise<void> {
  const cli = await createForestCli();
  cli.parse({ argv: [...argv], run: true });
}
