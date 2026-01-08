#!/usr/bin/env node
/**
 * Forest Language Server
 * Provides LSP features for Forest document editing
 */

import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult,
  DocumentSymbolParams,
  DocumentSymbol,
  SymbolKind,
  FoldingRangeParams,
  FoldingRange,
  FoldingRangeKind,
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseForestDocument } from './parser.js';

// Create LSP connection
const connection = createConnection(ProposedFeatures.all);

// Create document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      documentSymbolProvider: true,
      foldingRangeProvider: true,
    },
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }

  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
});

// Validate document on change
documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

// Validate document on open
documents.onDidOpen((event) => {
  validateTextDocument(event.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const text = textDocument.getText();
  const parsed = parseForestDocument(text);
  const lines = text.split('\n');

  const diagnostics: Diagnostic[] = parsed.errors.map((error) => {
    const line = error.line - 1; // LSP uses 0-based line numbers
    const lineText = lines[line] || '';
    const lineLength = lineText.length;

    const diagnostic: Diagnostic = {
      severity:
        error.severity === 'error'
          ? DiagnosticSeverity.Error
          : DiagnosticSeverity.Warning,
      range: {
        start: { line, character: 0 },
        end: { line, character: lineLength },
      },
      message: error.message,
      source: 'forest',
    };
    return diagnostic;
  });

  // Send diagnostics to client
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Provide document outline (segment list)
connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const text = document.getText();
  const parsed = parseForestDocument(text);

  return parsed.segments.map((segment) => {
    const symbol: DocumentSymbol = {
      name: segment.title || `Segment ${segment.segmentId.substring(0, 8)}`,
      kind: SymbolKind.Module, // Use Module instead of Section which doesn't exist in LSP v9
      range: {
        start: { line: segment.startLine - 1, character: 0 },
        end: { line: segment.endLine - 1, character: 0 },
      },
      selectionRange: {
        start: { line: segment.contentStartLine - 1, character: 0 },
        end: { line: segment.contentStartLine - 1, character: 0 },
      },
      detail: `Node: ${segment.nodeId.substring(0, 8)}`,
    };
    return symbol;
  });
});

// Provide folding ranges (allows collapsing segment markers)
connection.onFoldingRanges((params: FoldingRangeParams): FoldingRange[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const text = document.getText();
  const parsed = parseForestDocument(text);

  return parsed.segments.map((segment) => ({
    startLine: segment.startLine - 1,  // Fold from start marker
    endLine: segment.endLine - 1,      // To end marker
    kind: FoldingRangeKind.Region,
  }));
});

// Listen to document changes
documents.listen(connection);

// Start listening
connection.listen();

connection.console.log('Forest Language Server started');
