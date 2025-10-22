# Task: Provide CLI Completion Scripts

## Objective
Offer shell completion support for bash, zsh, and fish via `forest completions install` or similar tooling.

## Key Deliverables
- Completion script generation for supported shells.
- Installation command (`forest completions install`) handling detection and user prompts.
- Documentation detailing manual installation and troubleshooting steps.
- Tests or automated checks ensuring generated completions reflect current command surface.

## Implementation Plan
1. **Discovery**
   - Evaluate CLI framework support for generating completion scripts.
   - Determine installation directories and user environment considerations per shell.
2. **Implementation**
   - Implement command to output or install completion scripts.
   - Ensure completions update automatically when the command surface changes.
3. **Testing**
   - Validate completions in each shell manually and via automated snapshots where possible.
4. **Documentation**
   - Update docs with install instructions and FAQ for common issues.

## Dependencies & Risks
- Shell-specific nuances may require careful handling to avoid breaking user configs.
