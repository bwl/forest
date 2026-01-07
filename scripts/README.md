# TLDR Documentation Generator Scripts

Three implementations of a universal TLDR v0.1 documentation generator, each with different strengths and output formats.

## Overview

All scripts work with **any** CLI that implements the TLDR v0.1 standard (not just Forest). They validate compliance, generate documentation, and analyze command structures.

## Scripts

### 1. `tldr-doc-gen.sh` (Bash)
**Focus**: Simple, portable, human-readable output

**Output**:
- `<cli>_tldr.txt` - Complete ASCII documentation

**Usage**:
```bash
./tldr-doc-gen.sh forest
./tldr-doc-gen.sh forest --validate
```

**Features**:
- ✅ Comprehensive validation with colored output
- ✅ Command categorization by namespace
- ✅ Single text file output
- ✅ No dependencies (pure bash)
- ✅ Works on any UNIX-like system

---

### 2. `tldr-doc-gen.js` (Node.js)
**Focus**: Multi-format output, dependency analysis, developer-friendly

**Output**:
- `<cli>_tldr.txt` - Human-readable ASCII
- `<cli>_tldr.md` - Markdown with auto-generated TOC
- `<cli>_tldr.json` - Structured JSON with embedded analytics

**Usage**:
```bash
./tldr-doc-gen.js forest
./tldr-doc-gen.js forest --validate
node tldr-doc-gen.js forest  # Alternative
```

**Features**:
- ✅ Three output formats (TXT, MD, JSON)
- ✅ Dependency graph analysis (from RELATED fields)
- ✅ Command categorization by namespace
- ✅ Flag type distribution analysis
- ✅ Markdown with clickable TOC
- ✅ Structured JSON for programmatic access
- ✅ Detailed validation with error reporting

**Example outputs**:
- `forest_tldr.txt` - 13KB ASCII documentation
- `forest_tldr.md` - 13KB Markdown with navigation
- `forest_tldr.json` - 32KB structured data with analytics

---

### 3. `tldr-doc-gen.py` (Python)
**Focus**: Data analysis, statistics, visual reporting

**Output**:
- `<cli>_tldr_analytics.json` - Structured JSON with embedded analytics
- `<cli>_tldr_report.html` - Optional visual HTML report

**Usage**:
```bash
./tldr-doc-gen.py forest
./tldr-doc-gen.py forest --validate
./tldr-doc-gen.py forest --analyze  # Print analytics to console
./tldr-doc-gen.py forest --html     # Generate HTML report
```

**Features**:
- ✅ Advanced analytics and metrics
- ✅ Coverage analysis (commands with examples, schemas, etc.)
- ✅ Flag type distribution
- ✅ Command hierarchy visualization
- ✅ Dependency graph with centrality calculation
- ✅ Beautiful HTML report with charts and metrics
- ✅ Console analytics mode for quick insights
- ✅ Python-native for data science workflows

**Analytics includes**:
- Total commands and namespace distribution
- Flag type distribution and averages
- Coverage metrics (% with examples, schemas, etc.)
- Most connected commands (centrality analysis)
- Dependency graph (incoming/outgoing edges)

**Example outputs**:
- `forest_tldr_analytics.json` - 23KB JSON with analytics
- `forest_tldr_report.html` - 10KB visual report

---

## Comparison Table

| Feature | Bash | Node.js | Python |
|---------|------|---------|--------|
| Text output | ✅ | ✅ | ❌ |
| Markdown output | ❌ | ✅ | ❌ |
| JSON output | ❌ | ✅ | ✅ |
| HTML output | ❌ | ❌ | ✅ |
| Validation | ✅ | ✅ | ✅ |
| Dependency graph | ❌ | ✅ | ✅ |
| Flag analysis | ❌ | ✅ | ✅ |
| Coverage metrics | ❌ | ❌ | ✅ |
| Analytics console | ❌ | ❌ | ✅ |
| No dependencies | ✅ | ❌ | ❌ |
| Cross-platform | ✅ | ✅ | ✅ |

## Choosing a Script

