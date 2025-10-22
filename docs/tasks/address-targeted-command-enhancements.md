# Task: Address Targeted Command Enhancements

## Objective
Implement a set of focused improvements across various commands based on user feedback.

## Scope Items
- `edges.explain --json`: include component weights, model/version metadata, and optional `--why` output of overlapping terms.
- `search`: add `--max-results` alias and `--fields` selector.
- `tags.stats`: provide `--export csv` and `--graph` outputs (DOT/Mermaid).
- `export`: support selective filters such as `--since`, `--tags`.
- `version`: include build hash, embedding provider, and schema versions (`--verbose`).
- `config`: restructure into subcommands (`config show|set|get|reset`) and document precedence.

## Key Deliverables
- Updated command implementations covering each scope item.
- Documentation and help text detailing new flags and outputs.
- Tests validating new options and ensuring backward compatibility.

## Implementation Plan
1. **Design**
   - For each command, define precise output formats and flag behavior.
   - Ensure new options align with global formatting and filtering standards.
2. **Implementation**
   - Update command handlers and supporting modules to add the specified flags/features.
   - Refactor config command to subcommand structure.
3. **Testing**
   - Add targeted unit/integration tests verifying each new option works as intended.
4. **Documentation**
   - Update CLI help, docs, and examples to surface the enhancements.

## Dependencies & Risks
- Must coordinate with global formatting and filtering work to avoid duplication.
