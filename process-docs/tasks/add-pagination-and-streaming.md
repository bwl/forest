# Task: Add Pagination and Streaming Output Options

## Objective
Support paginated responses and streaming-friendly formats (NDJSON) across commands that return large result sets.

## Key Deliverables
- Specification for pagination parameters (`--page`, `--cursor`, page size defaults).
- Implementation of streaming output with `--format ndjson` and proper buffering.
- Updates to command handlers and data access layers to respect pagination controls.
- Documentation explaining pagination semantics and streaming usage for pipelines.
- Tests verifying pagination correctness and NDJSON formatting.

## Implementation Plan
1. **Design**
   - Determine pagination strategy (offset/limit vs cursor-based) per command.
   - Define NDJSON output schema and ensure compatibility with existing JSON output.
2. **Implementation**
   - Update database/query interfaces to accept pagination inputs.
   - Implement CLI flag parsing and response formatting.
3. **Testing**
   - Write integration tests covering multi-page navigation and streaming consumption.
   - Validate performance with large datasets to ensure responsiveness.
4. **Documentation**
   - Add docs and help examples showing pagination and NDJSON in shell pipelines.

## Dependencies & Risks
- Cursor-based pagination may require index updates or schema changes.
- Need to ensure backward compatibility with existing JSON consumers.
