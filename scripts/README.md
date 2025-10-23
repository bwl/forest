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

## License

These scripts are part of the Forest project.
