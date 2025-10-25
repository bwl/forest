#!/usr/bin/env bash

# Enhanced script to run forest commands and record their output with flexible filtering
# Requires bash 4.0+ for associative arrays
# Usage:
#   ./record_commands.sh                    # Run all commands (default)
#   ./record_commands.sh --filter node      # Run only node commands
#   ./record_commands.sh --filter edges     # Run only edge commands
#   ./record_commands.sh --interactive      # Select commands interactively
#   ./record_commands.sh --baseline         # Save current run as baseline
#   ./record_commands.sh --compare FILE1 FILE2  # Compare two previous runs

set -euo pipefail

# Check bash version (need 4.0+ for associative arrays)
if ((BASH_VERSINFO[0] < 4)); then
  echo "Error: This script requires bash 4.0 or higher (found $BASH_VERSION)"
  echo "On macOS, install with: brew install bash"
  echo "Or use a system with bash 4+."
  exit 1
fi

# Output directory
OUTPUT_DIR="outputs"
mkdir -p "$OUTPUT_DIR"

# Generate timestamped filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="$OUTPUT_DIR/forest_surface_${TIMESTAMP}.txt"

# Parse command line arguments
FILTER="all"
INTERACTIVE=false
BASELINE=false
COMPARE_MODE=false
COMPARE_FILE1=""
COMPARE_FILE2=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --filter)
      FILTER="$2"
      shift 2
      ;;
    --interactive|-i)
      INTERACTIVE=true
      shift
      ;;
    --baseline|-b)
      BASELINE=true
      shift
      ;;
    --compare|-c)
      COMPARE_MODE=true
      COMPARE_FILE1="$2"
      COMPARE_FILE2="$3"
      shift 3
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --filter CATEGORY    Run commands from specific category:"
      echo "                       all, core, node, edges, tags, export, system"
      echo "  --interactive, -i    Select commands interactively"
      echo "  --baseline, -b       Save this run as baseline for future comparisons"
      echo "  --compare FILE1 FILE2  Compare two previous runs"
      echo "  --help, -h           Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                          # Run all commands"
      echo "  $0 --filter edges           # Run only edge commands"
      echo "  $0 --interactive            # Select commands to run"
      echo "  $0 --baseline               # Save as baseline"
      echo "  $0 --compare outputs/forest_surface_baseline.txt outputs/forest_surface_latest.txt"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Handle comparison mode
if [ "$COMPARE_MODE" = true ]; then
  if [ ! -f "$COMPARE_FILE1" ] || [ ! -f "$COMPARE_FILE2" ]; then
    echo "Error: Both comparison files must exist"
    exit 1
  fi

  echo "Comparing command outputs:"
  echo "  File 1: $COMPARE_FILE1"
  echo "  File 2: $COMPARE_FILE2"
  echo ""

  # Use diff with color if available
  if command -v colordiff &> /dev/null; then
    colordiff -u "$COMPARE_FILE1" "$COMPARE_FILE2" | less -R
  else
    diff -u "$COMPARE_FILE1" "$COMPARE_FILE2" | less
  fi
  exit 0
fi

# Define command categories
declare -A categories

categories[core]="forest
forest --help
forest -V
forest completions"

categories[node]="forest node
forest node read
forest node edit
forest node delete
forest node link"

categories[edges]="forest edges
forest edges propose
forest edges accept
forest edges reject
forest edges promote
forest edges sweep
forest edges explain
forest edges undo"

categories[tags]="forest tags
forest tags list
forest tags rename
forest tags stats"

categories[export]="forest export
forest export json
forest export graphviz"

categories[system]="forest capture
forest explore
forest health
forest stats
forest admin:recompute-embeddings"

# Build the command list based on filter
commands_to_run=()

if [ "$FILTER" = "all" ]; then
  for category in core node edges tags export system; do
    while IFS= read -r cmd; do
      [ -n "$cmd" ] && commands_to_run+=("$cmd")
    done <<< "${categories[$category]}"
  done
else
  if [ -z "${categories[$FILTER]:-}" ]; then
    echo "Error: Unknown category '$FILTER'"
    echo "Valid categories: all, core, node, edges, tags, export, system"
    exit 1
  fi
  while IFS= read -r cmd; do
    [ -n "$cmd" ] && commands_to_run+=("$cmd")
  done <<< "${categories[$FILTER]}"
fi

