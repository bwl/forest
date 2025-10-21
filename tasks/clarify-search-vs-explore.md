# Task: Clarify Search and Explore Command Boundaries

## Objective
Define and implement distinct behaviors for `search` and `explore` so users immediately understand when to use each command.

## Key Deliverables
- Product spec describing the intended UX for both commands, including inputs, outputs, and examples.
- Updated CLI help text, docs, and flag descriptions reflecting the separation.
- Implementation changes to enforce the defined scopes (global ranked search vs scoped neighborhood browsing).
- Regression tests or smoke tests demonstrating the new behaviors.

## Implementation Plan
1. **Research & Discovery**
   - Audit current `search` and `explore` command flows and flag handling.
   - Collect telemetry or anecdotal feedback to confirm pain points.
2. **Design**
   - Draft UX narrative showing end-to-end usage for both commands.
   - Specify which flags belong to each command (e.g., `--neighbors`, depth controls for `explore`; ranking parameters for `search`).
3. **Execution**
   - Update command handlers to enforce the new logic (e.g., limit explore to scoped browsing with local neighborhood expansion).
   - Adjust examples in `COMMAND_SURFACE_README.md` and CLI help output.
4. **Validation**
   - Create scenario tests that cover global search and scoped exploration.
   - Run manual CLI walkthroughs to ensure messaging is clear.
5. **Release**
   - Announce the changes in release notes and migration guide if flags are deprecated.

## Dependencies & Risks
- Requires coordination with documentation owners to ensure examples stay consistent.
- Potential migration friction for users relying on old flag combinations.
