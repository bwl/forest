# Document Template Implementation Proposal

This document outlines the technical implementation plan for structured document templates in Forest.

## Goals

1. **Enable template-driven document creation** with semantic chunk types
2. **Maintain backward compatibility** with existing ad hoc chunking
3. **Preserve 3-layer architecture** (CLI → Core → API)
4. **Support progressive adoption** (templates are opt-in)
5. **Enable downstream tooling** to leverage structured documents

## Database Schema Changes

### New Table: `templates`

Stores template definitions (can also load from filesystem).

```sql
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,              -- e.g., 'research-paper'
  name TEXT NOT NULL,               -- e.g., 'Research Paper'
  description TEXT,
  version TEXT NOT NULL,            -- e.g., '1.0.0'
  definition TEXT NOT NULL,         -- JSON blob of template spec
  is_system BOOLEAN DEFAULT 1,      -- System vs. user-defined
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Modified Table: `documents`

Add template association.

```sql
-- Add new columns to documents table
ALTER TABLE documents ADD COLUMN template_id TEXT;  -- NULL for ad hoc docs
ALTER TABLE documents ADD COLUMN template_version TEXT;
```

### Modified Table: `document_chunks`

Add chunk type information.

```sql
-- Add new columns to document_chunks table
ALTER TABLE document_chunks ADD COLUMN chunk_type_id TEXT;  -- e.g., 'abstract', 'methodology'
ALTER TABLE document_chunks ADD COLUMN chunk_type_label TEXT;  -- Display name
ALTER TABLE document_chunks ADD COLUMN chunk_instance INTEGER DEFAULT 0;  -- For multiple cardinality chunks
```

### Modified Table: `nodes`

Add chunk type for standalone querying.

```sql
-- Add new column to nodes table
ALTER TABLE nodes ADD COLUMN chunk_type_id TEXT;  -- Denormalized for fast querying
```

## Core Type Definitions

### `src/types/template.ts`

```typescript
export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  chunks: ChunkDefinition[];
  metadata?: MetadataField[];
  constraints?: TemplateConstraint[];
}

export interface ChunkDefinition {
  id: string;                    // Unique within template (e.g., "abstract")
  label: string;                 // Display name (e.g., "Abstract")
  required: boolean;
  cardinality: 'single' | 'multiple';
  order?: number;
  maxTokens?: number;
  minTokens?: number;
  prompt?: string;
  placeholder?: string;
  validate?: ValidationRule[];
}

export interface MetadataField {
  key: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  required: boolean;
  default?: any;
}

export interface ValidationRule {
  type: 'regex' | 'function' | 'length' | 'custom';
  params: any;
  message: string;
}

export interface TemplateConstraint {
  type: string;
  condition: string;
  message: string;
}

export interface ChunkInstance {
  typeId: string;               // Reference to ChunkDefinition.id
  typeLabel: string;
  instance: number;             // 0 for single, 0..N for multiple
  nodeId: string;
  segmentId: string;
  content: string;
  order: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  chunkTypeId: string;
  message: string;
  severity: 'error' | 'warning';
}

export type ValidationWarning = ValidationError;
```

## Core Implementation

### `src/lib/templates.ts`

Template loading and management.

```typescript
import { db } from './db';
import type { DocumentTemplate } from '../types/template';

// Load templates from filesystem on startup
export function loadSystemTemplates(): void {
  const templateDir = path.join(__dirname, '../templates');
  const files = fs.readdirSync(templateDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const template = JSON.parse(fs.readFileSync(path.join(templateDir, file), 'utf-8'));
    upsertTemplate(template, true);
  }
}

