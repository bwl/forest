#!/usr/bin/env bash
# Import classic literature from Project Gutenberg
# Top books by download count: https://www.gutenberg.org/browse/scores/top

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../import-helpers.sh"

# Top classic books from Project Gutenberg (by popularity)
# Format: "ID:Title:Author:Tags"
declare -a CLASSIC_BOOKS=(
  # Top downloaded books (non-Shakespeare)
  "84:Frankenstein:Mary Shelley:gothic,horror,science-fiction,classic"
  "1342:Pride and Prejudice:Jane Austen:romance,classic,regency"
  "11:Alice's Adventures in Wonderland:Lewis Carroll:fantasy,children,classic"
  "98:A Tale of Two Cities:Charles Dickens:historical,classic,french-revolution"
  "1661:The Adventures of Sherlock Holmes:Arthur Conan Doyle:mystery,detective,classic"
  "2701:Moby Dick:Herman Melville:adventure,classic,maritime"
  "1952:The Yellow Wallpaper:Charlotte Perkins Gilman:gothic,feminist,classic"
  "174:The Picture of Dorian Gray:Oscar Wilde:gothic,philosophy,classic"
  "46:A Christmas Carol:Charles Dickens:christmas,classic,victorian"
  "1260:Jane Eyre:Charlotte Brontë:romance,gothic,classic"

  # More classics
  "1232:The Prince:Niccolò Machiavelli:philosophy,politics,classic"
  "2600:War and Peace:Leo Tolstoy:historical,classic,russian,epic"
  "2554:Crime and Punishment:Fyodor Dostoevsky:psychological,classic,russian"
  "1400:Great Expectations:Charles Dickens:bildungsroman,classic,victorian"
  "345:Dracula:Bram Stoker:gothic,horror,vampire,classic"
  "16:Peter Pan:J. M. Barrie:fantasy,children,classic"
  "74:The Adventures of Tom Sawyer:Mark Twain:adventure,classic,american"
  "76:Adventures of Huckleberry Finn:Mark Twain:adventure,classic,american,satire"
  "1080:A Modest Proposal:Jonathan Swift:satire,essay,classic"
  "1184:The Count of Monte Cristo:Alexandre Dumas:adventure,revenge,classic,french"

  # Philosophy and non-fiction
  "5200:Metamorphosis:Franz Kafka:existential,surreal,classic"
  "1497:The Republic:Plato:philosophy,politics,classic,ancient"
  "3600:Les Misérables:Victor Hugo:historical,classic,french,epic"
  "158:Emma:Jane Austen:romance,comedy,classic,regency"
  "4300:Ulysses:James Joyce:modernist,classic,irish,experimental"

  # Poetry and shorter works
  "1065:The Raven:Edgar Allan Poe:poetry,gothic,classic"
  "1952:The Yellow Wallpaper:Charlotte Perkins Gilman:short-story,feminist,gothic"
  "829:Gulliver's Travels:Jonathan Swift:satire,adventure,classic"
  "161:Sense and Sensibility:Jane Austen:romance,classic,regency"
  "205:Walden:Henry David Thoreau:philosophy,nature,transcendentalism,classic"
)

readonly GUTENBERG_BASE="https://www.gutenberg.org/cache/epub"

import_classics() {
  local limit="${1:-20}"

  log_info "Importing classic literature from Project Gutenberg..."
  log_info "Limit: $limit books"

  local tmpdir
  tmpdir=$(create_temp_dir "classics")
  local count=0
  local imported=0
  local failed=0

  local total=$limit
  if [ "$limit" -gt "${#CLASSIC_BOOKS[@]}" ]; then
    total=${#CLASSIC_BOOKS[@]}
  fi

  for book_info in "${CLASSIC_BOOKS[@]}"; do
    if [ "$count" -ge "$limit" ]; then
      break
    fi

    IFS=':' read -r id title author tags <<< "$book_info"
    count=$((count + 1))

    show_progress "$count" "$total" "$title by $author"

    local raw_file="$tmpdir/book-$id-raw.txt"
    local clean_file="$tmpdir/book-$id-clean.txt"

    # Download
    if ! download_file "$GUTENBERG_BASE/$id/pg$id.txt" "$raw_file" 2>/dev/null; then
      log_warning "Skipping $title (download failed)"
      failed=$((failed + 1))
      continue
    fi

    # Clean
    clean_gutenberg_text "$raw_file" "$clean_file"

    # Prepare full title with author
    local full_title="$title by $author"

    # Import with chunking
    # Use headers strategy for books (they usually have chapter structure)
    if forest node import \
      --file "$clean_file" \
      --title "$full_title" \
      --tags "$tags" \
      --chunk-strategy headers \
      --max-tokens 2000 \
      >/dev/null 2>&1; then
      imported=$((imported + 1))
    else
      log_warning "Failed to import: $full_title"
      failed=$((failed + 1))
    fi

    # Clean up individual files to save space
    rm -f "$raw_file" "$clean_file"
  done

  echo ""
  log_success "Imported $imported/$count books"
  if [ "$failed" -gt 0 ]; then
    log_warning "$failed books failed"
  fi

  # Cleanup
  rm -rf "$tmpdir"
}

# Main entry point
main() {
  local limit="${1:-20}"

  import_classics "$limit"
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" -ef "$0" ]; then
  main "$@"
fi
