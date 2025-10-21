# Task: Introduce Workspaces and Profile Switching

## Objective
Enable users to maintain separate graphs (e.g., work vs personal) via profiles or workspaces that can be switched through CLI flags or environment variables.

## Key Deliverables
- Design document outlining workspace/profile configuration, storage, and UX.
- CLI flags and environment variable support (e.g., `--profile`, `FOREST_PROFILE`).
- Persistence layer updates to isolate databases or configs per profile.
- Documentation and onboarding guides showing how to create, list, switch, and manage profiles.
- Test coverage ensuring profile isolation and migration safety.

## Implementation Plan
1. **Requirements Gathering**
   - Define use cases and constraints (local vs remote DBs, default profile behavior).
2. **Architecture & Design**
   - Decide on directory layout and naming conventions for profile data.
   - Outline configuration precedence (flags > env > default config).
3. **Implementation**
   - Update configuration loader and CLI argument parsing to accept profile inputs.
   - Implement commands for managing profiles (create, list, remove) if needed.
   - Ensure database connections and caches respect active profile context.
4. **Testing**
   - Add integration tests for switching profiles, including concurrent sessions.
   - Validate fallback behavior when profiles are missing or misconfigured.
5. **Documentation & Release**
   - Update README/docs and provide migration guidance for existing users.
   - Include release notes highlighting the new capability.

## Dependencies & Risks
- Requires careful handling of file permissions and locking across profiles.
- Users with custom scripts may need to update invocations to select the right profile.
