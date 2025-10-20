import { createCaptureCommand } from './commands/capture';
import { createAdminRecomputeEmbeddingsCommand } from './commands/admin-recompute-embeddings';
import { createAdminRetagAllCommand } from './commands/admin-retag-all';
import { createExploreCommand } from './commands/explore';
import { createSearchCommand } from './commands/search';
import { registerExportCommands } from './commands/export';
import { registerEdgesCommands } from './commands/edges';
import { registerNodeCommands } from './commands/node';
import { registerTagsCommands } from './commands/tags';
import { createStatsCommand } from './commands/stats';
import { createHealthCommand } from './commands/health';
import { createServeCommand } from './commands/serve';
import { createConfigCommand } from './commands/config';
import { createVersionCommand, displayVersion, getVersion } from './commands/version';

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
  registerExportCommands(cli, clerc);

  return cli;
}

export async function runForestCli(argv: readonly string[]): Promise<void> {
  const cli = await createForestCli();
  cli.parse({ argv: [...argv], run: true });
}
