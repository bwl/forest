```

    #o#
  ####o#
 #o# \#|_#,#
###\ |/   #o#        forest v0.1.0
 # {}{      #        A graph-native knowledge base CLI
    }{{
   ,'  `

  Run `forest help` for full command list

  Quick start:
    forest capture --stdin    # Capture ideas from stdin
    forest explore <term>     # Search and explore connections
    forest insights list      # Review suggested links

```

# Forest CLI

Capture unstructured ideas and stitch them into a graph-first knowledge base. Ideas are stored inside a single SQLite database (`forest.db` by default) along with auto-generated links derived from a hybrid of semantic embeddings and lexical overlap.

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
forest capture --preview-suggestions-only   # preview only the suggested edges list
forest capture --json              # emit a machine-readable capture summary (node, links, suggestions)
```

When you skip explicit `--tags`, Forest infers a handful of keywords from the title/body so that new notes still participate in tagging and link scoring. Inline `#tags` take precedence if you include them.

Link scoring:

- Scores ≥ 0.50 become accepted edges immediately.
- Scores between 0.25 and 0.50 are stored as suggestions for later review (`forest insights list`).
- Lower scores are discarded.

Adjust thresholds with environment variables:

```
export FOREST_AUTO_ACCEPT=0.6
export FOREST_SUGGESTION_THRESHOLD=0.25

### Embeddings (semantic scoring)

Forest augments lexical similarity with sentence embeddings.

- Provider selection (`FOREST_EMBED_PROVIDER`): `local` (default), `openai`, `mock`, or `none`.
- Local (offline) uses `@xenova/transformers` and downloads a compact model on first run.
- OpenAI requires `OPENAI_API_KEY` and calls the embeddings API.

Environment variables:

```
# Choose provider
export FOREST_EMBED_PROVIDER=local     # or: openai | mock | none

# Local provider (transformers.js)
export TRANSFORMERS_CACHE=.cache/transformers
export FOREST_EMBED_LOCAL_MODEL="Xenova/all-MiniLM-L6-v2"

# OpenAI provider
export OPENAI_API_KEY=...              # required if provider=openai
export FOREST_EMBED_MODEL=text-embedding-3-small
```

Backfill embeddings for existing notes and optionally rescore links:

```
npm run build
FOREST_EMBED_PROVIDER=local node dist/index.js admin:recompute-embeddings --rescore
```

Notes:

- Scores display to 3 decimals to avoid rounding confusion near thresholds.
- You can disable embeddings entirely with `FOREST_EMBED_PROVIDER=none` for fully lexical scoring.
```

JSON output (capture --json):

When you add `--json`, capture returns a machine-readable summary you can pipe into tools or scripts.

Example:

```
{
  "node": {
    "id": "f267554a-65d8-49f8-99db-2c861765cbaa",
    "title": "JSON capture demo",
    "tags": ["automation", "capture", "demo", "hook", "json"],
    "createdAt": "2025-10-18T20:26:01.358Z",
    "updatedAt": "2025-10-18T20:26:01.358Z"
  },
  "body": "Testing machine-readable summary for automation hooks.",
  "links": {
    "autoLinked": true,
    "accepted": 0,
    "suggested": 1,
    "thresholds": { "auto": 0.5, "suggest": 0.15 }
  },
  "suggestions": [
    { "id": "360c9484...::f267554a...", "score": 0.21, "otherId": "360c9484...", "otherTitle": "Testing stdin capture" }
  ]
}
```

Fields:

- `node`: id, title, tags, timestamps for the new note
- `body`: full text captured
- `links`: whether auto-linking ran, counts, thresholds used
- `suggestions`: pending suggestions for this note (edge id, score, other id/title)

### `forest explore`

Search for a note and inspect its graph neighborhood in one command. Without flags the first match is selected automatically when you provide a search term; use `--select` to choose a different result or `--include-suggestions` to show pending links. The matches list shows up to six entries by default and respects any `--search-limit` or `--limit` you pass. Run `forest explore --limit N` with no term to get a quick ranked list without focusing on a node.

