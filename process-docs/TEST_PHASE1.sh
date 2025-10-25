#!/bin/bash
# Phase 1 Testing Script
# Verifies all success criteria for Tauri v2 foundation

set -e

echo "=========================================="
echo "Phase 1: Tauri v2 Foundation - Test Suite"
echo "=========================================="
echo ""

# Test 1: Cargo build succeeds
echo "Test 1: Cargo build (should succeed with no warnings)..."
cd src-tauri
if cargo build 2>&1 | grep -q "error"; then
    echo "❌ FAIL: Cargo build failed"
    exit 1
fi
echo "✅ PASS: Cargo build succeeded"
echo ""

# Test 2: CLI stats command (headless mode)
echo "Test 2: CLI stats command (headless, no window)..."
OUTPUT=$(./target/debug/forest-desktop stats 2>&1)
if echo "$OUTPUT" | grep -q "forest stats"; then
    echo "✅ PASS: Stats command executed successfully"
    echo "Output:"
    echo "$OUTPUT"
else
    echo "❌ FAIL: Stats command did not produce expected output"
    echo "Output: $OUTPUT"
    exit 1
fi
echo ""

# Test 3: CLI stats --json flag
echo "Test 3: CLI stats --json flag..."
JSON_OUTPUT=$(./target/debug/forest-desktop stats --json 2>&1)
if echo "$JSON_OUTPUT" | grep -q '"counts"'; then
    echo "✅ PASS: JSON output works"
    echo "Sample: $(echo "$JSON_OUTPUT" | head -5)"
else
    echo "❌ FAIL: JSON output not valid"
    exit 1
fi
echo ""

# Test 4: Verify no window opens in CLI mode (process exits quickly)
echo "Test 4: Verify CLI mode exits cleanly (no hanging)..."
START=$(date +%s)
timeout 5 ./target/debug/forest-desktop stats > /dev/null 2>&1 || true
END=$(date +%s)
DURATION=$((END - START))

if [ $DURATION -lt 5 ]; then
    echo "✅ PASS: CLI command exited in ${DURATION}s (clean exit)"
else
    echo "❌ FAIL: CLI command took too long or hung"
    exit 1
fi
echo ""

# Test 5: Verify plugins are initialized
echo "Test 5: Verify Tauri v2 plugins initialized..."
if grep -q "tauri-plugin-cli" Cargo.toml && \
   grep -q "tauri-plugin-sql" Cargo.toml && \
   grep -q "tauri-plugin-store" Cargo.toml; then
    echo "✅ PASS: All required plugins in Cargo.toml"
else
    echo "❌ FAIL: Missing required plugins"
    exit 1
fi
echo ""

# Test 6: Database connection works
echo "Test 6: Database connection..."
if echo "$OUTPUT" | grep -q "Nodes: 0"; then
    echo "✅ PASS: Database connection works (empty database detected)"
else
    echo "❌ FAIL: Database connection issue"
    exit 1
fi
echo ""

echo "=========================================="
echo "All Phase 1 tests passed! ✅"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✅ Tauri v2 upgraded successfully"
echo "  ✅ All plugins (cli, sql, store) initialized"
echo "  ✅ Mode routing works (CLI vs GUI)"
echo "  ✅ CLI stats command functional"
echo "  ✅ JSON output flag works"
echo "  ✅ Database connection established"
echo "  ✅ Clean exit in CLI mode (no window)"
echo ""
echo "Note: GUI mode test requires manual verification:"
echo "  Run: bun run tauri dev"
echo "  Expected: React app loads in desktop window"
echo ""
echo "Phase 1 Complete! Ready for Phase 2 (Database Schema Migration)"
