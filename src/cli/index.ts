import { createCaptureCommand } from './commands/capture';
import { createDeleteCommand } from './commands/delete';
import { createEditCommand } from './commands/edit';
import { createDoctorCommand } from './commands/doctor';
import { createAdminRecomputeEmbeddingsCommand } from './commands/admin-recompute-embeddings';
import { createExploreCommand } from './commands/explore';
import { createLinkCommand } from './commands/link';
import { registerExportCommands } from './commands/export';
import { registerInsightsCommands } from './commands/insights';
import { registerTagsCommands } from './commands/tags';
import { createReadCommand } from './commands/read';
import { createStatsCommand } from './commands/stats';

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
    versionPlugin,
  } = clerc;

  const cli = Clerc.create()
    .name('forest')
    .scriptName('forest')
    .description('Graph-native knowledge base CLI')
    .version('0.1.0')
    .use(helpPlugin())
    .use(versionPlugin())
    .use(friendlyErrorPlugin())
    .use(strictFlagsPlugin())
    .use(notFoundPlugin())
    .use(completionsPlugin());

  cli.command(createCaptureCommand(clerc));
  cli.command(createExploreCommand(clerc));
  cli.command(createEditCommand(clerc));
  cli.command(createDeleteCommand(clerc));
  cli.command(createLinkCommand(clerc));
  cli.command(createAdminRecomputeEmbeddingsCommand(clerc));
  cli.command(createDoctorCommand(clerc));
  cli.command(createStatsCommand(clerc));
  cli.command(createReadCommand(clerc));
  registerInsightsCommands(cli, clerc);
  registerTagsCommands(cli, clerc);
  registerExportCommands(cli, clerc);

  return cli;
}

export async function runForestCli(argv: readonly string[]): Promise<void> {
  const cli = await createForestCli();
  cli.parse({ argv: [...argv], run: true });
}
