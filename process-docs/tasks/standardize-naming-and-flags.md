# Task: Standardize Command Naming and Flag Conventions

## Objective
Ensure consistent use of delimiters (dots vs colons), global flag patterns, and naming conventions across the CLI.

## Key Deliverables
- Style guide update specifying command naming rules and delimiter usage.
- Implementation changes harmonizing command registrations (choose dots or spaces) and deprecating inconsistent aliases.
- Global flag policy for identifiers (`--ids`), boolean defaults, and pluralization standards.
- Documentation refresh reflecting the standardized conventions.
- Tests or linting checks to prevent regressions.

## Implementation Plan
1. **Audit**
   - Catalog current command names, delimiters, and flag variations.
2. **Design**
   - Decide on canonical patterns (e.g., dotted commands, positive boolean flags, plural naming).
   - Define automatic generation of `--no-` variants if needed.
3. **Implementation**
   - Update command registration, flag definitions, and help text to match standards.
   - Introduce linters or static checks enforcing the conventions.
4. **Documentation**
   - Update command reference and onboarding materials.
5. **Testing**
   - Verify CLI invocations via automated tests to ensure compatibility and proper warnings for deprecated names.

## Dependencies & Risks
- Users may rely on existing command names; plan a deprecation period with clear messaging.
