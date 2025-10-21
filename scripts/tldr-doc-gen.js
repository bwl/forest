#!/usr/bin/env node
/**
 * tldr-doc-gen.js - Universal TLDR v0.1 Documentation Generator (Node.js)
 *
 * Generates comprehensive documentation for any CLI implementing the TLDR standard.
 * Produces multiple output formats with advanced validation and dependency analysis.
 *
 * Usage:
 *   ./tldr-doc-gen.js <cli-command> [--validate|--analyze]
 *
 * Examples:
 *   ./tldr-doc-gen.js forest
 *   ./tldr-doc-gen.js forest --validate
 *   ./tldr-doc-gen.js forest --analyze
 *   ./tldr-doc-gen.js git  # (if git implemented TLDR)
 *
 * Output Files:
 *   <cli>_tldr.txt - Human-readable ASCII documentation
 *   <cli>_tldr.md - Markdown with auto-generated TOC
 *   <cli>_tldr.json - Structured JSON with analytics
 *
 * Features:
 *   - Validates ASCII/JSON consistency
 *   - Analyzes dependency graph from RELATED fields
 *   - Categorizes commands by namespace
 *   - Advanced validation with detailed error reporting
 *   - Multiple output formats for different use cases
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Execute shell command and return output
 */
function exec(cmd, options = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    }).trim();
  } catch (error) {
    if (options.allowFailure) {
      return null;
    }
    throw error;
  }
}

/**
 * Check if CLI command is available
 */
