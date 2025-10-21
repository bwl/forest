#!/usr/bin/env bash
#
# test-all.sh - Test all three TLDR documentation generators
#
# Usage: ./test-all.sh [cli-name]
# Example: ./test-all.sh forest

set -euo pipefail

CLI="${1:-forest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================="
echo "Testing TLDR Documentation Generators"
echo "CLI: $CLI"
echo "=================================================="
echo ""

# Test Bash version
echo "1. Testing Bash version (tldr-doc-gen.sh)..."
"$SCRIPT_DIR/tldr-doc-gen.sh" "$CLI" > /dev/null 2>&1
echo "   ✔ Generated: ${CLI}_tldr.txt"
echo ""

# Test Node.js version
echo "2. Testing Node.js version (tldr-doc-gen.js)..."
node "$SCRIPT_DIR/tldr-doc-gen.js" "$CLI" > /dev/null 2>&1
echo "   ✔ Generated: ${CLI}_tldr.txt"
echo "   ✔ Generated: ${CLI}_tldr.md"
echo "   ✔ Generated: ${CLI}_tldr.json"
echo ""

# Test Python version
echo "3. Testing Python version (tldr-doc-gen.py)..."
python3 "$SCRIPT_DIR/tldr-doc-gen.py" "$CLI" --html > /dev/null 2>&1
echo "   ✔ Generated: ${CLI}_tldr_analytics.json"
echo "   ✔ Generated: ${CLI}_tldr_report.html"
echo ""

# Show file sizes
echo "=================================================="
echo "Generated Files"
echo "=================================================="
ls -lh "${CLI}_tldr"* 2>/dev/null | awk '{print $9, "-", $5}'
echo ""

# Summary
echo "=================================================="
echo "Summary"
echo "=================================================="
echo "All three generators completed successfully!"
echo ""
echo "Output formats:"
echo "  • Bash:    TXT (human-readable)"
echo "  • Node.js: TXT, MD (with TOC), JSON (with analytics)"
echo "  • Python:  JSON (analytics), HTML (visual report)"
echo ""
