# Forest CLI Surface Proposal

## Background

Forest exists to:

- Capture unstructured ideas quickly (`forest capture` today / `ingest` currently).
- Maintain a graph-native knowledge base that agents can query without huge text dumps.
- Surface actionable context for people and agents (neighbourhoods, suggestions, exports).

The workflow should let a person or agent drop in an idea, understand where it sits in the graph, and retrieve relevant context with minimal friction.

## Design principles

1. **Graph-first mindset** — Every command should expose how ideas connect (neighbors, scores, recency) instead of just dumping text.
2. **Single-command journeys** — Each user intent (capture, explore, manage links, overview, export) gets one obvious entry point with progressive detail/flags.
3. **Agent parity** — Every human-facing command has a `--json` mode with a stable schema so agents and scripts can consume the same surface.
4. **Learnable IDs** — Short IDs and optional slugs keep the workflow memorisable without sacrificing uniqueness.

These principles replace the current overlap between `nodes` and `query` and highlight actionable next steps after each output.

## Current journeys and pain points

| Journey | Commands today | Notes |
| --- | --- | --- |
| Add an idea | `forest ingest --title/--body/--stdin` | Tokenizes, tags, stores, auto-links. |
| Inspect what exists | `forest nodes [term]` | Returns scored list with short IDs. |
| Dive into context | `forest query <term>` | Pulls neighbourhood around chosen node. |
| Manage edges | `forest suggestions list/promote/reject` | Handles pending links. |

### Key observations

- `nodes` vs `query` both perform search + selection, but with differing outputs and no clear guidance on which to use first.
- Users bounce between `nodes` (to find IDs) and `query` (to view relationships) for almost every question.
- Suggestions are hidden behind `suggestions list`; ingest is the only time you see auto-link results.
- There's no "what changed" dashboard—post-ingest you must run multiple commands to orient yourself.
- Positional arguments behave differently between commands, adding cognitive overhead.

This proposal folds those journeys into a single `explore` experience and gives suggestions/status their own obvious homes.

## Command taxonomy overview

```
forest capture     # Add ideas (current `ingest`)
forest explore     # Search + graph view combined (replaces `nodes` + `query`)
forest insights    # Manage auto-link suggestions (current `suggestions`)
forest doctor      # Dashboard/status (new)
forest read        # Show full node content
forest export      # Emit graph data (future hook, optional now)
forest admin       # DB maintenance (vacuum, integrity checks) [later]
```

### Shared global flags (available for all commands)

- `--db <path>` (alias for `FOREST_DB_PATH`) – switch databases ad-hoc.
- `--json` – machine-friendly output; default text otherwise.
- `--long-ids` – display full IDs in text mode.
- `--quiet` – suppress informational logs (for scripting).

## Command specs

### 1. `forest capture`

**Purpose:** Rapid idea capture with immediate graph feedback.

```
forest capture --title "Idea" --body "..."
forest capture --stdin < note.md
forest capture --file note.md --tags focus,ops (optional override)
```

**Flow:**

1. Normalise text (title heuristics, tags, tokens).
2. Insert node, score against existing graph.
3. Upsert edges (accepted/suggested based on thresholds).
4. Print summary: short id, tags, link counts, top three accepted/suggested edges with scores.
5. Optional: run `explore` preview automatically unless `--no-preview` is passed.

**Flags:**

- `--stdin`, `--file`, `--body`, `--title`, `--tags`, `--no-auto-link` (skip suggestions).
- `--auto-preview/--no-preview` controls the step into `explore`.
- `--json` returns `{node, acceptedEdges[], suggestedEdges[]}`.

### 2. `forest explore`

**Purpose:** Single entry point to search and inspect a node’s neighborhood.

```
forest explore context
forest explore 7178ccee
forest explore --id <uuid>
forest explore --json 'context heuristics'
```

**Interactive text flow (default):**

1. **Search stage:** show scored matches ordered by similarity (shared scoring currently used in `nodes`). Each entry lists: `score shortId title [tags] updatedAt`.
2. If multiple matches and user passed a search term, prompt: "Pick a node [1-5] or 0 to cancel". Provide `--select <n>` for non-interactive automation.
3. **Graph stage:** display summary for chosen node:
   - Header: `shortId Title [tags] (score if from search)`.
   - Node metadata: created/updated timestamps, token/tag counts.
   - Accepted edges table (`score shortId title`, include direction if we later add directed edges).
   - Suggested edges (if any) with inline actions `forest insights promote --id` hints.
   - Optional `--depth`, `--limit`, and `--include-suggestions` flags to shape the neighborhood.
4. Provide quick action hints: `--json`, `--export gexf`, `--open <path>` if we integrate editor hooks.

**Flags:**

