/**
 * Custom help renderer that groups commands by category.
 * Uses clerc's renderSections hook to transform the flat command list.
 */

type BlockSection = {
  type?: 'block';
  title: string;
  body: string[];
};

type InlineSection = {
  type: 'inline';
  items: { title: string; body: string }[];
};

type Section = BlockSection | InlineSection;

interface Renderers {
  renderSections?: (sections: Section[]) => Section[];
  renderFlagName?: (name: string) => string;
  renderType?: (type: any, hasDefault: boolean) => string;
  renderDefault?: (default_: any) => string;
}

// Command-to-category mapping (order preserved)
const COMMAND_GROUPS: [string, string[]][] = [
  ['CAPTURE - Create content', ['capture', 'write']],
  ['EXPLORE - Find and navigate', ['search', 'explore']],
  ['NOTES - Read, edit, manage', ['read', 'edit', 'update', 'delete', 'import', 'synthesize']],
  ['GRAPH - Connections and tags', ['link', 'tag', 'edges']],
  ['MANAGE - Groups', ['tags', 'documents']],
  ['ADMIN - System administration', ['admin', 'config', 'serve']],
  ['INFO - Reports and exports', ['stats', 'export', 'version']],
];

// Subcommands hidden from main help (shown via `forest <family> --help`)
const HIDE_IN_MAIN_HELP = new Set([
  'edges explain',
  'edges threshold',
  'tags add',
  'tags remove',
  'tags list',
  'tags rename',
  'tags stats',
  'documents list',
  'documents show',
  'documents stats',
  'export graphviz',
  'export json',
  'admin embeddings',
  'admin tags',
  'admin health',
  'admin doctor',
]);

// Strip ANSI escape codes from a string
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

// Parse a command line from clerc's help output
// Format: "\u001b[36mforest capture\u001b[39m    \u001b[33m-\u001b[39m  Capture a new idea"
function parseCommandLine(line: string): { name: string; description: string } | null {
  const clean = stripAnsi(line);

  // Match: "forest <command>    -  <description>"
  const match = clean.match(/^(forest(?:\s+\S+)*)\s+-\s+(.+)$/);
  if (!match) return null;

  const fullName = match[1]!.trim();
  const description = match[2]!.trim();

  // Extract command name (remove "forest " prefix)
  const name = fullName.replace(/^forest\s*/, '').trim();

  return { name, description };
}

export function createGroupedHelpRenderer(): Renderers {
  return {
    renderSections: (sections: Section[]): Section[] => {
      // Debug: log sections (uncomment for debugging)
      // console.error('DEBUG sections:', JSON.stringify(sections, null, 2));

      // Find the Commands section
      const commandsSectionIndex = sections.findIndex(
        (s) => s.type !== 'inline' && (s as BlockSection).title?.includes('Commands')
      );

      if (commandsSectionIndex === -1) {
        return sections;
      }

      const commandsSection = sections[commandsSectionIndex] as BlockSection;

      // Parse all command lines
      const commands = new Map<string, string>();
      for (const line of commandsSection.body) {
        const parsed = parseCommandLine(line);
        if (parsed && parsed.name) {
          commands.set(parsed.name, parsed.description);
        }
      }

      // Filter out hidden subcommands
      for (const hidden of HIDE_IN_MAIN_HELP) {
        commands.delete(hidden);
      }

      // Also hide the root "forest" entry if it exists
      commands.delete('');

      // Build grouped sections
      const groupedSections: Section[] = [];

      for (const [groupTitle, groupCommands] of COMMAND_GROUPS) {
        const lines: string[] = [];

        for (const cmdName of groupCommands) {
          const description = commands.get(cmdName);
          if (description) {
            // Format with consistent padding for alignment
            const paddedName = cmdName.padEnd(12);
            lines.push(`  ${paddedName}${description}`);
          }
        }

        if (lines.length > 0) {
          groupedSections.push({
            title: groupTitle,
            body: lines,
          });
        }
      }

      // Add footer note
      groupedSections.push({
        title: '',
        body: ['Use `forest <command> --help` for subcommand details.'],
      });

      // Replace the original Commands section with grouped sections
      const result = [...sections];
      result.splice(commandsSectionIndex, 1, ...groupedSections);

      return result;
    },
  };
}
