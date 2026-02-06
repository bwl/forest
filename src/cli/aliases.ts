/**
 * Top-level command aliases for frequently used nested commands.
 *
 * These register short-form commands (e.g. `forest read`) that delegate
 * to the same handler functions used by the nested versions (`forest node read`).
 */

import {
  runNodeRead,
  runNodeEdit,
  runNodeRefresh,
  runNodeDelete,
  runNodeImport,
  runNodeSynthesize,
  type NodeReadFlags,
  type NodeEditFlags,
  type NodeRefreshFlags,
  type NodeDeleteFlags,
  type NodeImportFlags,
  type NodeSynthesizeFlags,
} from './commands/node';
import { runTagsAdd, type TagsModifyFlags } from './commands/tags';
import { getVersion } from './commands/version';
import { COMMAND_TLDR, emitTldrAndExit } from './tldr';
import { handleError } from './shared/utils';

type ClercModule = typeof import('clerc');
type ClercInstance = ReturnType<ClercModule['Clerc']['create']>;

export function registerAliases(cli: ClercInstance, clerc: ClercModule) {
  // forest read <ref>
  cli.command(
    clerc.defineCommand(
      {
        name: 'read',
        description: 'Show the full content of a note',
        parameters: ['[id]'],
        flags: {
          meta: { type: Boolean, description: 'Show metadata summary without the body text' },
          json: { type: Boolean, description: 'Emit JSON output' },
          longIds: { type: Boolean, description: 'Display full ids in text output' },
          raw: { type: Boolean, description: 'Output only the raw markdown body (for piping)' },
          tldr: { type: String, description: 'Output command metadata for agent consumption' },
        },
      },
      async ({ parameters, flags }: { parameters: { id?: string }; flags: NodeReadFlags }) => {
        try {
          if (flags.tldr !== undefined) {
            const jsonMode = flags.tldr === 'json';
            emitTldrAndExit(COMMAND_TLDR.read, getVersion(), jsonMode);
          }
          await runNodeRead(parameters.id, flags);
        } catch (error) {
          handleError(error);
        }
      },
    ),
  );

  // forest edit <ref>
  cli.command(
    clerc.defineCommand(
      {
        name: 'edit',
        description: 'Open a note in your editor for inline updates',
        parameters: ['[id]'],
        flags: {
          editor: { type: String, description: 'Override editor command' },
          noAutoLink: { type: Boolean, description: 'Skip rescoring edges after saving' },
          tldr: { type: String, description: 'Output command metadata for agent consumption' },
        },
      },
      async ({ parameters, flags }: { parameters: { id?: string }; flags: NodeEditFlags }) => {
        try {
          if (flags.tldr !== undefined) {
            const jsonMode = flags.tldr === 'json';
            emitTldrAndExit(COMMAND_TLDR.edit, getVersion(), jsonMode);
          }
          await runNodeEdit(parameters.id, flags);
        } catch (error) {
          handleError(error);
        }
      },
    ),
  );

  // forest update <ref>
  cli.command(
    clerc.defineCommand(
      {
        name: 'update',
        description: 'Update note fields from flags or files and optionally rescore links',
        parameters: ['[id]'],
        flags: {
          title: { type: String, description: 'New title' },
          body: { type: String, description: 'New body content' },
          file: { type: String, description: 'Read new body from file' },
          stdin: { type: Boolean, description: 'Read new body from standard input' },
          tags: { type: String, description: 'Comma-separated list of tags to set' },
          noAutoLink: { type: Boolean, description: 'Skip rescoring edges after update' },
          tldr: { type: String, description: 'Output command metadata for agent consumption' },
        },
      },
      async ({ parameters, flags }: { parameters: { id?: string }; flags: NodeRefreshFlags }) => {
        try {
          if (flags.tldr !== undefined) {
            const jsonMode = flags.tldr === 'json';
            emitTldrAndExit(COMMAND_TLDR.update, getVersion(), jsonMode);
          }
          await runNodeRefresh(parameters.id, flags);
        } catch (error) {
          handleError(error);
        }
      },
    ),
  );

  // forest delete <ref>
  cli.command(
    clerc.defineCommand(
      {
        name: 'delete',
        description: 'Delete a note and its edges',
        parameters: ['[id]'],
        flags: {
          force: { type: Boolean, description: 'Do not prompt for confirmation' },
          tldr: { type: String, description: 'Output command metadata for agent consumption' },
        },
      },
      async ({ parameters, flags }: { parameters: { id?: string }; flags: NodeDeleteFlags }) => {
        try {
          if (flags.tldr !== undefined) {
            const jsonMode = flags.tldr === 'json';
            emitTldrAndExit(COMMAND_TLDR['delete'], getVersion(), jsonMode);
          }
          await runNodeDelete(parameters.id, flags);
        } catch (error) {
          handleError(error);
        }
      },
    ),
  );

  // forest import
  cli.command(
    clerc.defineCommand(
      {
        name: 'import',
        description: 'Import a large markdown document by chunking it into multiple linked nodes',
        flags: {
          file: { type: String, alias: 'f', description: 'Read document from file' },
          stdin: { type: Boolean, description: 'Read document from standard input' },
          title: { type: String, alias: 't', description: 'Override auto-detected document title' },
          tags: { type: String, description: 'Comma-separated tags for all chunks' },
          chunkStrategy: { type: String, description: 'Chunking strategy: headers, size, hybrid' },
          maxTokens: { type: Number, description: 'Maximum tokens per chunk (default: 2000)' },
          overlap: { type: Number, description: 'Character overlap between chunks' },
          noParent: { type: Boolean, description: 'Skip creating root/index node' },
          noSequential: { type: Boolean, description: 'Skip linking chunks sequentially' },
          noAutoLink: { type: Boolean, description: 'Skip semantic auto-linking' },
          json: { type: Boolean, description: 'Emit JSON output' },
          tldr: { type: String, description: 'Output command metadata for agent consumption' },
        },
      },
      async ({ flags }: { flags: NodeImportFlags }) => {
        try {
          if (flags.tldr !== undefined) {
            const jsonMode = flags.tldr === 'json';
            emitTldrAndExit(COMMAND_TLDR['import'], getVersion(), jsonMode);
          }
          await runNodeImport(flags);
        } catch (error) {
          handleError(error);
        }
      },
    ),
  );

  // forest synthesize <refs...>
  cli.command(
    clerc.defineCommand(
      {
        name: 'synthesize',
        description: 'Use GPT-5 to synthesize a new article from 2+ existing notes',
        parameters: ['[ids...]'],
        flags: {
          model: { type: String, description: 'Model to use: gpt-5 or gpt-5-mini' },
          reasoning: { type: String, description: 'Reasoning effort: minimal, low, medium, high' },
          verbosity: { type: String, description: 'Output verbosity: low, medium, high' },
          preview: { type: Boolean, description: 'Preview synthesis without saving' },
          autoLink: { type: Boolean, description: 'Auto-link the new node to source nodes', default: true },
          maxTokens: { type: Number, description: 'Maximum output tokens' },
          tldr: { type: String, description: 'Output command metadata for agent consumption' },
        },
      },
      async ({ parameters, flags }: { parameters: { ids?: string[] }; flags: NodeSynthesizeFlags }) => {
        try {
          if (flags.tldr !== undefined) {
            const jsonMode = flags.tldr === 'json';
            emitTldrAndExit(COMMAND_TLDR.synthesize, getVersion(), jsonMode);
          }
          await runNodeSynthesize(parameters.ids, flags);
        } catch (error) {
          handleError(error);
        }
      },
    ),
  );

  // forest tag <ref> <tags>
  cli.command(
    clerc.defineCommand(
      {
        name: 'tag',
        description: 'Add one or more tags to a note',
        parameters: ['<ref>', '<tags>'],
        flags: {
          json: { type: Boolean, description: 'Emit JSON output' },
          tldr: { type: String, description: 'Output command metadata for agent consumption' },
        },
      },
      async ({ parameters, flags }: { parameters: { ref?: string; tags?: string }; flags: TagsModifyFlags }) => {
        try {
          if (flags.tldr !== undefined) {
            const jsonMode = flags.tldr === 'json';
            emitTldrAndExit(COMMAND_TLDR.tag, getVersion(), jsonMode);
          }
          await runTagsAdd(parameters.ref, parameters.tags, flags);
        } catch (error) {
          handleError(error);
        }
      },
    ),
  );
}
