# Task: Enhance Serve Configuration and Protocol Stability

## Objective
Expand the `serve` command configuration surface to cover binding defaults, base paths, WebSocket schema versioning, and backpressure documentation.

## Key Deliverables
- Updated defaults (bind to localhost unless `--public` specified).
- New configuration flags (`--base-path`, `--origins`, `--idle-timeout`, `--max-payload`).
- Versioned WebSocket event schema with documented change management.
- Documentation describing backpressure handling and deployment tuning.
- Tests ensuring new flags are honored and defaults behave securely.

## Implementation Plan
1. **Design**
   - Specify desired defaults and configuration interactions.
   - Define WebSocket event schema versioning strategy and compatibility guarantees.
2. **Implementation**
   - Update server bootstrap to apply new defaults and configuration flags.
   - Introduce schema version headers/payloads for WebSocket events and validation logic.
3. **Testing**
   - Add integration tests for server startup options and WebSocket compatibility.
4. **Documentation**
   - Update serve command reference and operational guides with new options and backpressure strategies.

## Dependencies & Risks
- Must coordinate with security hardening work to ensure consistent behavior.
- Changes to defaults may surprise existing users; plan communication in release notes.
