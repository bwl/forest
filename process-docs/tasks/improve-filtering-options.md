# Task: Improve Filtering Across Commands

## Objective
Introduce richer filtering capabilities (date ranges, tag filters, score thresholds) consistently across search, explore, and listing commands.

## Key Deliverables
- Unified filtering specification covering supported operators and syntax.
- CLI enhancements implementing `--since`, `--before`, tag filters, and link score bounds.
- Shared utility functions for parsing and validating filters.
- Documentation updates with usage examples and edge cases.
- Tests ensuring filters apply correctly and combine without conflicts.

## Implementation Plan
1. **Requirements Gathering**
   - Identify target commands needing filtering improvements and existing overlaps.
2. **Design**
   - Define filtering syntax and precedence rules (e.g., ISO dates vs relative durations).
   - Decide on configuration for default ranges or global overrides.
3. **Implementation**
   - Build filter parsing helpers and integrate them into command handlers.
   - Ensure commands respect filters when fetching data from the database or search index.
4. **Testing**
   - Add unit tests for parser edge cases and integration tests for representative command invocations.
5. **Documentation**
   - Update help text, README sections, and tutorials demonstrating filters.

## Dependencies & Risks
- Requires alignment with any upcoming query language work to avoid conflicting syntax.
