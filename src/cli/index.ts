import { createCaptureCommand } from './commands/capture';
import { createWriteCommand } from './commands/write';
import { registerAdminCommands } from './commands/admin';
import { createExploreCommand } from './commands/explore';
import { createLinkCommand } from './commands/link';
import { createPathCommand } from './commands/path';
import { createSearchCommand } from './commands/search';
import { registerExportCommands } from './commands/export';
import { registerEdgesCommands } from './commands/edges';
import { registerTagsCommands } from './commands/tags';
import { registerDocumentsCommands } from './commands/documents';
import { registerAliases } from './aliases';
import { createStatsCommand } from './commands/stats';
import { createSuggestCommand } from './commands/suggest';
import { createContextCommand } from './commands/context';
import { createServeCommand } from './commands/serve';
import { createConfigCommand } from './commands/config';
import { createVersionCommand, displayVersion, getVersion } from './commands/version';
import { createLintCommand } from './commands/lint';
import { createGroupedHelpRenderer } from './help';

type ClercModule = typeof import('clerc');

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
    .use(helpPlugin({ renderers: createGroupedHelpRenderer() }))
    .use(friendlyErrorPlugin())
    .use(strictFlagsPlugin())
    .use(notFoundPlugin())
    .use(completionsPlugin());

  cli.command(createCaptureCommand(clerc));
  cli.command(createWriteCommand(clerc));
  cli.command(createExploreCommand(clerc));
  cli.command(createLinkCommand(clerc));
  cli.command(createPathCommand(clerc));
  cli.command(createSearchCommand(clerc));
  cli.command(createStatsCommand(clerc));
  cli.command(createSuggestCommand(clerc));
  cli.command(createContextCommand(clerc));
  cli.command(createServeCommand(clerc));
  cli.command(createConfigCommand(clerc));
  cli.command(createVersionCommand(clerc));
  cli.command(createLintCommand(clerc));
  registerEdgesCommands(cli, clerc);
  registerTagsCommands(cli, clerc);
  registerDocumentsCommands(cli, clerc);
  registerExportCommands(cli, clerc);
  registerAdminCommands(cli, clerc);
  registerAliases(cli, clerc);

  return cli;
}

export async function runForestCli(argv: readonly string[]): Promise<void> {
  const cli = await createForestCli();
  cli.parse({ argv: [...argv], run: true });
}

async function loadClerc(): Promise<ClercModule> {
  // Use runtime dynamic import so CJS output can load ESM-only packages.
  const importAtRuntime = new Function(
    'specifier',
    'return import(specifier);',
  ) as (specifier: string) => Promise<unknown>;

  return (await importAtRuntime('clerc')) as ClercModule;
}
