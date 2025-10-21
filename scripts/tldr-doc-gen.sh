#!/usr/bin/env bash
#
# tldr-doc-gen.sh - Universal TLDR v0.1 Documentation Generator
#
# Generates comprehensive documentation for any CLI implementing the TLDR standard.
#
# Usage:
#   ./tldr-doc-gen.sh <cli-command> [--validate]
#
# Examples:
#   ./tldr-doc-gen.sh forest
#   ./tldr-doc-gen.sh forest --validate
#   ./tldr-doc-gen.sh git --validate  # (if git implemented TLDR)
#
# Output:
#   <cli>_tldr.txt - Complete human-readable documentation
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLI="${1:-}"
VALIDATE_ONLY=false

if [[ "$#" -eq 0 ]]; then
  echo "Usage: $0 <cli-command> [--validate]"
  echo ""
  echo "Examples:"
  echo "  $0 forest"
  echo "  $0 forest --validate"
  exit 1
fi

if [[ "$#" -ge 2 ]] && [[ "$2" == "--validate" ]]; then
  VALIDATE_ONLY=true
fi

# Check if CLI is available
if ! command -v "$CLI" &> /dev/null; then
  echo -e "${RED}✖ Error: '$CLI' command not found${NC}"
  exit 1
fi

# Output file
OUTPUT="${CLI}_tldr.txt"
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

# Validation counters
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0

log_error() {
  echo -e "${RED}✖ $1${NC}" >&2
  ((VALIDATION_ERRORS++))
}

log_warning() {
  echo -e "${YELLOW}⚠ $1${NC}" >&2
  ((VALIDATION_WARNINGS++))
}

log_success() {
  echo -e "${GREEN}✔ $1${NC}"
}

log_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

# Fetch global TLDR
log_info "Fetching global TLDR index from '$CLI --tldr'..."
if ! GLOBAL_TLDR=$($CLI --tldr 2>&1); then
  log_error "Failed to fetch global TLDR"
  exit 1
fi

# Parse global index
NAME=$(echo "$GLOBAL_TLDR" | grep "^NAME:" | cut -d: -f2- | xargs)
VERSION=$(echo "$GLOBAL_TLDR" | grep "^VERSION:" | cut -d: -f2- | xargs)
SUMMARY=$(echo "$GLOBAL_TLDR" | grep "^SUMMARY:" | cut -d: -f2- | xargs)
COMMANDS=$(echo "$GLOBAL_TLDR" | grep "^COMMANDS:" | cut -d: -f2- | xargs)
TLDR_CALL=$(echo "$GLOBAL_TLDR" | grep "^TLDR_CALL:" | cut -d: -f2- | xargs)

# Validate global index
if [[ -z "$NAME" ]]; then log_error "Global index missing NAME"; fi
if [[ -z "$VERSION" ]]; then log_error "Global index missing VERSION"; fi
if [[ -z "$SUMMARY" ]]; then log_error "Global index missing SUMMARY"; fi
if [[ -z "$COMMANDS" ]]; then log_error "Global index missing COMMANDS"; fi
if [[ -z "$TLDR_CALL" ]]; then log_error "Global index missing TLDR_CALL"; fi

if [[ $VALIDATION_ERRORS -gt 0 ]]; then
  log_error "Global index validation failed with $VALIDATION_ERRORS error(s)"
  exit 1
fi

log_success "Global index validated"

