# Task: Harden Destructive Operations

## Objective
Add safety mechanisms (dry-runs, confirmations, standardized `--yes/--force`) to high-impact commands like `node.delete`, `edges.promote`, and `admin.retag-all`.

## Key Deliverables
- Inventory of destructive commands and associated risks.
- Implementation of confirmation prompts, dry-run summaries, and consistent `--yes/--force` flags.
- Additional safeguards such as cost ceilings, rate limits, and resume capabilities for long-running operations.
- Documentation outlining safety features and recommended workflows.
- Tests verifying safeguards trigger appropriately.

## Implementation Plan
1. **Audit**
   - Identify commands requiring safeguards and current behavior.
2. **Design**
   - Define standardized confirmation patterns and output summaries.
3. **Implementation**
   - Add dry-run/reporting capabilities and enforce confirmation flags.
   - Implement cost ceilings and resume options where specified.
4. **Testing**
   - Create automated tests for destructive command flows and manual QA scripts.
5. **Documentation**
   - Update help text and docs describing safety features and best practices.

## Dependencies & Risks
- Must ensure safeguards are flexible enough for automation while preventing accidental destructive actions.