```
forest explore context
forest explore --id 7178ccee --include-suggestions
forest explore "graph hygiene" --select 2 --depth 2 --limit 40
forest explore context --json

# Filters and sorting
forest explore --tag agent,context              # AND across tags
forest explore --any-tag agent,context          # OR across tags
forest explore --since 2025-10-01 --sort recent # date filters
forest explore --before 2025-09-01
forest explore --sort degree                    # order by node degree
```

Output includes scored matches, node metadata, accepted edges, and (optionally) suggested edges. Human-readable output uses short ids by default; add `--long-ids` or `--json` for full identifiers. Filters `--tag/--any-tag/--since/--before` narrow the candidate set before ranking. `--sort` can be `score` (default), `recent`, or `degree`.

### `forest read`

Retrieve the full body of a note (plus metadata) for piping to editors or agents. Add `--meta` to print only the metadata/edge overview that `forest explore` shows.

```
forest read 7178ccee
forest read fb1d5402 --meta
forest read 9b7faf2d-fa86-4e7f-a971-68f9f8078fb6 --json
```

Pass either the full UUID or a unique short id (the one shown in other commands). If you omit the argument, the command will remind you to supply an id.

JSON output (read --json):

```
{
  "node": {
    "id": "9b7faf2d-fa86-4e7f-a971-68f9f8078fb6",
    "title": "Graph hygiene checklist",
    "tags": ["graph", "checklist"],
    "createdAt": "2025-10-18T19:10:01.000Z",
    "updatedAt": "2025-10-18T19:12:44.000Z"
  },
  "body": "Full note body here..."
}
```

Fields:

- `node`: id, title, tags, timestamps
- `body`: full text of the note

### `forest edit`

Update an existing note. If you don’t pass `--no-auto-link`, Forest rescored links for this note against the rest of the graph.

```
forest edit 7178ccee --title "Refined idea title"
forest edit 7178ccee --file updated.md
forest edit 7178ccee --tags research,priority
forest edit 7178ccee --stdin --no-auto-link
```

Behavior:

- Rewrites title/body/tags as provided and updates token index.
- Rescoring will upsert accepted/suggested edges and remove low-score links.

### `forest delete`

Remove a note and all of its edges.

```
forest delete 7178ccee
forest delete 9b7faf2d-fa86-4e7f-a971-68f9f8078fb6 --force
```

### `forest link`

Manually create a link between two notes.

```
forest link 7c6cc144 f4c949c1             # accept with computed score
forest link 7c6cc144 f4c949c1 --suggest   # create as suggestion
forest link 7c6cc144 f4c949c1 --score 0.3 --explain
```

Notes:

- Accepts short ids or full UUIDs for endpoints.
- When `--score` isn’t provided, a score is computed; `--explain` prints score components.

### `forest insights`

Manage suggested edges produced by auto-linking.

```
forest insights list --limit 20
forest insights list --json
forest insights promote --min-score 0.6
forest insights accept 1
forest insights accept 9b7faf2d::e70f6e2c
forest insights accept qpfs                     # accept by 4-char code
forest insights reject 2
forest insights undo qpfs                       # undo last accept/reject for this pair
forest insights explain 7c6cc144::f4c949c1 --json
forest insights sweep --max-score 0.2      # bulk-reject by score
forest insights sweep --range 1-10,15      # bulk-reject by ranked indexes
```

`forest insights list` now prints a numbered column plus a short `source::target` pair, so you can accept or reject a suggestion via its index or the composite short id. Use `--json` to feed suggestions into automated review workflows, or add `--long-ids` for full UUIDs.

JSON output (insights list --json):

```
[
  {
    "index": 1,
    "id": "510a0a7d-e287-4399-bb51-2e8e8ce856ee::e1000673-c6df-4114-bf34-69d94f6dd773",
    "shortId": "510a0a7d::e1000673",
    "code": "qpfs",
    "sourceId": "510a0a7d-e287-4399-bb51-2e8e8ce856ee",
    "targetId": "e1000673-c6df-4114-bf34-69d94f6dd773",
    "sourceTitle": "No auto-link test",
    "targetTitle": "No-auto-link check (CLI)",
    "score": 0.41,
    "metadata": { }
  }
]
```