- `--depth`, `--limit` – same semantics as current `query`.
- `--select <n>` – auto-pick nth result from search (for scripts/tests).
- `--include-suggestions` – add suggested edges in graph view.
- `--json` – respond `{ node, scores, neighborhood, suggestions }`.
- `--similar <k>` – optionally include `k` top similar nodes not directly linked (future extension).
- `--no-interactive` – skip prompts; default to first match (like current behavior) but still print alternatives to stderr.

### 3. `forest insights`

**Purpose:** Manage suggested edges in one place.

```
forest insights list --limit 20
forest insights promote --min-score 0.6
forest insights reject <edge-id>
forest insights accept <edge-id>
```

**Changes from current `suggestions`:**

- `list` sorts by score and prints source/destination in the new `score shortId title` format.
- Add `accept` alias for `promote` targeting a single id.
- Provide `--json` output to feed into agent auto-review loops.
- Integrate with `explore` (the command should cross-reference pending edges for displayed node).

### 4. `forest doctor`

**Purpose:** System dashboard summarising state.

```
forest doctor
forest doctor --json
```

**Sections (text mode):**

- Totals: nodes, accepted edges, suggested edges, time since last capture.
- Recent captures (top 5 by updatedAt) with short IDs.
- High-impact nodes (top degree or centrality) with counts.
- Pending work: count + top suggestions.
- Reminder of next actions (e.g., `forest insights list`, `forest export gexf`).

**JSON schema:**

```
{
  "counts": {"nodes": number, "edgesAccepted": number, "edgesSuggested": number},
  "recent": [{id, title, updatedAt, tags}],
  "highDegree": [{id, title, degree}],
  "suggestions": [{edgeId, sourceId, targetId, score}]
}
```

### 5. `forest read`

**Purpose:** View the complete content of a node without diving into the database manually.

```
forest read 7178ccee
forest read --id <uuid>
forest read --json context heuristics
forest read context --select 2
```

**Behavior:**

- Mirrors the search stage of `forest explore` to resolve the target node by term/short id.
- Prints full body text with optional metadata header (title, tags, timestamps).
- Supports piping to editors or other tooling (`forest read id > note.md`).
- When used with `--json`, returns `{ node: {…}, body: string }` so agents get direct access.

**Flags:**

- `--select <n>` (choose nth match, same semantics as `explore`).
- `--id`, `--title` pass-through like other commands.
- `--header-only` (future) to print metadata without body.
- `--json` for machine output.

### 6. `forest export`

**Purpose:** Export slices of the graph for external tools (Gephi, sigma.js).

```
forest export graph --format gexf --out vault.gexf
forest export neighborhood 7178ccee --depth 2 --format json
```

**Modes:**

- `graph` (full database) — default.
- `neighborhood <id>` — reuses the explore neighborhood logic for subgraphs.
- Potential `communities` (future) — run Louvain clustering and export clusters.

**Flags:**

- `--format` (gexf, graphml, json)
- `--out <file>` (default stdout)
- `--include-suggestions`
- `--json` already covers JSON output but may duplicate the `--format json` option; we can treat `--json` as shorthand.

### 6. Future/admin commands

- `forest admin vacuum` — run SQLite vacuum.
- `forest admin integrity` — basic DB checks.
- `forest tags` — summary of tag frequencies (to be considered once capture/explore settle).

## Near-term UX upgrades

These improvements can accompany the new surface or land incrementally ahead of it:

1. **Consistent score context** – Show similarity scores inside `forest explore`'s neighborhood output (and future `read` metadata) to match the search stage.
2. **Post-capture preview** – After `forest capture`, run an `explore` preview automatically (with `--no-preview` to opt out) so users immediately see where the idea landed.
3. **Suggestion nudges** – When pending suggestions exceed a threshold, surface a reminder inside `capture`/`explore` outputs to visit `forest insights`.
4. **Top-level snapshot** – Prioritise `forest doctor` to report node/edge counts, recent captures, and pending work so the graph always feels alive.

## Migration plan

We have no public users yet, so we can cut over aggressively:

1. Build `forest explore` and remove the legacy `nodes` + `query` commands.
2. Strip legacy help text/completions that reference `nodes`/`query`.
3. Update documentation, shell completions, and agent tool definitions to the new surface.

## Open considerations

- **Prompting style:** keep flows non-interactive by default. `forest explore` should auto-select the best match unless `--interactive` is explicitly requested. No TUI—we stay agent-centric.
- **Score semantics:** unify around a single similarity metric (0–1) and label it consistently (e.g., `sim`).
- **Slugs:** low priority; short IDs are sufficient for now.
- **Config file:** optional `~/.forestrc` for defaults (auto-preview, depth) if needed later.
- **Agent feedback loop:** design a CLI path for agents to accept/reject suggestions through `forest insights` without human prompts.

## Next steps

1. Ship `forest explore` (replacing `nodes`/`query`).
2. Implement `forest read` so full note bodies are accessible.
3. Land `forest doctor`.
4. Add post-capture preview (`forest capture` → `explore`).

We’re pre-release, so the focus is on shipping the new surface rather than documenting deprecations.
