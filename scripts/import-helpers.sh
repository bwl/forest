#!/usr/bin/env bash
# Shared utilities for bulk importing data into Forest

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
  echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
  echo -e "${GREEN}✔${NC} $*"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $*"
}

log_error() {
  echo -e "${RED}✖${NC} $*" >&2
}

# Download a file with retry logic
# Usage: download_file URL OUTPUT_PATH [MAX_RETRIES]
download_file() {
  local url="$1"
  local output="$2"
  local max_retries="${3:-3}"
  local retry_count=0

  while [ $retry_count -lt $max_retries ]; do
    if curl -L -f -s -S "$url" -o "$output"; then
      log_success "Downloaded: $(basename "$output")"
      return 0
    else
      retry_count=$((retry_count + 1))
      if [ $retry_count -lt $max_retries ]; then
        log_warning "Download failed, retrying ($retry_count/$max_retries)..."
        sleep 2
      fi
    fi
  done

  log_error "Failed to download after $max_retries attempts: $url"
  return 1
}

# Remove Project Gutenberg headers and footers
# Project Gutenberg files have standard markers
clean_gutenberg_text() {
  local input_file="$1"
  local output_file="$2"

  # Find start marker (various formats)
  # Common markers: "*** START OF", "START OF THE PROJECT", etc.
  # Find end marker: "*** END OF", "END OF THE PROJECT", etc.

  awk '
    BEGIN { printing = 0 }
    /\*\*\* START OF (THIS|THE) PROJECT GUTENBERG/ { printing = 1; next }
    /\*\*\* END OF (THIS|THE) PROJECT GUTENBERG/ { printing = 0 }
    printing { print }
  ' "$input_file" > "$output_file"

  if [ ! -s "$output_file" ]; then
    # Fallback: if no markers found, just copy the whole file
    log_warning "No Gutenberg markers found, using full text"
    cp "$input_file" "$output_file"
  fi
}

# Check if node with similar title already exists in Forest
# Usage: node_exists "Title"
# Returns: 0 if exists, 1 if not
node_exists() {
  local title="$1"
  # Use forest to search for the title
  # This is a simple check - you might want to make it more sophisticated
  if command -v forest >/dev/null 2>&1; then
    if forest node read "$title" >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

# Import a single document into Forest
# Usage: import_document FILE TITLE [TAGS] [EXTRA_FLAGS]
import_document() {
  local file="$1"
  local title="$2"
  local tags="${3:-}"
  local extra_flags="${4:-}"

  if [ ! -f "$file" ]; then
    log_error "File not found: $file"
    return 1
  fi

  log_info "Importing: $title"

  local import_cmd="forest node import --file \"$file\" --title \"$title\""

  if [ -n "$tags" ]; then
    import_cmd="$import_cmd --tags \"$tags\""
  fi

  if [ -n "$extra_flags" ]; then
    import_cmd="$import_cmd $extra_flags"
  fi

  if eval "$import_cmd"; then
    log_success "Imported: $title"
    return 0
  else
    log_error "Failed to import: $title"
    return 1
  fi
}

# Create a temporary directory for downloads
# Returns the directory path
create_temp_dir() {
  local prefix="${1:-forest-import}"
  local tmpdir
  tmpdir=$(mktemp -d "/tmp/${prefix}.XXXXXX")
  echo "$tmpdir"
}

# Progress bar helper
# Usage: show_progress CURRENT TOTAL MESSAGE
show_progress() {
  local current=$1
  local total=$2
  local message=$3
  local percent=$((current * 100 / total))
  local filled=$((percent / 2))
  local empty=$((50 - filled))

  printf "\r${BLUE}[${NC}"
  printf "%${filled}s" | tr ' ' '='
  printf "%${empty}s" | tr ' ' ' '
  printf "${BLUE}]${NC} %3d%% - %s" "$percent" "$message"

  if [ "$current" -eq "$total" ]; then
    echo ""
  fi
}

# Export functions for use in other scripts
export -f log_info log_success log_warning log_error
export -f download_file clean_gutenberg_text node_exists import_document
export -f create_temp_dir show_progress
