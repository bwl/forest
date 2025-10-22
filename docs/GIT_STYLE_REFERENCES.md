# Git-Style References in Forest

This document describes the Git-inspired UX improvements implemented in Forest for working with node and edge IDs.

## Overview

Forest now embraces Git's approach to short hashes with **progressive abbreviation** and **flexible reference types**, making the CLI more ergonomic while maintaining full backward compatibility.

## Key Principles (from Git)

### 1. Display ≠ Acceptance

**What Git does:**
```bash
$ git log --oneline
7fa7acb Bump version     # Shows 7 chars today

$ git show 7fa7acb        # 7 chars ✅
$ git show 7fa7acb2       # 8 chars ✅
$ git show 7fa7acb2d      # 9 chars ✅ - all work!
```

**What Forest now does:**
```bash
$ forest explore
  ID      TITLE
  7fa7    Optimize UUIDs     # Shows 4-7 chars (enough for uniqueness)

$ forest node read 7fa7                              # 4 chars ✅
$ forest node read 7fa7acb2                          # 8 chars ✅
$ forest node read 7fa7acb2-ed4a-4f3b-9c1e-...       # full UUID ✅
```

**Backward compatibility:** All existing 8-char references in docs, scripts, and bookmarks continue to work!

### 2. Progressive Abbreviation

Forest displays the **shortest unique prefix** needed to avoid collisions:

- **Small graph (10 nodes):** Likely shows 4-5 char IDs
- **Medium graph (100 nodes):** Likely shows 5-6 char IDs
- **Large graph (1000+ nodes):** May need 7-8 char IDs

This scales gracefully as your knowledge base grows, just like Git scales from small repos to the Linux kernel.

### 3. Multiple Reference Types

Git accepts commits via:
- SHA hashes: `7fa7acb`
- Branches: `main`, `feature/foo`
- Tags: `v1.0.0`
- Symbolic refs: `HEAD`, `@{-1}`
- Relative refs: `HEAD~3`, `main^2`

Forest now accepts nodes via:
- **UUID prefixes:** `7fa7acb2` (any length)
- **Recency refs:** `@`, `@1`, `@2` (last updated nodes)
- **Tag search:** `#typescript` (finds node tagged 'typescript')
- **Title search:** `"API design"` (finds node with matching title)

All resolved through a unified function (`resolveNodeReference()`) that tries each pattern in order.

## Implementation Details

### Progressive Node IDs

**File:** `src/lib/progressive-id.ts`

```typescript
// Generate minimal unique prefix for a node
getNodePrefix(nodeId, allNodeIds, minLength = 4): string

// Build map of all nodes to their minimal prefixes
buildNodePrefixMap(nodeIds, minLength = 4): Map<string, string>

// Normalize UUID (remove dashes, lowercase)
normalizeNodeId(nodeId): string
```

**Display:**
```typescript
// Old way (fixed 8 chars)
formatId(id) → "7fa7acb2"

// New way (variable, 4-8+ chars)
formatNodeIdProgressive(id, allNodes) → "7fa7" or "7fa7a" if collision
```

### Unified Reference Resolution

**File:** `src/cli/shared/utils.ts`

```typescript
resolveNodeReference(ref: string): Promise<NodeRecord | null>
```

**Resolution order:**
1. If starts with `@` → recency reference (`@`, `@0`, `@1`, etc.)
2. If starts with `#` → tag search (`#typescript`)
3. If quoted → title search (`"API design"`)
4. If hex chars → UUID prefix (case-insensitive, works with/without dashes)
5. Exact UUID match

### Recency References

Inspired by Git's `HEAD`, `@{-1}`, `@{upstream}`:

```bash
# Git
git show HEAD           # Last commit
git diff @{-1}          # Previous branch
git cherry-pick @{3}    # 4th recent commit

# Forest
forest node read @      # Last updated node
forest node read @1     # Second most recent
forest node link @ @2   # Link recent nodes
```

**Implementation:**
```typescript
resolveRecencyReference(ref: string): Promise<NodeRecord | null>
```

Sorts all nodes by `updatedAt` descending, returns node at index N.

### Rich Disambiguation

When a reference is ambiguous, Forest shows **all matches with context** (like Git):

