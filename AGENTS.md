# Repository Guidelines

## Project Structure & Module Organization
- `src/index.ts` stitches together the CLI, orchestrating capture, explore, and linking commands.
- `src/lib/` contains focused modules: `db.ts` wraps sql.js persistence, `graph.ts` builds graphology structures, `scoring.ts` maintains suggestion heuristics, and `text.ts` handles tokenization and tagging.
- `dist/` is generated output from TypeScript; rebuild instead of editing files here.
- `docs/` hosts design notes such as `cli-surface-proposal.md`; keep long-form discussions and ADR-style writeups here.
- `forest.db` is a sample database for local smoke tests; feel free to reset it when experimenting.

## Build, Test, and Development Commands
- `bun run build` compiles TypeScript to `dist/` with the repo tsconfig.
- `bun run dev` executes the CLI through `tsx`, ideal for iterating on commands without compiling.
- `bun run lint` runs `tsc --noEmit` for type safety; treat failures as blockers.
- `bun run start` runs the compiled CLI (`bun run dist/index.js`); use it when verifying release artifacts.

## Coding Style & Naming Conventions
- Follow the existing 2-space indentation, single quotes, and trailing commas where they clarify multi-line structures.
- Favor small, pure functions; keep modules under `src/lib/` single-purpose and export named functions instead of default exports.
- Use lowerCamelCase for variables/functions, PascalCase for types, and kebab-case for new file names.

## Testing Guidelines
- There is no automated test suite yet; for new features, add targeted TypeScript tests alongside the code (e.g., `src/lib/__tests__/graph.spec.ts`) using `tsx` or `ts-node`.
- Cover edge cases around scoring thresholds, tag extraction, and graph linking; include fixtures under a nearby `fixtures/` folder if needed.
- Run `bun run dev -- capture --body "example"` against a fresh `forest.db` to perform smoke tests before submitting.

## Commit & Pull Request Guidelines
- Write concise, imperative commit subjects (e.g., “Add capture preview summary”), mirroring the existing history.
- Group related changes per commit and mention the affected module path in the body when context helps reviewers.
- In pull requests, link related issues, summarize behavior changes, note manual test commands, and include CLI output snippets or screenshots when UI-facing functionality changes.
