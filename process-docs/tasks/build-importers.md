# Task: Build Content Importers

## Objective
Provide import pipelines for markdown, Obsidian, Roam, and generic JSON to seed a Forest graph from existing knowledge bases, including metadata extraction.

## Key Deliverables
- Import specification covering supported formats, field mappings, and configuration options.
- CLI command(s) for running imports with folder targets and dry-run support.
- Parsers handling front-matter tags, created/updated timestamps, and attachments.
- Documentation with examples and troubleshooting tips.
- Tests or fixtures validating imports across supported formats.

## Implementation Plan
1. **Discovery**
   - Inventory common file structures for target systems (Obsidian, Roam, markdown folders).
   - Identify required dependencies (YAML front matter parsing, zip extraction, etc.).
2. **Design**
   - Define a modular importer interface for future extensibility.
   - Map metadata fields to Forest node attributes and tags.
3. **Implementation**
   - Build individual importer modules and integrate them with the CLI (`forest import`).
   - Support dry-run, progress reporting, and error handling.
4. **Validation**
   - Create sample datasets and automated tests to confirm parsing accuracy.
   - Run manual imports into a test graph to ensure link creation and deduping behave as expected.
5. **Documentation**
   - Write user guides, including migration checklists and performance considerations.

## Dependencies & Risks
- Large imports may need streaming or batching to avoid memory spikes.
- Must ensure idempotency when rerunning imports against the same data.
