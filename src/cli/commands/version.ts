import * as fs from 'fs';
import * as path from 'path';

import chalk from 'chalk';

import { handleError } from '../shared/utils';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import {
  ACTIVE_SCHEME,
  hslToRgb,
  type ColorRole,
} from '../formatters/colors';

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

const FOREST_SCENE_LINES = [
  '',
  '    .                  .-.    .  _   *     _   .',
  '           *          /   \\     ((       _/ \\       *    .',
  '         _    .   .--\'\\/\\_ \\     `      /    \\  *    ___',
  '     *  / \\_    _/ ^      \\/\\\'__        /\\/\\  /\\  __/   \\ *',
  '       /    \\  /    .\'   _/  /  \\  *\' /    \\/  \\/ .`\'\\_/\\   .',
  '  .   /\\/\\  /\\/ :\' __  ^/  ^/    `--./.\'  ^  `-.\\ _    _:\\ _',
  '     /    \\/  \\  _/  \\-\' __/.\' ^ _   \\_   .\'\\   _/ \\ .  __/ \\',
  '   /\\  .-   `. \\/   ▗▄▄▄▖ ▗▄▖ ▗▄▄▖ ▗▄▄▄▖ ▗▄▄▖▗▄▄▄▖  `._/  ^  \\',
  '  /  `-.__ ^   / .-\'▐▌   ▐▌ ▐▌▐▌ ▐▌▐▌   ▐▌     █   `-. `. -  `.',
  '@/        `.  / /   ▐▛▀▀▘▐▌ ▐▌▐▛▀▚▖▐▛▀▀▘ ▝▀▚▖  █      \\  \\  .-  \\%',
  '@&8jgs@@%% @)&@&(88&▐▌   ▝▚▄▞▘▐▌ ▐▌▐▙▄▄▖▗▄▄▞▘  █  %@%8)(8@%8 8%@)%',
  '@88:::&(&8&&8:::::%&`.~-_~~-~~_~-~_~-~~=.\'@(&%::::%@8&8)::&#@8::::',
  '`::::::8%@@%:::::@%&8:`.=~~-.~~-.~~=..~\'8::::::::&@8:::::&8:::::\'',
  ' `::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::.\'',
];

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
  console.log(renderForestArt());
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

type LayerStyle = {
  start: number;
  end: number;
  role: ColorRole;
  hueJitter?: number;
  saturationJitter?: number;
  lightnessJitter?: number;
};

const SCENE_LAYERS: LayerStyle[] = [
  { start: 0, end: 0, role: 'neutral' },
  { start: 1, end: 3, role: 'neutral', hueJitter: 12, saturationJitter: 10, lightnessJitter: 14 },
  { start: 4, end: 7, role: 'muted', hueJitter: 8, saturationJitter: 8, lightnessJitter: 12 },
  { start: 8, end: 8, role: 'main', hueJitter: 6, saturationJitter: 12, lightnessJitter: 10 },
  { start: 9, end: 11, role: 'accent', hueJitter: 10, saturationJitter: 14, lightnessJitter: 12 },
  { start: 12, end: 13, role: 'info', hueJitter: 14, saturationJitter: 16, lightnessJitter: 14 },
];

const SKY_CHARS = new Set(['.', '*', '`', '^']);
const MOUNTAIN_CHARS = new Set(['/', '\\', '_', '-', '\'', '|']);
const TREE_CHARS = new Set(['@', '&', '%', '8', '(', ')', 'j', 'g', 's']);
const WATER_CHARS = new Set(['~', '=', '-', '.', ':']);
const NEUTRAL_CHARS = new Set([':', '`', '\'']);
const LOGO_CHARS = new Set([
  '▗',
  '▖',
  '▘',
  '▝',
  '▚',
  '▞',
  '▟',
  '▙',
  '▛',
  '▜',
  '▐',
  '▌',
  '█',
  '▄',
  '▀',
]);

function renderForestArt(): string {
  return FOREST_SCENE_LINES.map((line, idx) => colorSceneLine(line, idx)).join('\n');
}

function colorSceneLine(line: string, lineIndex: number): string {
  if (!line) return line;
  const layer = getLayerForLine(lineIndex);

  return line
    .split('')
    .map((char, charIndex) => {
      if (char === ' ') return char;

      if (lineIndex >= 8 && lineIndex <= 11 && LOGO_CHARS.has(char)) {
        return chalk.hex(ACTIVE_SCHEME.colors.emphasis.hex)(char);
      }

      const role = resolveCharRole(layer.role, char, lineIndex);
      const [baseHue, baseSaturation, baseLightness] = ACTIVE_SCHEME.hsl[role];

      const isLogoChar = LOGO_CHARS.has(char);
      const jitterScale = lineIndex === 8 || isLogoChar ? 0 : 1;
      const hue = normalizeHue(
        baseHue + jitter(charIndex, lineIndex, (layer.hueJitter ?? 0) * jitterScale, 0.35),
      );
      const saturation = clamp(
        baseSaturation +
          jitter(charIndex, lineIndex, (layer.saturationJitter ?? 0) * jitterScale, 0.6),
        5,
        100,
      );
      const lightness = clamp(
        baseLightness +
          jitter(charIndex, lineIndex, (layer.lightnessJitter ?? 0) * jitterScale, 0.8),
        5,
        95,
      );

      const [r, g, b] = hslToRgb(hue, saturation, lightness);
      return chalk.rgb(r, g, b)(char);
    })
    .join('');
}

function getLayerForLine(lineIndex: number): LayerStyle {
  for (const layer of SCENE_LAYERS) {
    if (lineIndex >= layer.start && lineIndex <= layer.end) {
      return layer;
    }
  }
  return { start: lineIndex, end: lineIndex, role: 'neutral' };
}

function resolveCharRole(baseRole: ColorRole, char: string, lineIndex: number): ColorRole {
  if (lineIndex <= 3 && SKY_CHARS.has(char)) return 'highlight';

  if (lineIndex >= 4 && lineIndex <= 7 && MOUNTAIN_CHARS.has(char)) {
    return 'muted';
  }

  if (lineIndex === 8 && LOGO_CHARS.has(char)) {
    return 'emphasis';
  }

  if (lineIndex >= 9 && lineIndex <= 11) {
    if (LOGO_CHARS.has(char)) return 'emphasis';
    if (TREE_CHARS.has(char) || char === '█') return 'accent';
  }

  if (lineIndex >= 12) {
    if (WATER_CHARS.has(char)) return 'info';
    if (NEUTRAL_CHARS.has(char)) return 'neutral';
    if (TREE_CHARS.has(char) || char === '@') return 'accent';
  }

  if (SKY_CHARS.has(char)) return 'highlight';
  if (MOUNTAIN_CHARS.has(char)) return 'muted';
  if (TREE_CHARS.has(char)) return 'accent';
  if (WATER_CHARS.has(char)) return 'info';
  if (LOGO_CHARS.has(char)) return 'main';

  return baseRole;
}

function jitter(charIndex: number, lineIndex: number, amplitude: number, frequency: number): number {
  if (amplitude === 0) return 0;
  return Math.sin((charIndex + 1) * frequency + lineIndex * 0.45) * amplitude;
}

function normalizeHue(hue: number): number {
  const normalized = hue % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