**Use `tldr-doc-gen.sh` when**:
- You want simple, portable, human-readable output
- You need to work in environments without Node.js/Python
- You're generating docs for manual reading

**Use `tldr-doc-gen.js` when**:
- You need multiple output formats (TXT, MD, JSON)
- You want structured data for programmatic access
- You're integrating with JavaScript/Node.js tools
- You want Markdown with navigation for wikis/docs sites

**Use `tldr-doc-gen.py` when**:
- You need advanced analytics and metrics
- You want visual HTML reports for stakeholders
- You're doing data analysis on CLI design
- You want to track documentation coverage
- You're integrating with Python data science workflows

## Examples

### Generate all formats
```bash
# Bash: Human-readable text only
./tldr-doc-gen.sh forest

# Node.js: Text, Markdown, and JSON
./tldr-doc-gen.js forest

# Python: JSON analytics and HTML report
./tldr-doc-gen.py forest --html
```

### Validation
```bash
# All scripts support validation
./tldr-doc-gen.sh forest --validate
./tldr-doc-gen.js forest --validate
./tldr-doc-gen.py forest --validate
```

### Analytics
```bash
# Python: Print analytics to console
./tldr-doc-gen.py forest --analyze

# Output:
# ==================================================
# ANALYTICS REPORT
# ==================================================
# 
# Total Commands: 18
# 
# Command Hierarchy:
#   top-level: 11 commands
#   edges: 3 commands
#   tags: 2 commands
#   export: 2 commands
# 
# Flag Type Distribution:
#   BOOL: 17
#   INT: 10
#   STR: 6
#   FLOAT: 3
#   FILE: 1
#   LIST: 1
# ...
```

## TLDR v0.1 Standard

All scripts work with any CLI implementing the TLDR v0.1 standard:

**Global index** (`<cli> --tldr`):
```
NAME: forest
VERSION: 0.2.0
SUMMARY: Graph-native knowledge base CLI
COMMANDS: capture,explore,search,stats,health,...
TLDR_CALL: forest <command> --tldr
```

**Command details** (`<cli> <command> --tldr`):
```
CMD: capture
PURPOSE: Create a new note and optionally auto-link into the graph
INPUTS: ARGS(title,body,tags),STDIN,FILE
OUTPUTS: node record,edges summary,optional preview
SIDE_EFFECTS: writes to SQLite DB,computes embeddings,creates/updates edges
FLAGS: --title=STR|note title;--body=STR|note body;...
EXAMPLES: forest capture --title "Idea" --body "Text"|...
RELATED: explore,edges.propose,node.read
SCHEMA_JSON: emits {"node":{"id":STR,...},...}
```

---

## Environment Validation

### `forest-preflight.js` - Environment Check

**Purpose**: Comprehensive environment validation before setting up Forest

**Usage**:
```bash
# Basic check (local SQLite)
node scripts/forest-preflight.js

# Check remote database connectivity
node scripts/forest-preflight.js --remote

# Verbose output (show all checks)
node scripts/forest-preflight.js --verbose
```

**What it checks**:
- Core dependencies (Node.js, npm/Bun, Git)
- Filesystem permissions and disk space
- SQLite support (sql.js)
- Environment variables (FOREST_*)
- Remote PostgreSQL connectivity (optional)
- OpenAI API key (if configured)

**When to use**:
- First time setting up Forest
- Onboarding new team members
- Troubleshooting environment issues
- Before deploying to new environment
- In CI/CD pipelines

**Documentation**: See [PREFLIGHT_CHECK.md](../docs/PREFLIGHT_CHECK.md) for detailed guide

**Example output**:
```
Forest Environment Preflight Check

━━━ Core Dependencies ━━━

✓ Node.js Version
  Found Node.js 18.17.0

✓ Bun
  Found Bun 1.0.14

━━━ Summary ━━━

✓ Passed:  6
✗ Failed:  0
⚠ Warnings: 0

✓ Environment is ready for Forest!
```

---

## Bulk Import

### `bulk-import.sh` - Populate Forest with Large Corpora

