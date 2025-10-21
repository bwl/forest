# Task: Revamp Edges Moderation Workflow

## Objective
Simplify the edges moderation surface by consolidating multiple commands into a cohesive review experience with interactive controls and batch operations.

## Key Deliverables
- UX spec for a new `edges review` flow (CLI or TUI) that supports accept/reject/undo/explain interactions inline.
- Plan for retaining batch commands like `promote` and `sweep` as subcommands or advanced options.
- Implementation updates removing or aliasing redundant commands.
- Documentation clarifying the new workflow and differentiating it from direct linking.
- Test coverage for the review pipeline, including edge suggestion acceptance and rollbacks.

## Implementation Plan
1. **Current State Analysis**
   - Document existing command behaviors and inputs for the edges moderation suite.
   - Identify shared logic that can be centralized.
2. **Experience Design**
   - Prototype the `edges review` command (text mockups, flow diagrams).
   - Define flag set for filtering suggestions, toggling explanations, and controlling batch size.
3. **Execution**
   - Refactor CLI command tree to introduce the new review entry point.
   - Implement interactive/TUI mode and non-interactive batch review modes.
   - Provide backward-compatible aliases or warnings for deprecated commands.
4. **Validation**
   - Test with sample suggestion queues to ensure moderator tasks are streamlined.
   - Verify undo and explain features behave as expected.
5. **Rollout**
   - Update docs, changelog, and onboarding materials.
   - Gather feedback from power users to refine the workflow post-release.

## Dependencies & Risks
- Building a TUI may introduce new dependencies; ensure they align with project constraints.
- Need to preserve audit logs and history when consolidating command logic.