# Convert comma-separated commands to array
IFS=',' read -ra CMD_ARRAY <<< "$COMMANDS"
TOTAL_COMMANDS=${#CMD_ARRAY[@]}

log_info "Found $TOTAL_COMMANDS commands"

# Validation mode: check all commands
if $VALIDATE_ONLY; then
  log_info "Running validation checks..."

  ACCESSIBLE_COMMANDS=0
  FAILED_COMMANDS=0

  for cmd in "${CMD_ARRAY[@]}"; do
    cmd=$(echo "$cmd" | xargs)  # trim whitespace

    # Convert dot notation to space (e.g., "node.read" -> "node read")
    CMD_ARGS=${cmd//./ }

    # Try to fetch command TLDR
    if CMD_TLDR=$($CLI $CMD_ARGS --tldr 2>/dev/null); then
      ((ACCESSIBLE_COMMANDS++))

      # Validate required fields
      CMD_NAME=$(echo "$CMD_TLDR" | grep "^CMD:" | cut -d: -f2- | xargs)
      PURPOSE=$(echo "$CMD_TLDR" | grep "^PURPOSE:" | cut -d: -f2- | xargs)

      if [[ -z "$CMD_NAME" ]]; then
        log_warning "Command '$cmd' missing CMD field"
      fi
      if [[ -z "$PURPOSE" ]]; then
        log_warning "Command '$cmd' missing PURPOSE field"
      fi
      if [[ "$CMD_NAME" != "$cmd" ]]; then
        log_warning "Command '$cmd' has mismatched CMD field: '$CMD_NAME'"
      fi
    else
      log_error "Command '$cmd' is not accessible"
      ((FAILED_COMMANDS++))
    fi
  done

  echo ""
  echo "════════════════════════════════════════"
  echo "VALIDATION SUMMARY"
  echo "════════════════════════════════════════"
  log_info "CLI: $NAME v$VERSION"
  log_info "Total commands: $TOTAL_COMMANDS"
  log_success "Accessible commands: $ACCESSIBLE_COMMANDS"

  if [[ $FAILED_COMMANDS -gt 0 ]]; then
    log_error "Failed commands: $FAILED_COMMANDS"
  fi

  if [[ $VALIDATION_ERRORS -gt 0 ]]; then
    log_error "Validation errors: $VALIDATION_ERRORS"
  fi

  if [[ $VALIDATION_WARNINGS -gt 0 ]]; then
    log_warning "Validation warnings: $VALIDATION_WARNINGS"
  fi

  echo ""
  if [[ $VALIDATION_ERRORS -eq 0 ]] && [[ $FAILED_COMMANDS -eq 0 ]]; then
    log_success "$NAME is TLDR v0.1 compliant ✨"
    exit 0
  else
    log_error "$NAME has validation failures"
    exit 1
  fi
fi

# Documentation generation mode
log_info "Generating documentation to $OUTPUT..."

{
  # Header
  echo "════════════════════════════════════════════════════════════════════════════════"
  echo "  $NAME v$VERSION - Complete TLDR Documentation"
  echo "════════════════════════════════════════════════════════════════════════════════"
  echo ""
  echo "  $SUMMARY"
  echo ""
  echo "  Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
  echo "  TLDR Spec: v0.1"
  echo "  Commands: $TOTAL_COMMANDS total"
  echo ""
  echo "════════════════════════════════════════════════════════════════════════════════"
  echo ""

  # Global index
  echo "GLOBAL INDEX"
  echo "────────────────────────────────────────────────────────────────────────────────"
  echo "$GLOBAL_TLDR"
  echo ""
  echo "════════════════════════════════════════════════════════════════════════════════"
  echo ""

  # Categorize commands
  echo "COMMAND INDEX"
  echo "────────────────────────────────────────────────────────────────────────────────"

  declare -A CATEGORIES
  TOP_LEVEL=()

  for cmd in "${CMD_ARRAY[@]}"; do
    cmd=$(echo "$cmd" | xargs)

    if [[ "$cmd" == *.* ]]; then
      # Namespaced command (e.g., "node.read")
      prefix=$(echo "$cmd" | cut -d. -f1)
      CATEGORIES[$prefix]+="$cmd "
    else
      # Top-level command
      TOP_LEVEL+=("$cmd")
    fi
  done

  if [[ ${#TOP_LEVEL[@]} -gt 0 ]]; then
    echo ""
    echo "[Top-Level Commands]"
    printf "  %s\n" "${TOP_LEVEL[@]}" | sort
  fi

  for category in $(printf '%s\n' "${!CATEGORIES[@]}" | sort); do
    echo ""
    echo "[${category^} Commands]"
    for cmd in ${CATEGORIES[$category]}; do
      echo "  $cmd"
    done
  done

  echo ""
  echo "════════════════════════════════════════════════════════════════════════════════"
  echo ""

  # Command details
  echo "COMMAND DETAILS"
  echo "════════════════════════════════════════════════════════════════════════════════"

  for cmd in "${CMD_ARRAY[@]}"; do
    cmd=$(echo "$cmd" | xargs)

    # Convert dot notation to space
    CMD_ARGS=${cmd//./ }

    echo ""
    echo ">>> $cmd <<<"
    echo "────────────────────────────────────────────────────────────────────────────────"

    # Fetch command TLDR (with error handling)
    if CMD_TLDR=$($CLI $CMD_ARGS --tldr 2>&1); then
      echo "$CMD_TLDR"
    else
      echo "ERROR: Failed to fetch TLDR for command '$cmd'"
      echo "$CMD_TLDR"
    fi

    echo ""
  done

  # Footer
  echo "════════════════════════════════════════════════════════════════════════════════"
  echo "  End of $NAME TLDR Documentation"
  echo "  Generated by: tldr-doc-gen.sh (TLDR v0.1 Universal Generator)"
  echo "════════════════════════════════════════════════════════════════════════════════"

} > "$OUTPUT"

log_success "Documentation generated: $OUTPUT"

# Show file size
FILE_SIZE=$(wc -c < "$OUTPUT" | xargs)
FILE_SIZE_KB=$((FILE_SIZE / 1024))
log_info "File size: ${FILE_SIZE_KB}KB ($FILE_SIZE bytes)"

# Show line count
LINE_COUNT=$(wc -l < "$OUTPUT" | xargs)
log_info "Line count: $LINE_COUNT lines"

echo ""
log_success "Done! View with: cat $OUTPUT"
