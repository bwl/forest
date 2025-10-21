# Task: Build TUI for Explore and Review

## Objective
Deliver a curses-style TUI that makes exploring the graph and moderating edges more engaging and efficient.

## Key Deliverables
- TUI design mockups showing navigation, search, and moderation flows.
- Implementation of TUI modules integrated with existing CLI commands.
- Keyboard shortcuts and accessibility considerations.
- Documentation teaching users how to launch and use the TUI.
- Tests (where feasible) or automated snapshots for UI components.

## Implementation Plan
1. **Design & Prototyping**
   - Evaluate libraries for building TUIs in Node/TypeScript.
   - Create interaction flows covering browsing, filtering, and accepting/rejecting edges.
2. **Implementation**
   - Build modular TUI components for graph navigation, detail panels, and moderation queues.
   - Integrate with backend APIs for live data updates.
3. **Testing & QA**
   - Add automated tests for state management logic and manual QA scripts for UI behavior.
4. **Documentation**
   - Provide quickstart guides, demo gifs, and command references.
5. **Rollout**
   - Gather user feedback and iterate on usability enhancements.

## Dependencies & Risks
- TUI work depends on edges review consolidation to avoid duplicate effort.
- Terminal compatibility across platforms must be considered.
