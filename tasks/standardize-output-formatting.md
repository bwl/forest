# Task: Standardize Global Output Formatting Options

## Objective
Introduce consistent global flags for output format and destination (e.g., `--format`, `--output`) to replace ad-hoc options like `--json`.

## Key Deliverables
- Specification for supported formats (json, ndjson, table, yaml) and file output behavior.
- CLI framework updates to register global flags and propagate them to commands.
- Refactored command implementations honoring the centralized formatting logic.
- Documentation and examples demonstrating the new flags.
- Tests ensuring format conversions and file output work as expected.

## Implementation Plan
1. **Design**
   - Audit existing commands using custom output flags.
   - Define priority rules when commands also expose format-specific options.
2. **Implementation**
   - Extend the CLI bootstrap to parse global flags and provide a formatter utility.
   - Update individual commands to consume the formatter rather than bespoke logic.
3. **Migration Support**
   - Provide compatibility layer or deprecation warnings for legacy flags.
4. **Testing**
   - Add unit tests for the formatter utility and integration tests covering multiple commands.
5. **Documentation**
   - Update help text and docs to promote the new global flags and note deprecations.

## Dependencies & Risks
- Needs coordination with pagination/streaming work to avoid conflicting format implementations.
