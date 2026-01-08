import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import { setupDecorations } from './decorations';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  // Server options - bundled server in extension dist/
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc },
  };

  // Client options
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'forest-document' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.forest.md'),
    },
  };

  // Create the language client
  client = new LanguageClient(
    'forestLanguageServer',
    'Forest Language Server',
    serverOptions,
    clientOptions
  );

  // Start the client (and server)
  client.start();

  // Setup marker decorations (hiding)
  setupDecorations(context);

  // Register navigation commands
  context.subscriptions.push(
    vscode.commands.registerCommand('forest.jumpToNextSegment', () => {
      jumpToSegment('next');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('forest.jumpToPreviousSegment', () => {
      jumpToSegment('previous');
    })
  );

  // Auto-save on document save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (document.languageId !== 'forest-document') {
        return;
      }

      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Saving to Forest DB...',
            cancellable: false,
          },
          async () => {
            const { stdout, stderr } = await execAsync(
              `forest documents apply-file "${document.fileName}"`
            );

            if (stderr) {
              console.error('Forest save stderr:', stderr);
            }

            if (stdout) {
              console.log('Forest save output:', stdout);
            }
          }
        );

        vscode.window.showInformationMessage('✔ Validated Forest document (no DB save)');
      } catch (error) {
        const errorMessage = (error as Error).message;
        vscode.window.showErrorMessage(`Failed to save to Forest: ${errorMessage}`);
        console.error('Forest save error:', error);
      }
    })
  );

  console.log('Forest extension activated');
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

function jumpToSegment(direction: 'next' | 'previous') {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'forest-document') {
    return;
  }

  const currentLine = editor.selection.active.line;
  const text = editor.document.getText();
  const lines = text.split('\n');

  // Find segment start markers
  const segmentLines: number[] = [];
  const startRegex = /^<!--\s*forest:segment\s+start\s+(.+?)\s*-->$/i;

  for (let i = 0; i < lines.length; i++) {
    if (startRegex.test(lines[i])) {
      segmentLines.push(i);
    }
  }

  if (segmentLines.length === 0) {
    return;
  }

  let targetLine: number;

  if (direction === 'next') {
    // Find next segment after current line
    targetLine = segmentLines.find((line) => line > currentLine) ?? segmentLines[0];
  } else {
    // Find previous segment before current line
    const previousSegments = segmentLines.filter((line) => line < currentLine);
    targetLine =
      previousSegments.length > 0
        ? previousSegments[previousSegments.length - 1]
        : segmentLines[segmentLines.length - 1];
  }

  // Move cursor to content line (skip the marker)
  const contentLine = targetLine + 1;
  const newPosition = new vscode.Position(contentLine, 0);
  editor.selection = new vscode.Selection(newPosition, newPosition);
  editor.revealRange(
    new vscode.Range(newPosition, newPosition),
    vscode.TextEditorRevealType.InCenter
  );
}
