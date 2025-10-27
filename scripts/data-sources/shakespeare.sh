#!/usr/bin/env bash
# Import Shakespeare's works from Project Gutenberg
# Data source: https://www.gutenberg.org/ebooks/author/65

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../import-helpers.sh"

# Shakespeare plays available on Project Gutenberg
# Format: "ID:Title"
declare -a SHAKESPEARE_PLAYS=(
  # Tragedies
  "1524:Hamlet"
  "1533:Macbeth"
  "1513:Romeo and Juliet"
  "2266:King Lear"
  "1531:Othello"
  "1799:Julius Caesar"
  "1534:Antony and Cleopatra"
  "1798:Coriolanus"
  "1535:Timon of Athens"
  "1797:Titus Andronicus"

  # Comedies
  "1522:A Midsummer Night's Dream"
  "1526:The Merchant of Venice"
  "1125:As You Like It"
  "1527:The Taming of the Shrew"
  "1794:Much Ado About Nothing"
  "1532:Twelfth Night"
  "1529:The Tempest"
  "1536:Measure for Measure"
  "1528:The Comedy of Errors"
  "2270:All's Well That Ends Well"
  "1790:The Two Gentlemen of Verona"
  "1530:The Winter's Tale"
  "1537:Love's Labour's Lost"
  "1795:The Merry Wives of Windsor"

  # Histories
  "1041:Henry IV, Part I"
  "1782:Henry IV, Part II"
  "1521:Henry V"
  "2251:Henry VI, Part I"
  "2252:Henry VI, Part II"
  "2253:Henry VI, Part III"
  "2255:Henry VIII"
  "2254:Richard II"
  "2257:Richard III"
  "1793:King John"

  # Poems
  "1041:Venus and Adonis"
  "1796:The Rape of Lucrece"
)

# Complete works (single file with all plays)
readonly COMPLETE_WORKS_ID="100"
readonly COMPLETE_WORKS_TITLE="The Complete Works of William Shakespeare"

# Project Gutenberg base URL
readonly GUTENBERG_BASE="https://www.gutenberg.org/cache/epub"

import_complete_works() {
  log_info "Importing Shakespeare's Complete Works as a single document..."

  local tmpdir
  tmpdir=$(create_temp_dir "shakespeare")
  local raw_file="$tmpdir/complete-works-raw.txt"
  local clean_file="$tmpdir/complete-works-clean.txt"

  # Download
  if ! download_file "$GUTENBERG_BASE/$COMPLETE_WORKS_ID/pg$COMPLETE_WORKS_ID.txt" "$raw_file"; then
    rm -rf "$tmpdir"
    return 1
  fi

  # Clean
  clean_gutenberg_text "$raw_file" "$clean_file"

  # Import with chunking (will create many nodes)
  log_info "Importing with automatic chunking (this will create many nodes)..."
  if forest node import \
    --file "$clean_file" \
    --title "$COMPLETE_WORKS_TITLE" \
    --tags "shakespeare,literature,drama,complete-works" \
    --chunk-strategy headers \
    --max-tokens 2000; then
    log_success "Complete Works imported successfully"
  else
    log_error "Failed to import Complete Works"
    rm -rf "$tmpdir"
    return 1
  fi

  # Cleanup
  rm -rf "$tmpdir"
}

import_individual_plays() {
  local limit="${1:-0}" # 0 means all plays

  log_info "Importing individual Shakespeare plays..."

  local tmpdir
  tmpdir=$(create_temp_dir "shakespeare-plays")
  local count=0
  local imported=0
  local failed=0

  local total=${#SHAKESPEARE_PLAYS[@]}
  if [ "$limit" -gt 0 ] && [ "$limit" -lt "$total" ]; then
    total=$limit
  fi

  for play_info in "${SHAKESPEARE_PLAYS[@]}"; do
    if [ "$limit" -gt 0 ] && [ "$count" -ge "$limit" ]; then
      break
    fi

    local id="${play_info%%:*}"
    local title="${play_info#*:}"
    count=$((count + 1))

    show_progress "$count" "$total" "$title"

    local raw_file="$tmpdir/play-$id-raw.txt"
    local clean_file="$tmpdir/play-$id-clean.txt"

    # Download
    if ! download_file "$GUTENBERG_BASE/$id/pg$id.txt" "$raw_file" 2>/dev/null; then
      log_warning "Skipping $title (download failed)"
      failed=$((failed + 1))
      continue
    fi

    # Clean
    clean_gutenberg_text "$raw_file" "$clean_file"

    # Import
    if forest node import \
      --file "$clean_file" \
      --title "$title" \
      --tags "shakespeare,play,literature,drama" \
      --chunk-strategy headers \
      --max-tokens 2000 \
      >/dev/null 2>&1; then
      imported=$((imported + 1))
    else
      log_warning "Failed to import: $title"
      failed=$((failed + 1))
    fi

    # Clean up individual files to save space
    rm -f "$raw_file" "$clean_file"
  done

  echo ""
  log_success "Imported $imported/$count plays"
  if [ "$failed" -gt 0 ]; then
    log_warning "$failed plays failed"
  fi

  # Cleanup
  rm -rf "$tmpdir"
}

import_test_sample() {
  log_info "Importing small test sample (5 plays)..."
  import_individual_plays 5
}

# Main entry point
main() {
  local mode="${1:-individual}"

  case "$mode" in
    complete)
      import_complete_works
      ;;
    individual)
      import_individual_plays "${2:-0}"
      ;;
    test)
      import_test_sample
      ;;
    *)
      echo "Usage: $0 {complete|individual|test} [limit]"
      echo ""
      echo "Modes:"
      echo "  complete    - Import Complete Works as single chunked document"
      echo "  individual  - Import each play separately (optionally limit number)"
      echo "  test        - Import 5 plays for testing"
      echo ""
      echo "Examples:"
      echo "  $0 test                 # Import 5 plays"
      echo "  $0 individual 10        # Import first 10 plays"
      echo "  $0 individual           # Import all plays"
      echo "  $0 complete             # Import complete works"
      exit 1
      ;;
  esac
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" -ef "$0" ]; then
  main "$@"
fi