# Interactive mode
if [ "$INTERACTIVE" = true ]; then
  echo "Select commands to run (space to toggle, enter to confirm):"
  echo ""

  # Use a temporary file to store selections
  TEMP_SELECTIONS=$(mktemp)

  # Simple checkbox interface
  for i in "${!commands_to_run[@]}"; do
    echo "$i:${commands_to_run[$i]}" >> "$TEMP_SELECTIONS"
  done

  # For now, show all and ask for indices (a full interactive UI would need 'dialog' or 'whiptail')
  echo "Available commands:"
  for i in "${!commands_to_run[@]}"; do
    echo "  [$i] ${commands_to_run[$i]}"
  done
  echo ""
  echo "Enter command indices to run (space-separated, or 'all'):"
  read -r selection

  if [ "$selection" != "all" ]; then
    selected_commands=()
    for idx in $selection; do
      if [ "$idx" -ge 0 ] && [ "$idx" -lt "${#commands_to_run[@]}" ]; then
        selected_commands+=("${commands_to_run[$idx]}")
      fi
    done
    commands_to_run=("${selected_commands[@]}")
  fi

  rm -f "$TEMP_SELECTIONS"
fi

# Start generating output file
echo "╔═══════════════════════════════════════════════════════════════════╗" > "$OUTPUT_FILE"
echo "║            Forest Command Surface Analysis                        ║" >> "$OUTPUT_FILE"
echo "╚═══════════════════════════════════════════════════════════════════╝" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Metadata section
echo "═══════════════════════════════════════════════════════════════════" >> "$OUTPUT_FILE"
echo "METADATA" >> "$OUTPUT_FILE"
echo "═══════════════════════════════════════════════════════════════════" >> "$OUTPUT_FILE"
echo "Generated:     $(date '+%Y-%m-%d %H:%M:%S')" >> "$OUTPUT_FILE"
echo "Filter:        $FILTER" >> "$OUTPUT_FILE"
echo "Commands:      ${#commands_to_run[@]}" >> "$OUTPUT_FILE"

# Get forest version if available
if command -v forest &> /dev/null; then
  FOREST_VERSION=$(forest -V 2>&1 || echo "unknown")
  echo "Forest:        $FOREST_VERSION" >> "$OUTPUT_FILE"
fi

echo "═══════════════════════════════════════════════════════════════════" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Group and run commands by category
current_category=""

for cmd in "${commands_to_run[@]}"; do
  # Determine category for this command
  cmd_category=""
  for cat in core node edges tags export system; do
    if grep -Fxq "$cmd" <<< "${categories[$cat]}"; then
      cmd_category=$cat
      break
    fi
  done

  # Print category header if we've moved to a new category
  if [ "$cmd_category" != "$current_category" ]; then
    current_category=$cmd_category

    cat >> "$OUTPUT_FILE" << EOF

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  CATEGORY: ${cmd_category^^}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

EOF
  fi

  # Command header
  echo "───────────────────────────────────────────────────────────────────" >> "$OUTPUT_FILE"
  echo "COMMAND: $cmd" >> "$OUTPUT_FILE"
  echo "───────────────────────────────────────────────────────────────────" >> "$OUTPUT_FILE"

  # Execute command and capture output
  output=$(eval "$cmd" 2>&1 || true)

  # Special handling for 'forest tags list' to only record first 20 lines
  if [ "$cmd" = "forest tags list" ]; then
    echo "$output" | head -n 20 >> "$OUTPUT_FILE"
    echo "... (truncated)" >> "$OUTPUT_FILE"
  else
    echo "$output" >> "$OUTPUT_FILE"
  fi

  echo "" >> "$OUTPUT_FILE"

  # Print progress to console
  echo "✓ Executed: $cmd"
done

# Footer
echo "" >> "$OUTPUT_FILE"
echo "═══════════════════════════════════════════════════════════════════" >> "$OUTPUT_FILE"
echo "End of command surface analysis" >> "$OUTPUT_FILE"
echo "═══════════════════════════════════════════════════════════════════" >> "$OUTPUT_FILE"

# Create/update symlinks
ln -sf "$(basename "$OUTPUT_FILE")" "$OUTPUT_DIR/forest_surface_latest.txt"

if [ "$BASELINE" = true ]; then
  ln -sf "$(basename "$OUTPUT_FILE")" "$OUTPUT_DIR/forest_surface_baseline.txt"
  echo ""
  echo "✓ Saved as baseline: $OUTPUT_DIR/forest_surface_baseline.txt"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ All commands executed successfully"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Output saved to: $OUTPUT_FILE"
echo "Latest:          $OUTPUT_DIR/forest_surface_latest.txt"
[ "$BASELINE" = true ] && echo "Baseline:        $OUTPUT_DIR/forest_surface_baseline.txt"
echo ""
echo "To compare with baseline:"
echo "  $0 --compare $OUTPUT_DIR/forest_surface_baseline.txt $OUTPUT_FILE"
echo ""