Fields:

- `index`: rank within current list output
- `id`: full edge id (source::target UUIDs)
- `shortId`: short `source::target` pair for quick reference
- `sourceId`, `targetId`: endpoint node ids
- `sourceTitle`, `targetTitle`: endpoint titles (if available)
- `score`: suggestion score in [0,1]
- `metadata`: scoring components or future attributes

Notes:

- Each suggestion also has a stable 4-character `code` derived from its short `source::target` pair. Use this code with `insights accept/reject/explain` to avoid race conditions with list indexes.

### `forest stats`

Graph-level statistics and tag pair co-occurrence.

```
forest stats
forest stats --json --top 20
```

Shows node/edge counts, degree summary (avg/median/p90/max), top tags and top tag pairs. Degree counts only accepted edges (suggestions are not included).

JSON output (stats --json):

```
{
  "counts": { "nodes": 521, "edges": 313 },
  "degree": { "avg": 1.2, "median": 1, "p90": 3, "max": 12 },
  "tags": [ { "tag": "river", "count": 40 }, { "tag": "canal", "count": 32 } ],
  "tagPairs": [ { "pair": "river::canal", "count": 7 }, { "pair": "basin::lake", "count": 8 } ]
}
```

Degree metrics:

- avg: average number of accepted links per note
- median: 50th percentile of node degrees
- p90: 90th percentile — “hubiness” threshold
- max: maximum degree observed

### `forest tags stats`

Tag co-occurrence explorer.

```
forest tags stats --top 20
forest tags stats --tag graphs --top 10
forest tags stats --min-count 5           # filter noise tags
forest tags stats --json
```

When `--tag` is provided, shows tags that most frequently appear with the given tag; otherwise shows global top tag pairs. Use `--min-count` to filter out low-frequency noise.

Interpreting tag pairs:

- Pairs reflect co-occurrence within the same note, not edges.
- High-count pairs suggest emerging themes or clusters worth exploring.
- Use `--min-count` to suppress accidental or rare co-occurrences.
- Combine with `forest explore --tag a,b` to browse concrete notes behind a pair.

## Recipes

Handy one-liners and workflows for common tasks.

### Bulk-accept high-confidence suggestions by code

Accept all suggestions with score ≥ 0.40 using stable 4-char codes:

```
forest insights list --json \
  | jq -r '.[] | select(.score >= 0.40) | .code' \
  | xargs -n1 forest insights accept
```

Or from doctor’s top suggestions:

```
forest doctor --json \
  | jq -r '.suggestions[] | select(.score >= 0.40) | .code' \
  | xargs -n1 forest insights accept
```

### Sweep low-confidence suggestions

```
forest insights sweep --max-score 0.15
```

### Explore notes with AND/OR tag filters and time windows

```
forest explore --tag agent,context --since 2025-10-01 --sort recent
forest explore --any-tag graph,embedding --before 2025-09-01 --limit 50
```

### Generate a Markdown report from a large neighborhood

Build a DOT graph and a Markdown summary for a big neighborhood around a node id (replace `7178ccee`):

Prerequisites: ensure `jq` and Graphviz (`dot`) are installed and on your PATH.

- macOS (Homebrew): `brew install jq graphviz`
- Debian/Ubuntu: `sudo apt-get install -y jq graphviz`
- Windows (Chocolatey): `choco install jq graphviz`

