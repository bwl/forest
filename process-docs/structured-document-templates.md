# Structured Document Templates for Forest

## Problem Statement

Forest's current document model uses ad hoc chunking strategies (headers, size, hybrid) that produce inconsistent, unpredictable chunk structures. While flexible, this approach has significant limitations:

1. **Unpredictable structure**: No two documents chunk the same way, even for similar content types
2. **Difficult pattern recognition**: Downstream tools can't rely on consistent chunk semantics
3. **Poor discoverability**: Users don't know what kind of chunks their document will produce
4. **Limited composability**: Hard to build intelligent features when chunk meaning varies wildly
5. **No semantic guarantees**: A "chunk" is just a slice of text with no inherent purpose

## Vision: Document Templates

Instead of ad hoc chunking, Forest should support **document templates** — predefined structures with named, typed chunks that carry semantic meaning:

```
Template: Research Paper
├─ Abstract (required, single)
├─ Introduction (required, single)
├─ Literature Review (optional, single)
├─ Methodology (required, single)
├─ Results (required, multiple allowed)
├─ Discussion (required, single)
├─ Conclusion (required, single)
└─ References (required, single)
```

Each chunk type has:
- **Name**: Semantic identifier (e.g., "Abstract", "Methodology")
- **Cardinality**: Single vs. multiple instances allowed
- **Requirement**: Required vs. optional
- **Constraints**: Max tokens, format expectations, etc.
- **Metadata**: Custom fields (e.g., author, date, version)

## Core Benefits

### 1. Predictable Structure
GUI and CLI tools can **rely on consistent chunk semantics**:
- "Show me all Research Paper abstracts created this month"
- "Compare methodology sections across papers"
- "Find papers missing a literature review"

### 2. Intelligent Validation
Templates enable **structural validation** at import/edit time:
- "Error: Research Paper requires an Abstract chunk"
- "Warning: Methodology section exceeds recommended 2000 tokens"
- "Note: You have 3 Results sections; consider consolidating"

### 3. Semantic Search Enhancement
Chunk types provide **contextual grounding** for embeddings:
- Search only in "Introduction" chunks for high-level summaries
- Find similar "Methodology" sections for replicable research
- Compare "Conclusion" chunks across documents

### 4. Workflow Automation
Templates enable **document-type-specific workflows**:
- Meeting Notes → Auto-generate "Action Items" chunk from body
- Project Spec → Validate "Requirements" chunk against checklist
- Research Paper → Auto-generate citation graph from "References"

### 5. Progressive Enhancement
Start simple, add complexity over time:
- **v1**: Predefined templates (Research Paper, Meeting Notes, etc.)
- **v2**: User-defined custom templates
- **v3**: Template inheritance and composition
- **v4**: AI-assisted template suggestion based on content

## Example Use Cases

### Research Papers
```
forest import paper.md --template research-paper
forest node read <abstract-chunk>  # Shows only abstract
forest search "neural networks" --chunk-type methodology
forest export graphviz --filter template=research-paper
```

### Meeting Notes
```
forest capture --template meeting-notes --from-stdin <<EOF
# Weekly Standup - 2025-10-23
Attendees: Alice, Bob, Charlie
Discussion: ...
Action Items: ...
EOF

forest node read @0 --chunk agenda  # Show only agenda chunk
forest query --chunk-type action-items --status open
```

### Project Specifications
```
forest import spec.md --template project-spec
forest validate <doc-id>  # Check all required chunks present
forest node link <requirements> <implementation>  # Semantic linking
```

## Design Principles

1. **Backward Compatible**: Existing ad hoc documents continue working
2. **Optional**: Templates are opt-in, not required
3. **Flexible**: Templates guide but don't constrain creativity
4. **Extensible**: Easy to add new templates or customize existing ones
5. **Composable**: Chunks can reference other chunks or documents
6. **Discoverable**: `forest templates list` shows available templates

## Implementation Strategy

See:
- `document-template-definitions.md` - Concrete template specifications
- `document-template-implementation.md` - Technical implementation proposal

## Open Questions

1. **Template storage**: Schema in DB vs. config files vs. both?
2. **Chunk type hierarchy**: Should "Section" be a parent type of "Introduction"?
3. **Mixed mode**: Can a single document have both templated and ad hoc chunks?
4. **Migration**: How to retroactively apply templates to existing documents?
5. **Validation strictness**: Hard errors vs. soft warnings vs. suggestions?
6. **Custom templates**: User-defined vs. system-defined — where's the line?
7. **Rendering**: Should chunk type affect display formatting?

## Related Work

- **Notion**: Database schemas with typed properties
- **Obsidian**: Templater plugin with variable placeholders
- **LaTeX**: Document classes with required/optional sections
- **DITA**: Topic types (concept, task, reference)
- **Markdown variants**: YAML frontmatter for metadata

## Next Steps

1. Define 3-5 core templates with high utility (Research Paper, Meeting Notes, Project Spec, Blog Post, Interview)
2. Design schema for template definitions (JSON, YAML, or TypeScript)
3. Implement template-aware chunking in `importDocumentCore`
4. Add validation hooks in document edit workflow
5. Extend CLI with template discovery and selection
6. Build GUI prototype demonstrating template benefits