**Purpose**: Bulk import documents from Project Gutenberg and other sources for testing/development

**Usage**:
```bash
# Quick test (5 Shakespeare plays)
./bulk-import.sh test

# All Shakespeare plays
./bulk-import.sh shakespeare individual

# Shakespeare Complete Works (single chunked document)
./bulk-import.sh shakespeare complete

# Top 50 classic books from Project Gutenberg
./bulk-import.sh classics 50
```

**Data Sources:**

1. **Shakespeare** (`data-sources/shakespeare.sh`)
   - All 37 plays (tragedies, comedies, histories)
   - Poems (Venus and Adonis, The Rape of Lucrece)
   - Downloaded from Project Gutenberg
   - ~400-600 nodes when imported individually

2. **Classic Literature** (`data-sources/classics.sh`)
   - Top Project Gutenberg books by popularity
   - Gothic/Horror: Frankenstein, Dracula, Dorian Gray
   - Romance: Pride and Prejudice, Jane Eyre, Emma
   - Mystery: Sherlock Holmes, Count of Monte Cristo
   - Adventure: Moby Dick, Tom Sawyer, Huckleberry Finn
   - Philosophy: The Republic, The Prince, Walden
   - Epic: War and Peace, Les Misérables

**Features:**
- ✅ Automatic downloading from Project Gutenberg
- ✅ Cleans PG headers/footers
- ✅ Chunking by headers (chapters/sections)
- ✅ Semantic auto-linking between chunks
- ✅ Progress tracking
- ✅ Retry logic for downloads
- ✅ Configurable embedding provider

**Environment Variables:**
```bash
# Use mock embeddings for faster testing
FOREST_EMBED_PROVIDER=mock ./bulk-import.sh test

# Use OpenRouter embeddings
FOREST_EMBED_PROVIDER=openrouter FOREST_OR_KEY=... ./bulk-import.sh shakespeare individual

# Use OpenAI embeddings
FOREST_EMBED_PROVIDER=openai OPENAI_API_KEY=sk-... ./bulk-import.sh classics 20
```

**Shared Utilities** (`import-helpers.sh`):
- `download_file()` - Download with retry logic
- `clean_gutenberg_text()` - Remove PG boilerplate
- `import_document()` - Call forest node import
- `show_progress()` - Visual progress bars
- Colored logging (info, success, warning, error)

**Performance Notes:**
- **Mock embeddings**: ~1-2 seconds per document (testing only)
- **OpenRouter embeddings**: API latency + rate limits
- **OpenAI embeddings**: ~2-3 seconds per chunk (API latency)

**Recommendations:**
- Use `test` mode first to verify everything works
- Use `mock` provider for quick database population
- Use `openrouter`/`openai` providers for realistic semantic links
- Large imports can take hours with API embeddings

**Examples:**

```bash
# Quick test dataset (5 plays, mock embeddings)
FOREST_EMBED_PROVIDER=mock ./bulk-import.sh test

# Medium import (10 plays + 10 books, ~1 hour)
./bulk-import.sh shakespeare individual 10
./bulk-import.sh classics 10

# Large import (all Shakespeare + 50 classics, ~3-4 hours)
./bulk-import.sh shakespeare individual
./bulk-import.sh classics 50

# Verify import
forest stats
forest node recent
forest search "to be or not to be"
```

**Adding New Data Sources:**

Create `data-sources/your-source.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../import-helpers.sh"

import_your_data() {
  local limit="${1:-10}"
  log_info "Importing your data..."

  local tmpdir=$(create_temp_dir "your-source")
  download_file "https://example.com/data.txt" "$tmpdir/data.txt"
  import_document "$tmpdir/data.txt" "Document Title" "tag1,tag2"

  rm -rf "$tmpdir"
  log_success "Import complete"
}

if [ "${BASH_SOURCE[0]}" -ef "$0" ]; then
  import_your_data "$@"
fi
```

Then add a case to `bulk-import.sh` main function.

---

## License

These scripts are part of the Forest project.
