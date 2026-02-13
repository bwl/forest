# Changelog

All notable changes to Forest will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-02-13

### Added
- **Temporal graph analysis toolkit** ([#34](https://github.com/bwl/forest/issues/34))
  - `forest diff --since ...` for node/edge change summaries across snapshots
  - `forest growth` for graph growth metrics over time
  - `forest snapshot` for explicit point-in-time captures
- **Snapshot persistence model** with automatic daily snapshots plus manual snapshot API/CLI parity
  - New `graph_snapshots` table and temporal analysis core
  - New API routes: `GET /api/v1/graph/diff`, `GET /api/v1/graph/growth`, `GET /api/v1/graph/snapshots`, `POST /api/v1/graph/snapshots`
- **Node history and restore workflow** ([#31](https://github.com/bwl/forest/issues/31))
  - New node history capture and restore commands
  - Historical seed support for existing nodes when first accessed
- **Ranking and operations controls**
  - `forest admin rescore` for full-graph rescoring
  - Degree counter maintenance and safeguards for stale edge metrics
- **Deployment ergonomics**
  - `deploy/update-remote.sh` for repeatable server updates
  - Build fallback and startup health-check retry/backoff for safer deploys

### Changed
- **Ranking quality improvements** in edge scoring with stronger tag/project signal handling and improved rescore behavior
- **TypeScript script consistency** by standardizing scripts on `bun x tsc`
- **Web node detail UX**
  - Connected node list now sorts by strongest accepted edge first
  - Connected nodes are directly clickable for navigation
  - Node markdown renders as HTML by default with a source toggle
  - Content container now grows naturally with content (no fixed-height scroll box)

### Fixed
- **Manual snapshot duplication** - creating a manual snapshot no longer triggers a second automatic snapshot
- **Accepted-degree counter drift** - rebuilt and hardened counter updates to keep graph stats accurate over time
- **CLI runtime compatibility** - fixed tag flag normalization and ESM clerc loading edge cases
- **Deploy false negatives** - startup health checks now tolerate slower service warm-up

## [0.3.1] - 2025-10-22

### Added

#### Git-Style Node References & Progressive IDs
- **Progressive UUID abbreviation** - IDs now display with minimum length needed for uniqueness ([7e603d1](https://github.com/bwl/forest/commit/7e603d1), [039aa44](https://github.com/bwl/forest/commit/039aa44))
  - Starts at 4 characters, grows as needed
  - Backward compatible: all existing 8-char and full UUIDs still work
  - `formatNodeIdProgressive()` replaces fixed 8-char display
- **Recency references** - Git-style `HEAD~N` syntax for recent nodes ([7e603d1](https://github.com/bwl/forest/commit/7e603d1))
  - `@` or `@0` - Most recently updated node
  - `@1`, `@2`, etc. - Second, third most recent
  - Works across all commands: `forest node read @`, `forest node link @ @1`
- **Tag search references** - Find nodes by tag ([7e603d1](https://github.com/bwl/forest/commit/7e603d1))
  - `#typescript` - Node tagged with 'typescript'
  - Must match unique node or shows disambiguation
- **Title search references** - Find nodes by title substring ([7e603d1](https://github.com/bwl/forest/commit/7e603d1))
  - Quoted strings match against node titles
  - Must be unique or shows Git-style disambiguation
- **Shell completions** - Tab completion for bash and zsh ([7e603d1](https://github.com/bwl/forest/commit/7e603d1))
  - `completions/forest.bash` and `completions/forest.zsh`
  - Supports commands, flags, and recency references

#### Modular Formatter Architecture
- **Centralized formatting system** in `src/cli/formatters/` ([c01acf4](https://github.com/bwl/forest/commit/c01acf4), [ac427de](https://github.com/bwl/forest/commit/ac427de))
  - Reusable formatter functions for consistent output
  - Color scheme system with customization
  - Markdown formatting utilities
- **Applied to edge and stats commands** for better visual hierarchy ([10a09b7](https://github.com/bwl/forest/commit/10a09b7))
- **Comprehensive color styling** across all CLI commands ([8a68dc7](https://github.com/bwl/forest/commit/8a68dc7))
  - Forest color scheme as default ([dfb3b5a](https://github.com/bwl/forest/commit/dfb3b5a))
  - Configurable color schemes ([2c0f51e](https://github.com/bwl/forest/commit/2c0f51e))

#### Document Model Improvements
- **Canonical document model** - First draft implementation ([bf7dfd0](https://github.com/bwl/forest/commit/bf7dfd0))
  - Document session system for editing multi-chunk documents
  - `src/cli/shared/document-session.ts` with comprehensive tests
- **Preserve existing tags** when saving document segments ([a2e350b](https://github.com/bwl/forest/commit/a2e350b))
  - Tags are no longer lost during document edits
- **PR review improvements** - Comprehensive refinements ([ef66a25](https://github.com/bwl/forest/commit/ef66a25))
  - Enhanced error handling, validation, and edge cases
- **Explicit TypeScript type configuration** for consistent resolution ([3df37ae](https://github.com/bwl/forest/commit/3df37ae))

#### CLI Clarity
- **Clarified search vs. explore roles** ([7902c2f](https://github.com/bwl/forest/commit/7902c2f), [8543b8f](https://github.com/bwl/forest/commit/8543b8f))
  - `search` - Semantic search for specific content
  - `explore` - Interactive graph traversal and discovery
  - Better help text and documentation

### Changed
- **Enhanced CLI visuals** - General improvements to output formatting ([7ad5372](https://github.com/bwl/forest/commit/7ad5372))
- **Documentation reorganization** - Moved docs to `docs/` directory ([bd871ac](https://github.com/bwl/forest/commit/bd871ac))
  - Created 25+ task planning documents in `docs/tasks/`
  - Added comprehensive architecture guides

### Removed
- **Cleanup of cruft** - Removed ~547K lines of old output files ([9bb252a](https://github.com/bwl/forest/commit/9bb252a), [bd871ac](https://github.com/bwl/forest/commit/bd871ac))
  - Deleted old `outputs/` directory with generated files
  - Removed TLDR doc generators (moved to standalone repo)
  - Removed obsolete export and test files

### Fixed
- **TypeScript configuration** - Resolved module resolution inconsistencies ([3df37ae](https://github.com/bwl/forest/commit/3df37ae))
- **Tag preservation** - Tags no longer lost during document segment saves ([a2e350b](https://github.com/bwl/forest/commit/a2e350b))

## [0.3.0] - 2025-10-22

### Added

#### REST API & WebSocket Events
- **Complete REST API** with full CRUD endpoints for nodes, edges, and tags under `/api/v1` ([5f6170c](https://github.com/bwl/forest/commit/5f6170c))
  - Advanced edge management: accept, reject, explain, promote, sweep, undo
  - Pagination support with offset-based navigation
  - Consistent error handling and response envelopes
- **WebSocket endpoint** (`/ws`) with real-time event streaming ([5f6170c](https://github.com/bwl/forest/commit/5f6170c))
  - Event subscriptions with tag filtering
  - Broadcasts all graph mutations: `node:created`, `node:updated`, `node:deleted`, `edge:*`, `tag:renamed`
- **Elysia server foundation** with health and stats endpoints ([139f730](https://github.com/bwl/forest/commit/139f730))
- **Event bus system** for broadcasting graph mutations ([5f6170c](https://github.com/bwl/forest/commit/5f6170c))

#### TLDR Standard for Agent Discovery
- **TLDR Standard v0.1** - Agent-first command metadata for zero-shot CLI discovery ([880ac3e](https://github.com/bwl/forest/commit/880ac3e))
  - `forest --tldr` for global command index
  - `forest <command> --tldr` for detailed command metadata
  - Supports both ASCII and JSON output formats
- **Upgraded to TLDR v0.2** with NDJSON format and `--tldr=all` flag ([3873564](https://github.com/bwl/forest/commit/3873564))

#### Semantic Search
- **`forest search` command** with embedding-based semantic search ([6e4eeca](https://github.com/bwl/forest/commit/6e4eeca))
  - CLI and API support with full feature parity
  - Searches node content using vector embeddings

#### Document Chunking System
- **Database schema for document-aware chunking** - Phase 1 infrastructure ([8de2525](https://github.com/bwl/forest/commit/8de2525))
  - New `documents` table for canonical document storage
  - New `document_chunks` table for segment mappings with byte offsets and checksums
  - Support for versioned documents with edit tracking
- **Invisible chunking** - Phase 2 user-facing layer ([c568989](https://github.com/bwl/forest/commit/c568989))
  - Automatic document reconstruction in `forest node read`
  - Chunk deduplication in search results
  - `--show-chunks` flag in `forest explore` to control visibility
  - Chunks are transparent infrastructure - users think in terms of documents
- **Document reconstruction fixes** for node read command ([b179ccf](https://github.com/bwl/forest/commit/b179ccf))

#### AI-Powered Features
- **LLM-powered tagging** with GPT-5-nano for intelligent tag extraction ([80ce3e4](https://github.com/bwl/forest/commit/80ce3e4))
- **`forest write` command** for AI-assisted content creation ([81d89f2](https://github.com/bwl/forest/commit/81d89f2))
- **`forest node synthesize` command** for generating content from graph context ([81d89f2](https://github.com/bwl/forest/commit/81d89f2), [94b07ad](https://github.com/bwl/forest/commit/94b07ad))
  - Upgraded to full GPT-5 capabilities

#### CLI Enhancements
- **`forest node recent` command** for viewing activity timeline ([68e4273](https://github.com/bwl/forest/commit/68e4273))
- **`--raw` flag** for `forest node read` - outputs pipeable markdown without formatting ([06a6659](https://github.com/bwl/forest/commit/06a6659))
- **Visual scoring matrix** and short ID support for edge management ([fb1d9f6](https://github.com/bwl/forest/commit/fb1d9f6))

#### Architecture
- **3-layer architecture** for CLI/API feature parity ([1bc6455](https://github.com/bwl/forest/commit/1bc6455))
  - Core business logic extracted to `src/core/{nodes,edges,tags,search,stats}.ts`
  - Both CLI and API call same core functions
  - Ensures identical behavior and eliminates code duplication

#### Infrastructure & Documentation
- **Camper submodule** added to project ([84548e1](https://github.com/bwl/forest/commit/84548e1))
- **Branching strategy documentation** ([7dda365](https://github.com/bwl/forest/commit/7dda365))
- **Comprehensive CLAUDE.md updates** with architecture documentation ([457ddcc](https://github.com/bwl/forest/commit/457ddcc))
- **User-focused README** with feature documentation ([af5e746](https://github.com/bwl/forest/commit/af5e746))

### Changed
- Server configuration now supports dual-stack IPv4/IPv6 via `FOREST_HOST` environment variable

## [0.2.0] - 2025-10-18

Initial tagged release with core Forest functionality.

### Added
- CLI command structure with node, edge, tag, and export operations
- Progressive UUID abbreviation (Git-style references)
- Hybrid scoring algorithm (embeddings + lexical + tags + titles)
- Interactive explore mode
- Edge management workflow (suggest, accept, reject, promote, sweep, undo)
- Tag operations (list, rename, stats)
- Export to GraphViz DOT and JSON formats
- SQLite database with sql.js (WASM)
- Local embeddings with Xenova/all-MiniLM-L6-v2
- Comprehensive test coverage

[0.6.0]: https://github.com/bwl/forest/compare/v0.4.5..v0.6.0
[0.3.1]: https://github.com/bwl/forest/compare/v0.3.0..v0.3.1
[0.3.0]: https://github.com/bwl/forest/compare/v0.2.0..v0.3.0
[0.2.0]: https://github.com/bwl/forest/releases/tag/v0.2.0
