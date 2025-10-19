import { handleError } from '../shared/utils';

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

const VERSION = '0.1.0';

export function createVersionCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'version',
      description: 'Show version information',
    },
    async () => {
      try {
        displayVersion();
      } catch (error) {
        handleError(error);
      }
    },
  );
}

export function displayVersion() {
  console.log(FOREST_ART);
  console.log(`  Version: ${VERSION}`);
  console.log('  A graph-native knowledge base CLI');
  console.log('');
}

export function getVersion(): string {
  return VERSION;
}

export function displayBriefInfo() {
  console.log('');
  console.log('    #o#');
  console.log('  ####o#');
  console.log(' #o# \\#|_#,#');
  console.log('###\\ |/   #o#        forest v' + VERSION);
  console.log(' # {}{      #        A graph-native knowledge base CLI');
  console.log('    }{{');
  console.log('   ,\'  `');
  console.log('');
  console.log('  Run `forest help` for full command list');
  console.log('');
  console.log('  Quick start:');
  console.log('    forest capture --stdin    # Capture ideas from stdin');
  console.log('    forest explore <term>     # Search and explore connections');
  console.log('    forest insights list      # Review suggested links');
  console.log('');
}
