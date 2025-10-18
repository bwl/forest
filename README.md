# Forest CLI

Capture unstructured ideas and stitch them into a graph-first knowledge base. Ideas are stored inside a single SQLite database (`forest.db` by default) along with auto-generated links derived from tags and lexical overlap.

## Install & build

```bash
npm install
npm run build
```

Invoke the CLI directly with `npx` or from the compiled output:

```bash
npx forest capture --stdin < my-idea.txt
forest explore context --include-suggestions
forest read 7178ccee --json
```

Set `FOREST_DB_PATH` to relocate the backing SQLite file.

## Commands

### `forest capture`

Add a new idea and automatically link it to related notes. By default a preview runs through `forest explore` so you can see where the idea landed.

```
forest capture --title "Named Idea" --body "Free-form text with #tags and more context."
forest capture --stdin < note.md
forest capture --file captured.md --tags focus,ops
forest capture --no-preview        # skip the post-capture explore view
forest capture --no-auto-link      # store the note without scoring links
```

When you skip explicit `--tags`, Forest infers a handful of keywords from the title/body so that new notes still participate in tagging and link scoring. Inline `#tags` take precedence if you include them.

Link scoring:

- Scores ≥ 0.50 become accepted edges immediately.
- Scores between 0.15 and 0.50 are stored as suggestions for later review (`forest insights list`).
- Lower scores are discarded.

Adjust thresholds with environment variables:

```
export FOREST_AUTO_ACCEPT=0.6
export FOREST_SUGGESTION_THRESHOLD=0.2
```

### `forest explore`

Search for a note and inspect its graph neighborhood in one command. Without flags the first match is selected automatically when you provide a search term; use `--select` to choose a different result or `--include-suggestions` to show pending links. The matches list shows up to six entries by default and respects any `--search-limit` or `--limit` you pass. Run `forest explore --limit N` with no term to get a quick ranked list without focusing on a node.

```
forest explore context
forest explore --id 7178ccee --include-suggestions
forest explore "graph hygiene" --select 2 --depth 2 --limit 40
forest explore context --json
```

Output includes scored matches, node metadata, accepted edges, and (optionally) suggested edges. Human-readable output uses short ids by default; add `--long-ids` or `--json` for full identifiers.

### `forest read`

Retrieve the full body of a note (plus metadata) for piping to editors or agents. Add `--meta` to print only the metadata/edge overview that `forest explore` shows.

```
forest read 7178ccee
forest read fb1d5402 --meta
forest read 9b7faf2d-fa86-4e7f-a971-68f9f8078fb6 --json
```

Pass either the full UUID or a unique short id (the one shown in other commands). If you omit the argument, the command will remind you to supply an id.

### `forest insights`

Manage suggested edges produced by auto-linking.

```
forest insights list --limit 20
forest insights list --json
forest insights promote --min-score 0.6
forest insights accept 1
forest insights accept 9b7faf2d::e70f6e2c
forest insights reject 2
```

`forest insights list` now prints a numbered column plus a short `source::target` pair, so you can accept or reject a suggestion via its index or the composite short id. Use `--json` to feed suggestions into automated review workflows, or add `--long-ids` for full UUIDs.

### `forest doctor`

View a snapshot of graph health: node/edge counts, recent captures, high-degree notes, and the top pending suggestions.

```
forest doctor
forest doctor --json
```

## Data model

- `nodes`: captured ideas with token frequencies and tag lists.
- `edges`: undirected relationships scored on tag overlap, token cosine similarity, and title similarity.
- `metadata`: reserved for future high-level settings.

`forest.db` is updated after each mutation; the database can be synced or versioned as a single artifact.
