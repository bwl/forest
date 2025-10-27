#!/usr/bin/env bash
# Main bulk import orchestrator for Forest
# Supports multiple data sources for populating the Forest database

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/import-helpers.sh"

show_usage() {
  cat << EOF
Forest Bulk Import Tool

Usage: $0 <source> [options]

Data Sources:
  shakespeare [mode]      Import Shakespeare's works from Project Gutenberg
                          Modes: complete, individual [limit], test (default: test)

  classics [limit]        Import classic literature from Project Gutenberg
                          Default: 20 books

  test                    Quick test dataset (5-10 documents for testing)

Examples:
  $0 shakespeare test              # Import 5 Shakespeare plays (quick test)
  $0 shakespeare individual 10     # Import first 10 Shakespeare plays
  $0 shakespeare complete          # Import Complete Works as chunked document
  $0 classics 50                   # Import top 50 classic books
  $0 test                          # Quick test dataset

Options:
  --help, -h              Show this help message

Notes:
  - All imports use Forest's automatic chunking and semantic linking
  - Large imports may take significant time due to embedding computation
  - Check 'forest stats' to see import progress and graph growth
EOF
}

import_shakespeare() {
  local mode="${1:-test}"
  local limit="${2:-}"

  log_info "Starting Shakespeare import (mode: $mode)"

  if [ -n "$limit" ]; then
    bash "$SCRIPT_DIR/data-sources/shakespeare.sh" "$mode" "$limit"
  else
    bash "$SCRIPT_DIR/data-sources/shakespeare.sh" "$mode"
  fi
}

import_classics() {
  local limit="${1:-20}"

  if [ -f "$SCRIPT_DIR/data-sources/classics.sh" ]; then
    log_info "Starting classics import (limit: $limit)"
    bash "$SCRIPT_DIR/data-sources/classics.sh" "$limit"
  else
    log_error "Classics importer not yet implemented"
    log_info "Would import top $limit books from Project Gutenberg"
    return 1
  fi
}

import_test() {
  log_info "Starting quick test import"
  log_info "This will import 5 Shakespeare plays for testing"
  import_shakespeare test
}

# Preflight checks
check_requirements() {
  local missing=()

  if ! command -v forest >/dev/null 2>&1; then
    missing+=("forest")
  fi

  if ! command -v curl >/dev/null 2>&1; then
    missing+=("curl")
  fi

  if [ ${#missing[@]} -gt 0 ]; then
    log_error "Missing required commands: ${missing[*]}"
    log_info "Please install missing dependencies and try again"
    return 1
  fi

  # Set default embedding provider if not set
  # Use 'mock' for testing if local embeddings are not available
  if [ -z "${FOREST_EMBED_PROVIDER:-}" ]; then
    export FOREST_EMBED_PROVIDER="mock"
    log_info "Using mock embeddings (set FOREST_EMBED_PROVIDER=local for real embeddings)"
  fi

  # Basic sanity check - just verify forest command works
  if ! forest stats >/dev/null 2>&1; then
    log_warning "Forest command check failed, but continuing anyway"
  fi

  return 0
}

# Main entry point
main() {
  if [ $# -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_usage
    exit 0
  fi

  # Preflight checks
  if ! check_requirements; then
    exit 1
  fi

  local source="$1"
  shift

  case "$source" in
    shakespeare)
      import_shakespeare "$@"
      ;;
    classics)
      import_classics "$@"
      ;;
    test)
      import_test
      ;;
    *)
      log_error "Unknown data source: $source"
      echo ""
      show_usage
      exit 1
      ;;
  esac

  log_success "Import complete!"
  log_info "Run 'forest stats' to see your graph statistics"
}

main "$@"
