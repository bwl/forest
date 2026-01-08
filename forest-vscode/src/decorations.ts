import * as vscode from 'vscode';

// Decoration type to hide segment markers
let markerDecorationType: vscode.TextEditorDecorationType;

export function setupDecorations(context: vscode.ExtensionContext) {
  // Create decoration type with minimal visual footprint
  markerDecorationType = vscode.window.createTextEditorDecorationType({
    opacity: '0.15', // Very faint
    fontStyle: 'italic',
    color: new vscode.ThemeColor('editorLineNumber.foreground'), // Subtle color
    letterSpacing: '-0.5em', // Compress text
  });

  // Apply decorations on document open/change
  vscode.workspace.onDidOpenTextDocument(updateDecorations, null, context.subscriptions);
  vscode.workspace.onDidChangeTextDocument(
    (event) => updateDecorations(event.document),
    null,
    context.subscriptions
  );

  // Apply to all currently open editors
  vscode.window.visibleTextEditors.forEach((editor) => {
    if (editor.document.languageId === 'forest-document') {
      updateDecorations(editor.document);
    }
  });

  // Update when active editor changes
  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor && editor.document.languageId === 'forest-document') {
        updateDecorations(editor.document);
      }
    },
    null,
    context.subscriptions
  );
}

function updateDecorations(document: vscode.TextDocument) {
  if (document.languageId !== 'forest-document') {
    return;
  }

  const editor = vscode.window.visibleTextEditors.find((e) => e.document === document);
  if (!editor) {
    return;
  }

  const text = document.getText();
  const markerRanges: vscode.Range[] = [];

  const lines = text.split('\n');
  const markerRegex = /^<!--\s*forest:segment\s+(start|end)\s+(.+?)\s*-->$/i;

  for (let i = 0; i < lines.length; i++) {
    if (markerRegex.test(lines[i])) {
      const range = new vscode.Range(
        new vscode.Position(i, 0),
        new vscode.Position(i, lines[i].length)
      );
      markerRanges.push(range);
    }
  }

  // Apply decoration to all marker lines
  editor.setDecorations(markerDecorationType, markerRanges);
}
