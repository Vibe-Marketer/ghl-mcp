#!/usr/bin/env bash
# count-tools.sh — Count tools per domain module
#
# Usage:
#   ./scripts/count-tools.sh             Summary table
#   ./scripts/count-tools.sh --detail    Show tool names per module

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS_DIR="${PROJECT_DIR}/src/tools"
DETAIL="${1:-}"

echo "=== GHL MCP Tool Count by Domain ==="
echo ""

TOTAL=0

printf "%-25s %s\n" "Module" "Tools"
printf "%-25s %s\n" "-------" "-----"

for f in "$TOOLS_DIR"/*.ts; do
  base=$(basename "$f" .ts)
  # Skip non-domain files
  [[ "$base" == "index" || "$base" == "_helpers" || "$base" == "_disabled" ]] && continue

  count=$(grep -c 'server\.tool(' "$f" 2>/dev/null || echo 0)
  TOTAL=$((TOTAL + count))
  printf "%-25s %d\n" "$base" "$count"

  if [[ "$DETAIL" == "--detail" && $count -gt 0 ]]; then
    grep -A1 'server\.tool(' "$f" \
      | grep '"ghl_' \
      | sed 's/.*"\(ghl_[^"]*\)".*/    \1/'
  fi
done

echo ""
printf "%-25s %d\n" "TOTAL" "$TOTAL"
