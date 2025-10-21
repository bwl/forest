# Feature Development Checklist

Use this checklist when adding new features to Forest to ensure CLI/API parity.

## Pre-Implementation

- [ ] Define feature requirements clearly
- [ ] Identify where the feature should be accessible (CLI only, API only, or both?)
- [ ] Design the core function signature and return types
- [ ] Plan error cases and validation

## Implementation Order

### 1. Core Business Logic
- [ ] Create or update function in `src/core/*.ts`
  - [ ] Function is pure (no I/O formatting, no HTTP/CLI dependencies)
  - [ ] Returns typed data structures
  - [ ] Handles all business validation
  - [ ] Includes comprehensive error handling
  - [ ] Well-documented with JSDoc comments

### 2. REST API (if applicable)
- [ ] Create or update route in `src/server/routes/*.ts`
  - [ ] Calls core function (no business logic duplication)
  - [ ] Parses and validates query parameters/request body
  - [ ] Uses helper functions from `src/server/utils/helpers.ts`
  - [ ] Returns standard envelope format via `createSuccessResponse()`
  - [ ] Handles errors with `ForestError` classes
  - [ ] Sets appropriate HTTP status codes
  - [ ] Includes Swagger/OpenAPI documentation tags
- [ ] Register route in `src/server/index.ts`
  - [ ] Import route module
  - [ ] Add `.use()` call to app
  - [ ] Add tag to Swagger documentation config

### 3. CLI Command (if applicable)
- [ ] Create or update command in `src/cli/commands/*.ts`
  - [ ] Calls core function (no business logic duplication)
  - [ ] Parses command-line arguments and flags
  - [ ] Provides human-readable text output (default)
  - [ ] Provides machine-readable JSON output (with `--json` flag)
  - [ ] Uses utilities from `src/cli/shared/utils.ts`
  - [ ] Handles errors with `handleError()`
- [ ] Register command in `src/cli/index.ts`
  - [ ] Import command factory
  - [ ] Call `cli.command(createYourCommand(clerc))`

### 4. Documentation
- [ ] Update `CLAUDE.md`
  - [ ] Add command to command structure list (if new command)
  - [ ] Document any new patterns or utilities
  - [ ] Update examples if needed
- [ ] Update README.md (if user-facing)
- [ ] Add inline code comments for complex logic

### 5. Testing
- [ ] Test core function independently
  - [ ] Happy path with valid inputs
  - [ ] Error cases and edge cases
  - [ ] Boundary conditions
- [ ] Test API endpoint (if applicable)
  - [ ] Valid requests return expected responses
  - [ ] Invalid requests return appropriate errors
  - [ ] Pagination works correctly (if applicable)
  - [ ] Filtering works correctly (if applicable)
  - [ ] Response format matches standard envelope
- [ ] Test CLI command (if applicable)
  - [ ] Valid arguments produce expected output
  - [ ] Invalid arguments show helpful errors
  - [ ] Both text and JSON output formats work
  - [ ] Help text is clear and accurate

### 6. Validation
- [ ] CLI and API produce identical results for equivalent inputs
- [ ] Error messages are consistent between CLI and API
- [ ] Feature behavior is documented
- [ ] No duplicate business logic between layers

## Architecture Compliance

### ✅ Good Patterns
- Core function contains all business logic
- CLI command calls core function, only handles formatting
- API route calls core function, only handles HTTP concerns
- Validation happens in both route/command AND core function
- Errors use typed error classes (`ForestError` hierarchy)

### ❌ Anti-Patterns to Avoid
- Business logic implemented in CLI command or API route
- Different validation logic in CLI vs API
- Different error handling in CLI vs API
- Direct database access from routes/commands (should go through core)
- Copy-pasted code between CLI and API

## Example: Semantic Search Feature

**Core Function** (`src/core/search.ts`):
```typescript
export async function semanticSearchCore(
  query: string,
  options: SemanticSearchOptions = {},
): Promise<SemanticSearchResult>
```

**API Route** (`src/server/routes/search.ts`):
```typescript
app.get('/api/v1/search/semantic', async ({ query }) => {
  const result = await semanticSearchCore(query.q, { ... });
  return createSuccessResponse({ nodes: result.nodes, ... });
});
```

**CLI Command** (`src/cli/commands/search.ts`):
```typescript
export function createSearchCommand(clerc) {
  return clerc.defineCommand({ name: 'search' }, async ({ flags }) => {
    const result = await semanticSearchCore(flags.query, { ... });
    printTextResults(result); // or JSON.stringify for --json
  });
}
```

## Notes

- If a feature only makes sense in one interface (CLI or API), that's okay! Not everything needs to be in both.
- When in doubt, put logic in the core layer. It's easier to extract than to consolidate later.
- Keep the API and CLI in sync by always implementing both at the same time when appropriate.
