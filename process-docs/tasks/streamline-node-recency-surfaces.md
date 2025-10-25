# Task: Streamline Node Recency Surfaces

## Objective
Reduce redundancy between the node dashboard and `node.recent` commands by providing a single, flexible entry point for recent node activity.

## Key Deliverables
- Decision document describing the preferred UX (e.g., `node list --recent` or enhanced `node` dashboard flags).
- Implementation updates aligning the CLI commands to the chosen design.
- Documentation updates, including help text, tutorials, and release notes.
- Test coverage showing recent activity output behaves correctly.

## Implementation Plan
1. **Discovery**
   - Analyze existing usage patterns for `node` dashboard and `node.recent`.
   - Gather user stories where each command is preferred.
2. **Design**
   - Select the canonical command and define flag set for filtering, sorting, and formatting recent nodes.
   - Specify deprecation strategy for redundant command(s).
3. **Implementation**
   - Update CLI command registration and handlers to implement the chosen approach.
   - Ensure compatibility with automation (e.g., exit codes, JSON output).
4. **Documentation & Communication**
   - Revise help text and docs to point users to the unified flow.
   - Provide migration guidance for scripts using deprecated commands.
5. **Testing**
   - Run manual walkthroughs and add regression tests for recency filters.

## Dependencies & Risks
- Potential pushback from users accustomed to existing command names.
- Need to maintain backwards compatibility during transition period.
