# Forest Command Surface Testing

This directory contains tools for recording and analyzing the Forest CLI command surface to ensure consistency across versions.

## Quick Start

```bash
# Run all commands and save output
./record_commands.sh

# Run only edge-related commands
./record_commands.sh --filter edges

# Run specific commands interactively
./record_commands.sh --interactive

# Save current run as baseline for future comparisons
./record_commands.sh --baseline

# Compare two runs
./record_commands.sh --compare outputs/forest_surface_baseline.txt outputs/forest_surface_latest.txt
```

## Features

### 1. Command Categorization

Commands are organized into logical categories:

- **core**: Basic commands (help, version, completions)
- **node**: Node operations (read, edit, delete, link)
- **edges**: Edge management (propose, accept, reject, promote, sweep, explain, undo)
- **tags**: Tag operations (list, rename, stats)
- **export**: Export commands (json, graphviz)
- **system**: System commands (capture, explore, health, stats, admin)

### 2. Selective Execution

Use `--filter` to run only specific command categories:

```bash
./record_commands.sh --filter node      # Only node commands
./record_commands.sh --filter edges     # Only edge commands
./record_commands.sh --filter tags      # Only tag commands
./record_commands.sh --filter export    # Only export commands
./record_commands.sh --filter system    # Only system commands
./record_commands.sh --filter core      # Only core commands
./record_commands.sh --filter all       # All commands (default)
```

### 3. Interactive Mode

Select specific commands to run from a menu:

```bash
./record_commands.sh --interactive
# or
./record_commands.sh -i
```

You'll see a numbered list of commands and can select which ones to run by entering their indices.

### 4. Timestamped Outputs

All runs are saved to the `outputs/` directory with timestamps:

```
outputs/
├── forest_surface_20241019_143022.txt    # Timestamped run
├── forest_surface_20241019_143145.txt    # Another run
├── forest_surface_latest.txt → ...       # Symlink to most recent
└── forest_surface_baseline.txt → ...     # Reference for comparisons
```

### 5. Comparison Mode

Compare two command surface outputs to spot inconsistencies or changes:

```bash
# Compare baseline with latest
./record_commands.sh --compare \
  outputs/forest_surface_baseline.txt \
  outputs/forest_surface_latest.txt

# Compare any two runs
./record_commands.sh --compare \
  outputs/forest_surface_20241019_143022.txt \
  outputs/forest_surface_20241019_143145.txt
```

The comparison uses `diff` (with color if `colordiff` is available) and pages through the results.

### 6. Enhanced Output Format

Output files include:

- **Header** with ASCII art
- **Metadata section** with timestamp, filter used, command count, and Forest version
- **Category sections** with clear visual separators
- **Individual command outputs** with consistent formatting
- **Footer** for easy navigation

Example output structure:

```
╔═══════════════════════════════════════════════════════════════════╗
║            Forest Command Surface Analysis                        ║
╚═══════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════
METADATA
═══════════════════════════════════════════════════════════════════
Generated:     2024-10-19 14:30:22
Filter:        all
Commands:      28
Forest:        forest version 1.0.0
═══════════════════════════════════════════════════════════════════

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  CATEGORY: CORE
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

───────────────────────────────────────────────────────────────────
COMMAND: forest
───────────────────────────────────────────────────────────────────
[command output here]
...
```

## Usage Examples

### Workflow 1: Baseline Creation

When starting to track command surface consistency:

```bash
# 1. Run all commands and save as baseline
./record_commands.sh --baseline

# This creates:
#   - outputs/forest_surface_YYYYMMDD_HHMMSS.txt
#   - outputs/forest_surface_latest.txt → (symlink)
#   - outputs/forest_surface_baseline.txt → (symlink)
```

### Workflow 2: Regular Testing

After making changes to the CLI:

```bash
# 1. Run commands (optionally filtered)
./record_commands.sh --filter edges

# 2. Compare with baseline
./record_commands.sh --compare \
  outputs/forest_surface_baseline.txt \
  outputs/forest_surface_latest.txt

# 3. If satisfied, update baseline
./record_commands.sh --baseline
```

### Workflow 3: Focused Testing

When working on a specific command group:

```bash
# Only test edge commands
./record_commands.sh --filter edges

# Or select specific commands interactively
./record_commands.sh --interactive
# Then enter: 10 11 12 (for example)
```

### Workflow 4: Investigating Changes

When you notice inconsistencies:

```bash
# 1. Compare two specific runs
./record_commands.sh --compare \
  outputs/forest_surface_20241019_100000.txt \
  outputs/forest_surface_20241019_140000.txt

# 2. Run specific category to investigate
./record_commands.sh --filter node

# 3. Review the output file directly
less outputs/forest_surface_latest.txt
```

## Tips

1. **Use baseline mode sparingly**: Only save baselines when you're confident the output is correct
2. **Filter for speed**: Use `--filter` when you only need to check specific command groups
3. **Timestamped history**: All runs are preserved, so you can always go back and compare
4. **Interactive for ad-hoc testing**: Use `-i` when you want to test a few specific commands
5. **Install colordiff**: For better diff visualization: `brew install colordiff` (macOS) or `apt-get install colordiff` (Linux)

## Command Reference

```bash
# Help
./record_commands.sh --help

# Filters
./record_commands.sh --filter all      # Default
./record_commands.sh --filter core
./record_commands.sh --filter node
./record_commands.sh --filter edges
./record_commands.sh --filter tags
./record_commands.sh --filter export
./record_commands.sh --filter system

# Modes
./record_commands.sh --interactive     # Select commands
./record_commands.sh -i                # Short form

# Baseline
./record_commands.sh --baseline        # Save as baseline
./record_commands.sh -b                # Short form

# Comparison
./record_commands.sh --compare FILE1 FILE2
./record_commands.sh -c FILE1 FILE2    # Short form
```

## Output Directory Structure

```
outputs/
├── forest_surface_YYYYMMDD_HHMMSS.txt    # Timestamped runs
├── forest_surface_latest.txt             # Always points to most recent
└── forest_surface_baseline.txt           # User-defined reference point
```

The `latest` symlink is always updated on each run. The `baseline` symlink is only updated when you use the `--baseline` flag.
