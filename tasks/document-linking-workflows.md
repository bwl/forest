# Task: Clarify Direct Linking vs Suggestion Review

## Objective
Improve documentation and UX cues that differentiate direct edge creation (`node.link`) from suggestion-based workflows (`edges review`/accept/promote).

## Key Deliverables
- Documentation updates explaining both pathways, including when to use each and how they interact.
- CLI help text updates for relevant commands highlighting workflow expectations.
- Examples or tutorials demonstrating both direct linking and moderated acceptance.
- Optional UX enhancements (e.g., warning prompts or success messages) reinforcing the distinction.

## Implementation Plan
1. **Audit Existing Materials**
   - Review current docs, help text, and onboarding flows referencing linking.
2. **Messaging Design**
   - Draft concise language describing the two workflows and their trade-offs.
   - Prepare CLI message templates or tooltips if applicable.
3. **Documentation Update**
   - Refresh docs/README sections and command reference pages.
   - Add comparison tables or flow diagrams where useful.
4. **CLI Messaging**
   - Update success and confirmation messages to indicate whether a link was direct or suggestion-based.
5. **Validation**
   - Collect feedback from beta users or internal reviewers to confirm clarity.

## Dependencies & Risks
- Coordination with the edges moderation revamp to avoid conflicting terminology.