```bash
$ forest node read 7fa
✖ Ambiguous ID '7fa' matches 3 nodes:
  7fa7acb2  "Optimize UUID shortcodes" (2025-10-21)
  7fa2103e  "Add progressive IDs" (2025-10-20)
  7fa8ef29  "Update scoring algorithm" (2025-10-19)

Use a longer prefix to disambiguate.
```

**Implementation:**
- Shows up to 10 matches sorted by recency
- Displays: short ID (8 chars), title, date
- Clear action: "Use a longer prefix"

Similar for tag/title searches - shows matching nodes with IDs for copy-paste.

### Case-Insensitive Matching

All ID resolution is case-insensitive (like Git SHAs):

```bash
forest node read 7FA7ACB2      # ✅ Same as 7fa7acb2
forest node read 7Fa7AcB2      # ✅ Same as 7fa7acb2
```

**Implementation:** All prefix matching uses `.toLowerCase()` normalization.

## Updated Commands

### Display Commands

All commands that show node IDs now use progressive abbreviation:

- **`forest explore`** - Shows minimal node prefixes in tables
- **`forest search`** - Shows minimal prefixes in results
- **`forest stats`** - Shows minimal prefixes in summaries
- **`forest edges`** - Already used progressive edge IDs, now nodes too
- **`forest node read`** - Shows minimal prefix in header

All support `--long` flag for full UUIDs when needed.

### Reference Commands

All commands that accept node refs now support all patterns:

- **`forest node read [ref]`** - Works with `@`, `#tag`, `"title"`, UUID prefix
- **`forest node edit [ref]`** - Same
- **`forest node delete [ref]`** - Same
- **`forest node link [ref1] [ref2]`** - Both refs support all patterns

## Tab Completion

Shell completion scripts in `completions/`:

**Bash** (`completions/forest.bash`):
```bash
source completions/forest.bash

forest node read @<TAB>    # Suggests @, @1, @2, @3, @4, @5
```

**Zsh** (`completions/forest.zsh`):
```bash
fpath=(path/to/forest/completions $fpath)
autoload -Uz compinit && compinit

forest node <TAB>          # Shows: read, edit, delete, link, recent, ...
```

## Documentation

**CLAUDE.md** updated with comprehensive "Git-Style Node References" section explaining:
- Display vs. Acceptance
- Reference Types
- Disambiguation
- Progressive Display
- Backward Compatibility
- Tab Completion

## Testing

**Test file:** `test-progressive-ids.js` (run with `node test-progressive-ids.js`)

Validates:
1. ✅ `normalizeNodeId` removes dashes and lowercases
2. ✅ Unique IDs get minimal 4-char prefixes
3. ✅ Colliding prefixes automatically expand to 5+ chars
4. ✅ Case-insensitive matching works
5. ✅ Backward compatibility - 8-char prefixes still resolve

## Migration Guide

**For users:**
- ✅ No action needed - all existing workflows continue working
- ✅ New shortcuts available: `@` for recent, `#tag` for tags
- ✅ Copy shorter IDs from output (4-7 chars vs 8)

**For scripts/docs:**
- ✅ Existing 8-char IDs: No changes needed
- ✅ Full UUIDs: No changes needed
- ✅ Want to future-proof? Use full UUIDs with `--long` flag

**For developers:**
- New display: Use `formatNodeIdProgressive(id, allNodes)` instead of `formatId(id)`
- New resolution: `resolveNodeReference(ref)` handles all patterns
- Progressive edges: Already working via `getEdgePrefix()`

## Future Enhancements

Inspired by Git but not yet implemented:

1. **Relative references:** `@parent`, `@linked[0]` for graph navigation
2. **Named refs:** Save commonly used queries as shortcuts
3. **Range syntax:** `@1..@5` for bulk operations
4. **Fuzzy matching:** `forest node read ~uuid` for approximate search

## Philosophy

Git taught us that good UX means:

1. **Optimize for humans** - Show short IDs, accept any length
2. **Scale gracefully** - Progressive abbreviation grows with your data
3. **Never break links** - Full backward compatibility
4. **Rich feedback** - Helpful errors with actionable suggestions
5. **Multiple entry points** - Support different mental models (@, #tag, "title")

Forest now applies these principles to knowledge management.
