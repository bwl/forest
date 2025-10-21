# Task: Add Policy Controls for Auto-Linking

## Objective
Provide configurable defaults and per-command overrides for auto-linking thresholds and behaviors to give users better control over automatic edge creation.

## Key Deliverables
- Configuration schema for global defaults (e.g., `config set autoLink.minScore=0.6`).
- Command-level overrides for auto-link parameters.
- Documentation explaining policy hierarchy and usage patterns.
- Tests ensuring configs are respected and overrides take precedence.

## Implementation Plan
1. **Design**
   - Define configuration keys, data types, and storage location.
   - Decide on CLI syntax for overrides and how they interact with global defaults.
2. **Implementation**
   - Update config management system to read/write new settings.
   - Modify auto-linking logic to pull values from config and command flags.
3. **Testing**
   - Add unit tests for config parsing and precedence handling.
   - Run integration tests verifying auto-link thresholds change behavior as expected.
4. **Documentation**
   - Update docs, help text, and examples illustrating configuration workflows.

## Dependencies & Risks
- Must coordinate with config command redesign to maintain consistency.
