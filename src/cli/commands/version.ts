import { handleError } from '../shared/utils';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import * as path from 'path';
import * as fs from 'fs';

type ClercModule = typeof import('clerc');

const TREE_ART = `
    #o#
  ####o#
 #o# \\#|_#,#
###\\ |/   #o#
 # {}{      #
    }{{
   ,'  \`
`;

const FOREST_ART = `

    .                  .-.    .  _   *     _   .
           *          /   \\     ((       _/ \\       *    .
         _    .   .--'\\/\\_ \\     \`      /    \\  *    ___
     *  / \\_    _/ ^      \\/\\'__        /\\/\\  /\\  __/   \\ *
       /    \\  /    .'   _/  /  \\  *' /    \\/  \\/ .\`'\\_/\\   .
  .   /\\/\\  /\\/ :' __  ^/  ^/    \`--./.'  ^  \`-.\\ _    _:\\ _
     /    \\/  \\  _/  \\-' __/.' ^ _   \\_   .'\\   _/ \\ .  __/ \\
   /\\  .-   \`. \\/   ▗▄▄▄▖ ▗▄▖ ▗▄▄▖ ▗▄▄▄▖ ▗▄▄▖▗▄▄▄▖  \`._/  ^  \\
  /  \`-.__ ^   / .-'▐▌   ▐▌ ▐▌▐▌ ▐▌▐▌   ▐▌     █   \`-. \`. -  \`.
@/        \`.  / /   ▐▛▀▀▘▐▌ ▐▌▐▛▀▚▖▐▛▀▀▘ ▝▀▚▖  █      \\  \\  .-  \\%
@&8jgs@@%% @)&@&(88&▐▌   ▝▚▄▞▘▐▌ ▐▌▐▙▄▄▖▗▄▄▞▘  █  %@%8)(8@%8 8%@)%
@88:::&(&8&&8:::::%&\`.~-_~~-~~_~-~_~-~~=.'@(&%::::%@8&8)::&#@8::::
\`::::::8%@@%:::::@%&8:\`.=~~-.~~-.~~=..~'8::::::::&@8:::::&8:::::'
 \`::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::.'

`;

// Read version dynamically from package.json
function readVersion(): string {
  try {
    const packageJsonPath = path.join(__dirname, '../../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version || '0.0.0';
  } catch (error) {
    // Fallback version if package.json can't be read
    return '0.0.0';
  }
}

export function createVersionCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'version',
      description: 'Show version information',
      flags: {
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }: { flags?: { tldr?: string } }) => {
      try {
        // Handle TLDR request first
        if (flags?.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.version, getVersion());
        }
        displayVersion();
      } catch (error) {
        handleError(error);
      }
    },
  );
}

export function displayVersion() {
  console.log(FOREST_ART);
  console.log(`  Version: ${getVersion()}`);
  console.log('  A graph-native knowledge base CLI');
  console.log('');
}

export function getVersion(): string {
  return readVersion();
}

export function displayBriefInfo() {
  const version = getVersion();
  console.log('');
  console.log('    #o#');
  console.log('  ####o#');
  console.log(' #o# \\#|_#,#');
  console.log('###\\ |/   #o#        forest v' + version);
  console.log(' # {}{      #        A graph-native knowledge base CLI');
  console.log('    }{{');
  console.log('   ,\'  `');
  console.log('');
  console.log('  Run `forest help` for full command list');
  console.log('');
  console.log('  Quick start:');
  console.log('    forest capture --stdin    # Capture ideas from stdin');
  console.log('    forest explore <term>     # Search and explore connections');
  console.log('    forest edges propose      # Review suggested links');
  console.log('');
}
