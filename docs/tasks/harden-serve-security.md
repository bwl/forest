# Task: Harden Serve Command Security

## Objective
Introduce authentication, authorization, and network controls for the `serve` command to ensure safe deployment scenarios.

## Key Deliverables
- Security requirements document covering auth tokens, CORS, TLS, rate limiting, and read-only modes.
- Implementation of authentication mechanisms (e.g., `serve --auth token`, `FOREST_TOKEN`).
- Network configuration options (`--public`, `--base-path`, `--origins`, `--idle-timeout`, `--max-payload`).
- Documentation detailing deployment best practices and configuration steps.
- Tests for security-critical code paths (auth enforcement, rate limiting, TLS configuration).

## Implementation Plan
1. **Threat Modeling**
   - Identify attack vectors for exposed servers and prioritize mitigations.
2. **Design**
   - Choose authentication scheme(s) and configuration management approach.
   - Define defaults (localhost binding unless `--public` set) and failure behaviors.
3. **Implementation**
   - Update server bootstrap to enforce auth, apply CORS, and manage TLS where supported.
   - Add configuration for rate limiting and read-only mode.
4. **Testing**
   - Write integration tests covering auth-required requests, CORS, and TLS negotiation (where feasible).
5. **Documentation**
   - Provide deployment guides, environment variable references, and sample configs.

## Dependencies & Risks
- TLS support may require external dependencies or platform constraints.
- Need to consider multiuser permissions work to align with auth model.