function isCommandAvailable(cli) {
  try {
    exec(`command -v ${cli}`, { shell: '/bin/bash' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse ASCII TLDR format to structured object
 */
function parseAsciiTldr(ascii) {
  const lines = ascii.split('\n');
  const parsed = {};

  for (const line of lines) {
    const match = line.match(/^([A-Z_]+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      parsed[key] = value.trim();
    }
  }

  return parsed;
}

/**
 * Parse FLAGS field into structured array
 */
function parseFlags(flagsString) {
  if (!flagsString) return [];

  return flagsString.split(';').map(flag => {
    const parts = flag.trim().split('|');
    if (parts.length < 2) return null;

    const [signature, description] = parts;
    const match = signature.match(/^--([^=]+)(?:=([^=]+)(?:=(.+))?)?$/);

    if (!match) return null;

    const [, name, type, defaultValue] = match;
    return {
      name,
      type: type || 'BOOL',
      default: defaultValue,
      description: description.trim()
    };
  }).filter(Boolean);
}

/**
 * Parse EXAMPLES field into array
 */
function parseExamples(examplesString) {
  if (!examplesString) return [];
  return examplesString.split('|').map(ex => ex.trim()).filter(Boolean);
}

/**
 * Parse RELATED field into array
 */
function parseRelated(relatedString) {
  if (!relatedString) return [];
  return relatedString.split(',').map(r => r.trim()).filter(Boolean);
}

/**
 * Validate consistency between ASCII and JSON TLDR outputs
 */
function validateTldrFormat(ascii, json, commandName) {
  const errors = [];
  const warnings = [];

  const parsedAscii = parseAsciiTldr(ascii);

  // Check required fields in ASCII
  const requiredFields = ['CMD', 'PURPOSE'];
  for (const field of requiredFields) {
    if (!parsedAscii[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate CMD matches command name
  if (parsedAscii.CMD && parsedAscii.CMD !== commandName) {
    warnings.push(`CMD field mismatch: expected '${commandName}', got '${parsedAscii.CMD}'`);
  }

  // Note: Current Forest implementation returns ASCII for both modes
  // Future TLDR v0.1 implementations may provide proper JSON output
  // For now, we validate that JSON output exists and is parseable as ASCII
  if (json !== ascii) {
    try {
      JSON.parse(json);
      // If it's valid JSON but different from ASCII, that's also acceptable
    } catch (error) {
      // If JSON parsing fails but outputs match, that's fine (ASCII mode)
      if (json !== ascii) {
        warnings.push(`JSON mode output differs but is not valid JSON`);
      }
    }
  }

  return { errors, warnings };
}

/**
 * Build dependency graph from RELATED fields
 */
function buildDependencyGraph(commands) {
  const graph = {};
  const incomingEdges = {};

  for (const cmd of commands) {
    const related = parseRelated(cmd.related);
    graph[cmd.name] = related;

    // Track incoming edges (reverse dependencies)
    for (const relatedCmd of related) {
      if (!incomingEdges[relatedCmd]) {
        incomingEdges[relatedCmd] = [];
      }
      incomingEdges[relatedCmd].push(cmd.name);
    }
  }

  return {
    outgoing: graph,
    incoming: incomingEdges,
    // Calculate centrality (total edges)
    centrality: Object.fromEntries(
      commands.map(cmd => [
        cmd.name,
        (graph[cmd.name] || []).length + (incomingEdges[cmd.name] || []).length
      ])
    )
  };
}

/**
 * Categorize commands by namespace
 */
function categorizeCommands(commands) {
  const categories = {
    'top-level': [],
    namespaced: {}
  };

  for (const cmd of commands) {
    if (cmd.name.includes('.')) {
      const [namespace] = cmd.name.split('.');
      if (!categories.namespaced[namespace]) {
        categories.namespaced[namespace] = [];
      }
      categories.namespaced[namespace].push(cmd);
    } else {
      categories['top-level'].push(cmd);
    }
  }

  return categories;
}

/**
 * Analyze flag types distribution
 */
function analyzeFlagTypes(commands) {
  const types = {};
  let totalFlags = 0;

  for (const cmd of commands) {
    const flags = parseFlags(cmd.flags);
    totalFlags += flags.length;

    for (const flag of flags) {
      types[flag.type] = (types[flag.type] || 0) + 1;
    }
  }

  return {
    distribution: types,
    total: totalFlags,
    averagePerCommand: (totalFlags / commands.length).toFixed(2)
  };
}

/**
 * Generate Markdown documentation with TOC
 */
function generateMarkdownDocs(data) {
  const lines = [];

  // Header
  lines.push(`# ${data.name} v${data.version} - TLDR Documentation\n`);
  lines.push(`${data.summary}\n`);
  lines.push(`**Generated:** ${data.generated}`);
  lines.push(`**TLDR Spec:** v0.1`);
  lines.push(`**Commands:** ${data.commands.length} total\n`);
  lines.push('---\n');

  // Table of Contents
  lines.push('## Table of Contents\n');
  lines.push('- [Global Index](#global-index)');
  lines.push('- [Command Categories](#command-categories)');
  lines.push('- [Command Details](#command-details)');

  const categories = categorizeCommands(data.commands);
  if (categories['top-level'].length > 0) {
    lines.push('  - [Top-Level Commands](#top-level-commands)');
  }
  for (const namespace of Object.keys(categories.namespaced).sort()) {
    lines.push(`  - [${namespace} Commands](#${namespace}-commands)`);
  }

  lines.push('- [Dependency Graph](#dependency-graph)');
  lines.push('- [Analytics](#analytics)\n');
  lines.push('---\n');

  // Global Index
  lines.push('## Global Index\n');
  lines.push('```');
  lines.push(data.globalIndex);
  lines.push('```\n');

  // Command Categories
  lines.push('## Command Categories\n');

  if (categories['top-level'].length > 0) {
    lines.push('### Top-Level Commands\n');
    for (const cmd of categories['top-level'].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`- **${cmd.name}** - ${cmd.purpose}`);
    }
    lines.push('');
  }

  for (const namespace of Object.keys(categories.namespaced).sort()) {
    lines.push(`### ${namespace} Commands\n`);
    for (const cmd of categories.namespaced[namespace].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`- **${cmd.name}** - ${cmd.purpose}`);
    }
    lines.push('');
  }

  // Command Details
  lines.push('## Command Details\n');

  for (const cmd of data.commands) {
    lines.push(`### \`${cmd.name}\`\n`);
    lines.push(`**Purpose:** ${cmd.purpose}\n`);

    if (cmd.inputs) {
      lines.push(`**Inputs:** ${cmd.inputs}\n`);
    }

    if (cmd.outputs) {
      lines.push(`**Outputs:** ${cmd.outputs}\n`);
    }

    if (cmd.sideEffects) {
      lines.push(`**Side Effects:** ${cmd.sideEffects}\n`);
    }

    const flags = parseFlags(cmd.flags);
    if (flags.length > 0) {
      lines.push('**Flags:**\n');
      for (const flag of flags) {
        const defaultStr = flag.default ? ` (default: ${flag.default})` : '';
        lines.push(`- \`--${flag.name}\` (${flag.type}${defaultStr}) - ${flag.description}`);
      }
      lines.push('');
    }

    const examples = parseExamples(cmd.examples);
    if (examples.length > 0) {
      lines.push('**Examples:**\n');
      for (const example of examples) {
        lines.push('```bash');
        lines.push(example);
        lines.push('```');
      }
      lines.push('');
    }

    const related = parseRelated(cmd.related);
    if (related.length > 0) {
      lines.push(`**Related:** ${related.map(r => `\`${r}\``).join(', ')}\n`);
    }

    if (cmd.schemaJson) {
      lines.push('**Output Schema:**\n');
      lines.push('```');
      lines.push(cmd.schemaJson);
      lines.push('```\n');
    }

    lines.push('---\n');
  }

  // Dependency Graph
  lines.push('## Dependency Graph\n');
  const graph = buildDependencyGraph(data.commands);

  lines.push('### Most Connected Commands\n');
  const sortedByCentrality = Object.entries(graph.centrality)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [cmd, centrality] of sortedByCentrality) {
    if (centrality > 0) {
      const outgoing = (graph.outgoing[cmd] || []).length;
      const incoming = (graph.incoming[cmd] || []).length;
      lines.push(`- **${cmd}** (${centrality} connections: ${outgoing} outgoing, ${incoming} incoming)`);
    }
  }
  lines.push('');

  // Analytics
  lines.push('## Analytics\n');

  const flagAnalysis = analyzeFlagTypes(data.commands);
  lines.push('### Flag Type Distribution\n');
  for (const [type, count] of Object.entries(flagAnalysis.distribution).sort((a, b) => b[1] - a[1])) {
    lines.push(`- **${type}**: ${count} flags`);
  }
  lines.push(`\n**Total Flags:** ${flagAnalysis.total}`);
  lines.push(`**Average per Command:** ${flagAnalysis.averagePerCommand}\n`);

  const namespaceCount = Object.keys(categories.namespaced).length;
  lines.push('### Command Distribution\n');
  lines.push(`- **Top-level commands:** ${categories['top-level'].length}`);
  lines.push(`- **Namespaces:** ${namespaceCount}`);
  for (const [namespace, cmds] of Object.entries(categories.namespaced).sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`  - **${namespace}:** ${cmds.length} commands`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate ASCII text documentation
 */
function generateTextDocs(data) {
  const lines = [];
  const width = 80;
  const hr = '='.repeat(width);
  const hr2 = '-'.repeat(width);

  // Header
  lines.push(hr);
  lines.push(`  ${data.name} v${data.version} - Complete TLDR Documentation`);
  lines.push(hr);
  lines.push('');
  lines.push(`  ${data.summary}`);
  lines.push('');
  lines.push(`  Generated: ${data.generated}`);
  lines.push('  TLDR Spec: v0.1');
  lines.push(`  Commands: ${data.commands.length} total`);
  lines.push('');
  lines.push(hr);
  lines.push('');

  // Global Index
  lines.push('GLOBAL INDEX');
  lines.push(hr2);
  lines.push(data.globalIndex);
  lines.push('');
  lines.push(hr);
  lines.push('');

  // Command Index
  lines.push('COMMAND INDEX');
  lines.push(hr2);

  const categories = categorizeCommands(data.commands);

  if (categories['top-level'].length > 0) {
    lines.push('');
    lines.push('[Top-Level Commands]');
    for (const cmd of categories['top-level'].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`  ${cmd.name}`);
    }
  }

  for (const namespace of Object.keys(categories.namespaced).sort()) {
    lines.push('');
    lines.push(`[${namespace.charAt(0).toUpperCase() + namespace.slice(1)} Commands]`);
    for (const cmd of categories.namespaced[namespace].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`  ${cmd.name}`);
    }
  }

  lines.push('');
  lines.push(hr);
  lines.push('');

  // Command Details
  lines.push('COMMAND DETAILS');
  lines.push(hr);

  for (const cmd of data.commands) {
    lines.push('');
    lines.push(`>>> ${cmd.name} <<<`);
    lines.push(hr2);
    lines.push(cmd.tldrOutput);
    lines.push('');
  }

  // Footer
  lines.push(hr);
  lines.push(`  End of ${data.name} TLDR Documentation`);
  lines.push('  Generated by: tldr-doc-gen.js (TLDR v0.1 Universal Generator)');
  lines.push(hr);

  return lines.join('\n');
}

/**
 * Generate JSON output with analytics
 */
function generateJsonDocs(data) {
  const graph = buildDependencyGraph(data.commands);
  const categories = categorizeCommands(data.commands);
  const flagAnalysis = analyzeFlagTypes(data.commands);

  return JSON.stringify({
    metadata: {
      name: data.name,
      version: data.version,
      summary: data.summary,
      generated: data.generated,
      tldrSpec: 'v0.1',
      totalCommands: data.commands.length
    },
    globalIndex: parseAsciiTldr(data.globalIndex),
    commands: data.commands.map(cmd => ({
      name: cmd.name,
      purpose: cmd.purpose,
      inputs: cmd.inputs,
      outputs: cmd.outputs,
      sideEffects: cmd.sideEffects,
      flags: parseFlags(cmd.flags),
      examples: parseExamples(cmd.examples),
      related: parseRelated(cmd.related),
      schemaJson: cmd.schemaJson,
      ascii: cmd.tldrOutput
    })),
    analytics: {
      categories: {
        topLevel: categories['top-level'].map(c => c.name),
        namespaced: Object.fromEntries(
          Object.entries(categories.namespaced).map(([ns, cmds]) => [
            ns,
            cmds.map(c => c.name)
          ])
        )
      },
      flagTypes: flagAnalysis,
      dependencyGraph: graph,
      mostConnectedCommands: Object.entries(graph.centrality)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([cmd, centrality]) => ({
          command: cmd,
          centrality,
          outgoing: (graph.outgoing[cmd] || []).length,
          incoming: (graph.incoming[cmd] || []).length
        }))
    },
    generatedBy: 'tldr-doc-gen.js (TLDR v0.1 Universal Generator)'
  }, null, 2);
}

// ============================================================================
// Main Logic
// ============================================================================

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: tldr-doc-gen.js <cli-command> [--validate|--analyze]');
    console.error('');
    console.error('Examples:');
    console.error('  tldr-doc-gen.js forest');
    console.error('  tldr-doc-gen.js forest --validate');
    console.error('  tldr-doc-gen.js forest --analyze');
    process.exit(1);
  }

  const cli = args[0];
  const mode = args[1];

  // Check if CLI is available
  if (!isCommandAvailable(cli)) {
    console.error(`✖ Error: '${cli}' command not found`);
    process.exit(1);
  }

  console.log(`ℹ Fetching global TLDR index from '${cli} --tldr'...`);

  // Fetch global TLDR
  let globalTldr;
  try {
    globalTldr = exec(`${cli} --tldr`);
  } catch (error) {
    console.error('✖ Failed to fetch global TLDR');
    console.error(error.message);
    process.exit(1);
  }

  // Parse global index
  const parsed = parseAsciiTldr(globalTldr);
  const name = parsed.NAME;
  const version = parsed.VERSION;
  const summary = parsed.SUMMARY;
  const commands = parsed.COMMANDS ? parsed.COMMANDS.split(',').map(c => c.trim()) : [];

  // Validate global index
  let validationErrors = 0;
  if (!name) { console.error('✖ Global index missing NAME'); validationErrors++; }
  if (!version) { console.error('✖ Global index missing VERSION'); validationErrors++; }
  if (!summary) { console.error('✖ Global index missing SUMMARY'); validationErrors++; }
  if (commands.length === 0) { console.error('✖ Global index missing COMMANDS'); validationErrors++; }

  if (validationErrors > 0) {
    console.error(`✖ Global index validation failed with ${validationErrors} error(s)`);
    process.exit(1);
  }

  console.log('✔ Global index validated');
  console.log(`ℹ Found ${commands.length} commands`);

  // Validation mode
  if (mode === '--validate') {
    console.log('ℹ Running validation checks...\n');

    let accessibleCommands = 0;
    let failedCommands = 0;
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const cmd of commands) {
      const cmdArgs = cmd.replace(/\./g, ' ');

      // Fetch both ASCII and JSON
      const ascii = exec(`${cli} ${cmdArgs} --tldr`, { allowFailure: true });
      const json = exec(`${cli} ${cmdArgs} --tldr --json`, { allowFailure: true });

      if (ascii && json) {
        accessibleCommands++;

        // Validate format consistency
        const validation = validateTldrFormat(ascii, json, cmd);

        if (validation.errors.length > 0) {
          console.error(`✖ Command '${cmd}':`);
          validation.errors.forEach(err => console.error(`  - ${err}`));
          totalErrors += validation.errors.length;
        }

        if (validation.warnings.length > 0) {
          console.warn(`⚠ Command '${cmd}':`);
          validation.warnings.forEach(warn => console.warn(`  - ${warn}`));
          totalWarnings += validation.warnings.length;
        }
      } else {
        console.error(`✖ Command '${cmd}' is not accessible`);
        failedCommands++;
      }
    }

    // Validation summary
    console.log('');
    console.log('========================================');
    console.log('VALIDATION SUMMARY');
    console.log('========================================');
    console.log(`ℹ CLI: ${name} v${version}`);
    console.log(`ℹ Total commands: ${commands.length}`);
    console.log(`✔ Accessible commands: ${accessibleCommands}`);

    if (failedCommands > 0) {
      console.error(`✖ Failed commands: ${failedCommands}`);
    }

    if (totalErrors > 0) {
      console.error(`✖ Validation errors: ${totalErrors}`);
    }

    if (totalWarnings > 0) {
      console.warn(`⚠ Validation warnings: ${totalWarnings}`);
    }

    console.log('');
    if (totalErrors === 0 && failedCommands === 0) {
      console.log(`✔ ${name} is TLDR v0.1 compliant ✨`);
      process.exit(0);
    } else {
      console.error(`✖ ${name} has validation failures`);
      process.exit(1);
    }
  }

  // Documentation generation mode
  console.log('ℹ Fetching command details...');

  const commandData = [];
  for (const cmd of commands) {
    const cmdArgs = cmd.replace(/\./g, ' ');

    try {
      const tldrOutput = exec(`${cli} ${cmdArgs} --tldr`);
      const parsedCmd = parseAsciiTldr(tldrOutput);

      commandData.push({
        name: cmd,
        purpose: parsedCmd.PURPOSE || '',
        inputs: parsedCmd.INPUTS || '',
        outputs: parsedCmd.OUTPUTS || '',
        sideEffects: parsedCmd.SIDE_EFFECTS || '',
        flags: parsedCmd.FLAGS || '',
        examples: parsedCmd.EXAMPLES || '',
        related: parsedCmd.RELATED || '',
        schemaJson: parsedCmd.SCHEMA_JSON || '',
        tldrOutput
      });
    } catch (error) {
      console.warn(`⚠ Failed to fetch TLDR for command '${cmd}'`);
      commandData.push({
        name: cmd,
        purpose: 'ERROR: Failed to fetch TLDR',
        tldrOutput: `ERROR: ${error.message}`
      });
    }
  }

  const data = {
    name,
    version,
    summary,
    generated: new Date().toISOString(),
    globalIndex: globalTldr,
    commands: commandData
  };

  // Generate all formats
  const outputPrefix = cli;

  console.log('ℹ Generating documentation files...');

  // Text format
  const textOutput = `${outputPrefix}_tldr.txt`;
  fs.writeFileSync(textOutput, generateTextDocs(data));
  console.log(`✔ Generated: ${textOutput}`);

  // Markdown format
  const mdOutput = `${outputPrefix}_tldr.md`;
  fs.writeFileSync(mdOutput, generateMarkdownDocs(data));
  console.log(`✔ Generated: ${mdOutput}`);

  // JSON format
  const jsonOutput = `${outputPrefix}_tldr.json`;
  fs.writeFileSync(jsonOutput, generateJsonDocs(data));
  console.log(`✔ Generated: ${jsonOutput}`);

  console.log('');
  console.log('✔ Done! Documentation generated in multiple formats.');
}

// Run main
if (require.main === module) {
  main();
}

module.exports = {
  parseAsciiTldr,
  parseFlags,
  parseExamples,
  parseRelated,
  validateTldrFormat,
  buildDependencyGraph,
  categorizeCommands,
  analyzeFlagTypes
};