```
ID=7178ccee
DEPTH=2
LIMIT=200
OUT="neighborhood-$(date +%Y%m%d).md"

# Export Graphviz and render an image
forest export graphviz --id "$ID" --depth "$DEPTH" --limit "$LIMIT" --include-suggestions --file graph.dot
dot -Tpng graph.dot -o graph.png

# Export a JSON neighborhood and format as Markdown
forest explore --id "$ID" --depth "$DEPTH" --limit "$LIMIT" --include-suggestions --json \
  | jq -r '
    "# Neighborhood for " + .selected.title + " (" + (.selected.id | .[0:8]) + ")\n\n" +
    "![Graph](graph.png)\n\n" +
    "## Nodes (" + (.neighborhood.nodes|length|tostring) + ")\n" +
    (.neighborhood.nodes | map("- " + .title + " (" + (.id | .[0:8]) + ") [" + ((.tags // []) | join(", ")) + "]") | join("\n")) + "\n\n" +
    "## Accepted Edges (" + (.neighborhood.edges|length|tostring) + ")\n" +
    (.neighborhood.edges | map("- " + (.source | .[0:8]) + " ↔ " + (.target | .[0:8]) + " score=" + (((.score // 0) | tostring))) | join("\n")) + "\n\n" +
    "## Suggestions\n" +
    ((.suggestions // []) | map("- " + .otherTitle + " (" + (.otherId | .[0:8]) + ") score=" + ((.score // 0) | tostring)) | join("\n"))
  ' > "$OUT"

echo "Wrote $OUT and graph.png"
```

Resulting Markdown includes a rendered graph image and bullet lists for nodes, accepted edges, and suggestions.

### Rename tags in bulk

```
forest tags rename old-tag new-tag
```

### Inspect tag clusters and then browse concrete notes

```
forest tags stats --min-count 5 --top 20
# Then pick a pair (e.g., agent + context) and browse
forest explore --tag agent,context --sort degree --limit 40
```

`insights explain` prints component-level scores used to form the total, and supports `--json`.

### `forest tags`

Basic tag management.

```
forest tags list --top 20
forest tags list --json
forest tags rename old-tag new-tag
```

### `forest export graphviz`

Export a Graphviz DOT of a node’s neighborhood for quick visualization.

```
forest export graphviz --id 7178ccee --depth 2 --limit 50 --include-suggestions --file out.dot
```

Render with Graphviz: `dot -Tpng out.dot -o out.png`.

### `forest export json`

Export all notes and edges as JSON for backup or analysis.

```
forest export json --file forest-export.json
forest export json --no-body          # omit bodies
forest export json --no-edges         # omit edges
```


### `forest doctor`

View a snapshot of graph health: node/edge counts, recent captures, high-degree notes, and the top pending suggestions.

```
forest doctor
forest doctor --json
```

JSON output (doctor --json):

```
{
  "counts": { "nodes": 42, "edgesAccepted": 21, "edgesSuggested": 71 },
  "recent": [
    {
      "id": "e1000673-c6df-4114-bf34-69d94f6dd773",
      "title": "No-auto-link check (CLI)",
      "tags": ["auto", "check", "cli", "flag", "link"],
      "updatedAt": "2025-10-18T20:16:10.079Z"
    }
  ],
  "highDegree": [
    { "id": "9b7faf2d-fa86-4e7f-a971-68f9f8078fb6", "title": "Graph context aggregator", "degree": 6 }
  ],
  "suggestions": [
    {
      "index": 1,
      "id": "510a0a7d-e287-4399-bb51-2e8e8ce856ee::e1000673-c6df-4114-bf34-69d94f6dd773",
      "shortId": "510a0a7d::e1000673",
      "code": "qpfs",
      "score": 0.41,
      "sourceId": "510a0a7d-e287-4399-bb51-2e8e8ce856ee",
      "targetId": "e1000673-c6df-4114-bf34-69d94f6dd773",
      "sourceTitle": "No auto-link test",
      "targetTitle": "No-auto-link check (CLI)"
    }
  ]
}
```

Fields:

- `counts`: node and edge totals
- `recent`: latest updated notes (id, title, tags, updatedAt)
- `highDegree`: highest-degree nodes (id, title, degree)
- `suggestions`: top pending suggestions (index, ids/titles, score)

## Data model

- `nodes`: captured ideas with token frequencies and tag lists.
- `edges`: undirected relationships scored on tag overlap, token cosine similarity, and title similarity.
- `metadata`: reserved for future high-level settings.

`forest.db` is updated after each mutation; the database can be synced or versioned as a single artifact.
