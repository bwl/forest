# Task: Consolidate Stats and Health Reporting

## Objective
Combine the overlapping `stats` and `health` commands into a coherent status surface that communicates both usage metrics and system health checks.

## Key Deliverables
- Design proposal for a unified command (e.g., `forest doctor`) with sections for metrics and health diagnostics.
- Updated CLI implementation with backward-compatible aliases or deprecation notices.
- Revised documentation and help text explaining the new status command.
- Automated or manual tests confirming exit codes and output formatting for healthy vs degraded states.

## Implementation Plan
1. **Assessment**
   - Inventory current metrics reported by `stats` and `health`.
   - Identify overlaps and unique data points that must be preserved.
2. **Design**
   - Define the command name, section layout, and output formats (table/json/etc.).
   - Plan migration path, including aliasing old commands and logging deprecation warnings.
3. **Execution**
   - Refactor CLI command registration and handlers to route through the new unified command.
   - Update tests, docs, and examples accordingly.
4. **Validation**
   - Verify exit codes remain consistent and meaningful for automation.
   - Run manual checks against sample databases to confirm usability.
5. **Communication**
   - Document the change in release notes and provide guidance for scripts using the old commands.

## Dependencies & Risks
- Requires careful handling of scripts that rely on previous command names.
- Need to ensure output remains machine-readable for existing integrations.
