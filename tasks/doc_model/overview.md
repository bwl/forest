# Document Model Initiative

We are moving from chunk-only storage to a canonical-document model with derived segments. This unlocks full-document editing, consistent chunk regeneration, and resilient graph relationships.

## Goals

- Introduce a canonical `documents` layer that owns source text, metadata, and versioning.
- Maintain a stable mapping between document segments and existing chunk nodes so graph edges survive edits.
- Provide an editor workflow that surfaces the full document when a chunk is edited and writes changes back to the correct segments.
- Automate downstream updates (embeddings, scoring, suggestions) when document content changes.

## Key Concepts

- **Canonical Document**: New database entity storing full text and document-level metadata.
- **Document Chunk Map**: Join table mapping stable `segment_id`s to the current chunk node IDs (with offsets/checksums).
- **Derived Nodes**: Existing `nodes` rows that continue to carry embeddings, tags, and graph edges.
- **Document Session**: Editing context that loads the canonical document, tracks segment boundaries, and reconciles edits.

## Deliverables

1. Schema additions and migrations for canonical documents and chunk mapping.
2. Editing UX and CLI changes for document-aware workflows.
3. Synchronization pipeline that keeps nodes, edges, and embeddings in sync with document edits.
4. Documentation and tests covering the new model and operational procedures.