// Store template in database
export function upsertTemplate(template: DocumentTemplate, isSystem: boolean): void {
  const database = db();
  database.run(
    `INSERT OR REPLACE INTO templates (id, name, description, version, definition, is_system, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [template.id, template.name, template.description, template.version, JSON.stringify(template), isSystem ? 1 : 0]
  );
}

// Retrieve template by ID
export function getTemplate(id: string): DocumentTemplate | null {
  const database = db();
  const row = database.exec(`SELECT definition FROM templates WHERE id = ?`, [id])[0];
  return row ? JSON.parse(row.values[0][0] as string) : null;
}

// List all templates
export function listTemplates(): Array<{ id: string; name: string; description: string }> {
  const database = db();
  const result = database.exec(`SELECT id, name, description FROM templates ORDER BY is_system DESC, name ASC`);
  if (!result.length) return [];

  return result[0].values.map(row => ({
    id: row[0] as string,
    name: row[1] as string,
    description: row[2] as string,
  }));
}

// Validate document against template
export function validateDocument(
  documentId: string,
  template: DocumentTemplate,
  chunks: ChunkInstance[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check required chunks
  for (const chunkDef of template.chunks) {
    const instances = chunks.filter(c => c.typeId === chunkDef.id);

    if (chunkDef.required && instances.length === 0) {
      errors.push({
        chunkTypeId: chunkDef.id,
        message: `Missing required chunk: ${chunkDef.label}`,
        severity: 'error',
      });
    }

    if (chunkDef.cardinality === 'single' && instances.length > 1) {
      errors.push({
        chunkTypeId: chunkDef.id,
        message: `Chunk ${chunkDef.label} allows only one instance, found ${instances.length}`,
        severity: 'error',
      });
    }

    // Validate token counts
    for (const instance of instances) {
      const tokenCount = countTokens(instance.content);

      if (chunkDef.maxTokens && tokenCount > chunkDef.maxTokens) {
        warnings.push({
          chunkTypeId: chunkDef.id,
          message: `Chunk ${chunkDef.label} exceeds recommended ${chunkDef.maxTokens} tokens (current: ${tokenCount})`,
          severity: 'warning',
        });
      }

      if (chunkDef.minTokens && tokenCount < chunkDef.minTokens) {
        warnings.push({
          chunkTypeId: chunkDef.id,
          message: `Chunk ${chunkDef.label} below minimum ${chunkDef.minTokens} tokens (current: ${tokenCount})`,
          severity: 'warning',
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

### `src/core/import.ts` (Enhanced)

Add template-aware chunking.

```typescript
import { getTemplate, validateDocument } from '../lib/templates';
import type { DocumentTemplate, ChunkInstance } from '../types/template';

export interface ImportOptions {
  // ... existing options ...
  templateId?: string;           // NEW: Template to use
  validateTemplate?: boolean;    // NEW: Validate against template
  strictValidation?: boolean;    // NEW: Fail on validation errors
}

export async function importDocumentCore(
  title: string,
  body: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const template = options.templateId ? getTemplate(options.templateId) : null;

  // Template-driven chunking
  if (template) {
    return importWithTemplate(title, body, template, options);
  }

  // Existing ad hoc chunking
  return importAdHoc(title, body, options);
}

async function importWithTemplate(
  title: string,
  body: string,
  template: DocumentTemplate,
  options: ImportOptions
): Promise<ImportResult> {
  // 1. Parse document into chunks based on template structure
  const chunks = parseTemplateChunks(body, template);

  // 2. Validate against template
  if (options.validateTemplate) {
    const validation = validateDocument('', template, chunks);

    if (!validation.valid && options.strictValidation) {
      throw new Error(
        `Document validation failed:\n${validation.errors.map(e => `  - ${e.message}`).join('\n')}`
      );
    }

    // Log warnings even in non-strict mode
    if (validation.warnings.length > 0) {
      console.warn('Validation warnings:');
      validation.warnings.forEach(w => console.warn(`  - ${w.message}`));
    }
  }

  // 3. Create document record with template association
  const documentId = generateId();
  const rootNodeId = options.createSummary ? generateId() : null;

  insertDocument({
    id: documentId,
    title,
    body,
    metadata: {
      ...options,
      chunkStrategy: 'template',
      templateId: template.id,
      templateVersion: template.version,
    },
    version: 1,
    rootNodeId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    templateId: template.id,
    templateVersion: template.version,
  });

  // 4. Create nodes for each chunk with type information
  const chunkNodes: NodeRecord[] = [];

  for (const chunk of chunks) {
    const nodeId = generateId();
    const node = createNode({
      id: nodeId,
      title: chunk.typeLabel,
      body: chunk.content,
      tags: extractTags(chunk.content, options),
      isChunk: true,
      parentDocumentId: documentId,
      chunkOrder: chunk.order,
      chunkTypeId: chunk.typeId,  // NEW: Store chunk type
    });

    chunkNodes.push(node);

    // Create document_chunks mapping with type info
    insertDocumentChunk({
      documentId,
      segmentId: chunk.segmentId,
      nodeId,
      offset: calculateOffset(chunks, chunk),
      length: chunk.content.length,
      chunkOrder: chunk.order,
      checksum: hashContent(chunk.content),
      chunkTypeId: chunk.typeId,      // NEW
      chunkTypeLabel: chunk.typeLabel, // NEW
      chunkInstance: chunk.instance,   // NEW
    });
  }

  // 5. Build structural edges (parent-child, sequential)
  const edges = buildStructuralEdges(rootNodeId, chunkNodes, template);

  // 6. Auto-link if requested
  if (options.autoLink) {
    const semanticEdges = await autoLinkDocument(chunkNodes, options);
    edges.push(...semanticEdges);
  }

  return {
    documentId,
    rootNodeId,
    chunkNodes,
    edges,
    template,
  };
}

function parseTemplateChunks(body: string, template: DocumentTemplate): ChunkInstance[] {
  // Strategy 1: Look for chunk markers in body
  // <!-- forest:chunk type=abstract instance=0 -->
  // ...
  // <!-- /forest:chunk -->

  // Strategy 2: Infer from headers matching chunk labels
  // # Abstract
  // # Introduction
  // # Methodology

  // Strategy 3: User provides structured input (JSON/YAML)

  // Implementation TBD - for now, return mock
  const chunks: ChunkInstance[] = [];

  // Parse logic here...

  return chunks;
}
```

### `src/cli/commands/capture.ts` (Enhanced)

Add `--template` flag.

```typescript
import { listTemplates, getTemplate } from '../../lib/templates';

export function createCaptureCommand(clerc: ClercModule) {
  return clerc.defineCommand({
    name: 'capture',
    parameters: ['[title]'],
    flags: {
      // ... existing flags ...
      template: {
        type: String,
        description: 'Document template to use',
      },
      'list-templates': {
        type: Boolean,
        description: 'List available templates',
      },
      'validate-template': {
        type: Boolean,
        default: true,
        description: 'Validate against template',
      },
      'strict-validation': {
        type: Boolean,
        default: false,
        description: 'Fail on validation errors',
      },
    },
  }, async (context) => {
    // List templates if requested
    if (context.flags['list-templates']) {
      const templates = listTemplates();
      console.log('Available templates:');
      templates.forEach(t => {
        console.log(`  ${t.id.padEnd(20)} ${t.name} - ${t.description}`);
      });
      return;
    }

    // Get template if specified
    const template = context.flags.template ? getTemplate(context.flags.template) : null;

    if (context.flags.template && !template) {
      console.error(`Template not found: ${context.flags.template}`);
      console.error('Use --list-templates to see available templates');
      process.exit(1);
    }

    // Show template help if selected
    if (template && !context.flags.stdin && !context.flags.body) {
      console.log(`Using template: ${template.name}`);
      console.log(`\nRequired chunks:`);
      template.chunks.filter(c => c.required).forEach(c => {
        console.log(`  - ${c.label}${c.prompt ? ': ' + c.prompt : ''}`);
      });
      console.log(`\nOptional chunks:`);
      template.chunks.filter(c => !c.required).forEach(c => {
        console.log(`  - ${c.label}${c.prompt ? ': ' + c.prompt : ''}`);
      });
      return;
    }

    // ... rest of capture logic ...

    const result = await importDocumentCore(title, body, {
      templateId: context.flags.template,
      validateTemplate: context.flags['validate-template'],
      strictValidation: context.flags['strict-validation'],
      // ... other options ...
    });

    // Show validation results
    if (result.validation && result.validation.warnings.length > 0) {
      console.log(`\n⚠️  Validation warnings:`);
      result.validation.warnings.forEach(w => {
        console.log(`  - ${w.message}`);
      });
    }
  });
}
```

### `src/cli/commands/templates.ts` (New)

Template management commands.

```typescript
export function registerTemplatesCommands(cli: ClercInstance, clerc: ClercModule) {
  const templatesCmd = clerc.defineCommand({
    name: 'templates',
    description: 'Manage document templates',
  });

  // forest templates list
  const listCmd = clerc.defineCommand({
    name: 'list',
    description: 'List available templates',
  }, async () => {
    const templates = listTemplates();

    console.log('Available document templates:\n');
    templates.forEach(t => {
      console.log(`${t.id.padEnd(25)} ${t.name}`);
      console.log(`${' '.repeat(25)} ${t.description}`);
      console.log();
    });
  });

  // forest templates show <template-id>
  const showCmd = clerc.defineCommand({
    name: 'show',
    parameters: ['<template-id>'],
    description: 'Show template details',
  }, async (context) => {
    const template = getTemplate(context.parameters['template-id']);

    if (!template) {
      console.error(`Template not found: ${context.parameters['template-id']}`);
      process.exit(1);
    }

    console.log(`Template: ${template.name} (v${template.version})`);
    console.log(`Description: ${template.description}\n`);

    console.log('Chunks:');
    template.chunks.forEach(c => {
      const req = c.required ? 'required' : 'optional';
      const card = c.cardinality === 'multiple' ? 'multiple' : 'single';
      console.log(`  ${c.id.padEnd(20)} ${c.label.padEnd(25)} [${req}, ${card}]`);
      if (c.prompt) {
        console.log(`  ${' '.repeat(20)} ${c.prompt}`);
      }
      if (c.maxTokens) {
        console.log(`  ${' '.repeat(20)} max tokens: ${c.maxTokens}`);
      }
    });

    if (template.metadata && template.metadata.length > 0) {
      console.log('\nMetadata fields:');
      template.metadata.forEach(m => {
        const req = m.required ? 'required' : 'optional';
        console.log(`  ${m.key.padEnd(20)} ${m.type.padEnd(10)} [${req}]`);
      });
    }
  });

  // forest templates validate <doc-id>
  const validateCmd = clerc.defineCommand({
    name: 'validate',
    parameters: ['<doc-id>'],
    flags: {
      strict: { type: Boolean, default: false },
    },
    description: 'Validate document against template',
  }, async (context) => {
    const nodeId = resolveNodeReference(context.parameters['doc-id']);
    const node = getNodeById(nodeId);

    if (!node || !node.parentDocumentId) {
      console.error('Not a templated document');
      process.exit(1);
    }

    const doc = getDocumentById(node.parentDocumentId);
    if (!doc.templateId) {
      console.error('Document has no template');
      process.exit(1);
    }

    const template = getTemplate(doc.templateId);
    const chunks = getDocumentChunks(doc.id);

    const validation = validateDocument(doc.id, template, chunks);

    if (validation.valid) {
      console.log('✓ Document is valid');
    } else {
      console.log('✗ Document validation failed:');
      validation.errors.forEach(e => {
        console.log(`  - ${e.message}`);
      });
    }

    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      validation.warnings.forEach(w => {
        console.log(`  - ${w.message}`);
      });
    }

    if (!validation.valid && context.flags.strict) {
      process.exit(1);
    }
  });

  cli.command('templates', templatesCmd);
  templatesCmd.command('list', listCmd);
  templatesCmd.command('show', showCmd);
  templatesCmd.command('validate', validateCmd);
}
```

## Migration Strategy

### Phase 1: Foundation (Week 1-2)
- [ ] Add schema migrations for new columns
- [ ] Implement template loading and storage
- [ ] Define 3-5 core templates (research-paper, meeting-notes, project-spec, blog-post, interview-notes)
- [ ] Add validation logic

### Phase 2: Core Integration (Week 3-4)
- [ ] Enhance `importDocumentCore` with template-aware chunking
- [ ] Add `--template` flag to `forest capture` and `forest import`
- [ ] Implement `forest templates` command group
- [ ] Add chunk type display to `forest node read`

### Phase 3: API Parity (Week 5)
- [ ] Add `/templates` REST endpoints
- [ ] Add `templateId` parameter to `/import` and `/capture`
- [ ] Add `/validate` endpoint for template validation
- [ ] Update API documentation

### Phase 4: Enhanced Features (Week 6-8)
- [ ] Chunk type filtering in search (`--chunk-type`)
- [ ] Template-aware edge scoring (methodology ↔ methodology gets bonus)
- [ ] Template scaffolding (`forest templates scaffold research-paper`)
- [ ] User-defined custom templates
- [ ] Template marketplace/sharing

### Phase 5: GUI Integration (Week 9-12)
- [ ] Template selector in GUI
- [ ] Chunk type visualization
- [ ] Template validation feedback
- [ ] Drag-and-drop chunk reordering

## Backward Compatibility

- Existing documents without `templateId` use ad hoc chunking
- All existing commands work unchanged
- Templates are opt-in via `--template` flag
- Database schema changes are additive (new columns nullable)
- Migration script backfills `chunk_type_id=null` for existing chunks

## Testing Strategy

1. **Unit tests**: Template validation, chunk parsing, type inference
2. **Integration tests**: Full import→edit→export cycle with templates
3. **Migration tests**: Ensure existing documents unaffected
4. **CLI tests**: Verify all template commands work as expected
5. **API tests**: Verify REST endpoints return correct template data

## Open Questions

1. **Chunk delimiter syntax**: HTML comments vs. Markdown syntax vs. custom DSL?
2. **Template versioning**: How to handle template schema changes over time?
3. **Partial templates**: Can users start with ad hoc and migrate to template later?
4. **Mixed documents**: Single document with both templated and ad hoc chunks?
5. **Cross-template edges**: Should methodology chunks from different papers link more strongly?
6. **Template inheritance**: How to implement `extends` for custom templates?
7. **AI integration**: Should AI suggest chunks based on content analysis?

## Success Metrics

- [ ] 80% of new documents use templates within 3 months of launch
- [ ] Average document validation time < 100ms
- [ ] User feedback rating > 4.5/5 for template UX
- [ ] 10+ community-contributed templates within 6 months
- [ ] Downstream GUI demonstrates structured querying capabilities
