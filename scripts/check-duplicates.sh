#!/usr/bin/env bash
# check-duplicates.sh — Find duplicate tool names across all tool modules
#
# Usage:
#   ./scripts/check-duplicates.sh          Exit 1 if duplicates found
#   ./scripts/check-duplicates.sh --list   List all tool names with file locations

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS_DIR="${PROJECT_DIR}/src/tools"

# Extract tool names: grab lines after server.tool( that contain the quoted name
extract_names() {
  grep -A1 'server\.tool(' "$TOOLS_DIR"/*.ts \
    | grep '"ghl_' \
    | sed 's/.*"\(ghl_[^"]*\)".*/\1/'
}

# Extract tool names with file info
extract_names_with_files() {
  grep -A1 'server\.tool(' "$TOOLS_DIR"/*.ts \
    | grep '"ghl_' \
    | sed 's|.*/src/tools/\([^-]*\).*"\(ghl_[^"]*\)".*|\1  \2|'
}

if [[ "${1:-}" == "--list" ]]; then
  echo "=== All registered tools ==="
  extract_names_with_files | sort -k2
  echo ""
  TOTAL=$(extract_names | wc -l | tr -d ' ')
  echo "Total: ${TOTAL} tools"
  exit 0
fi

# Find duplicates
DUPES=$(extract_names | sort | uniq -d || true)

if [[ -n "$DUPES" ]]; then
  echo "DUPLICATE TOOL NAMES FOUND:"
  echo ""
  while IFS= read -r name; do
    echo "  $name"
    grep -rn "\"$name\"" "$TOOLS_DIR"/*.ts | sed 's|.*/src/tools/|    src/tools/|'
  done <<< "$DUPES"
  echo ""
  echo "Fix: rename one of the duplicates. Duplicate names crash the worker on startup."
  exit 1
else
  TOTAL=$(extract_names | wc -l | tr -d ' ')
  echo "No duplicates found. ${TOTAL} unique tools registered."
  exit 0
fi
