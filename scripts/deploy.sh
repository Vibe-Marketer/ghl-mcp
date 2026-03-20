#!/usr/bin/env bash
# deploy.sh — Type-check, deploy to both workers, verify health
#
# Usage:
#   ./scripts/deploy.sh              Deploy to both workers (dlf-agency + ghl-mcp-v2)
#   ./scripts/deploy.sh --dry-run    Type-check only, no deploy
#   ./scripts/deploy.sh --one NAME   Deploy to single worker (dlf-agency or ghl-mcp-v2)

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

DLF_AGENCY_URL="https://dlf-agency.skool-203.workers.dev"
GHL_MCP_V2_URL="https://ghl-mcp-v2.skool-203.workers.dev"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DRY_RUN=false
TARGET="both"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --one) TARGET="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "=== GHL MCP Server Deploy ==="
echo ""

# Step 1: Check for duplicate tool names (fatal)
echo "[1/4] Checking for duplicate tool names..."
DUPES=$(grep -A1 'server\.tool(' src/tools/*.ts \
  | grep '"ghl_' \
  | sed 's/.*"\(ghl_[^"]*\)".*/\1/' \
  | sort | uniq -d || true)

if [[ -n "$DUPES" ]]; then
  echo -e "${RED}FATAL: Duplicate tool names found:${NC}"
  echo "$DUPES"
  echo "Fix duplicates before deploying. Duplicate names crash the worker on startup."
  exit 1
fi

TOOL_COUNT=$(grep -A1 'server\.tool(' src/tools/*.ts | grep '"ghl_' | wc -l | tr -d ' ')
echo -e "  ${GREEN}No duplicates. ${TOOL_COUNT} tools registered.${NC}"

# Step 2: TypeScript type-check
echo ""
echo "[2/4] Running TypeScript type-check..."
if ! npx tsc --noEmit 2>&1; then
  echo -e "${RED}TypeScript errors found. Fix before deploying.${NC}"
  exit 1
fi
echo -e "  ${GREEN}Type-check passed.${NC}"

if $DRY_RUN; then
  echo ""
  echo -e "${YELLOW}Dry run complete. No deploy performed.${NC}"
  exit 0
fi

# Step 3: Deploy
echo ""
echo "[3/4] Deploying..."

deploy_worker() {
  local name="$1"
  echo "  Deploying to ${name}..."
  if npx wrangler deploy --name "$name" 2>&1; then
    echo -e "  ${GREEN}${name} deployed.${NC}"
    return 0
  else
    echo -e "  ${RED}${name} deploy FAILED.${NC}"
    return 1
  fi
}

if [[ "$TARGET" == "both" ]]; then
  deploy_worker "dlf-agency"
  deploy_worker "ghl-mcp-v2"
elif [[ "$TARGET" == "dlf-agency" || "$TARGET" == "ghl-mcp-v2" ]]; then
  deploy_worker "$TARGET"
else
  echo -e "${RED}Unknown target: ${TARGET}. Use 'dlf-agency' or 'ghl-mcp-v2'.${NC}"
  exit 1
fi

# Step 4: Health checks
echo ""
echo "[4/4] Verifying health..."

check_health() {
  local url="$1"
  local name="$2"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "${url}/health" --max-time 10 2>/dev/null || echo "000")
  if [[ "$status" == "200" ]]; then
    echo -e "  ${GREEN}${name}: OK (${status})${NC}"
  else
    echo -e "  ${RED}${name}: FAILED (${status})${NC}"
    echo "  Likely cause: duplicate tool name or registration error."
    echo "  Check: curl ${url}/health"
    return 1
  fi
}

HEALTH_FAIL=false

if [[ "$TARGET" == "both" || "$TARGET" == "dlf-agency" ]]; then
  check_health "$DLF_AGENCY_URL" "dlf-agency" || HEALTH_FAIL=true
fi
if [[ "$TARGET" == "both" || "$TARGET" == "ghl-mcp-v2" ]]; then
  check_health "$GHL_MCP_V2_URL" "ghl-mcp-v2" || HEALTH_FAIL=true
fi

echo ""
if $HEALTH_FAIL; then
  echo -e "${RED}Deploy completed but health check failed. Investigate immediately.${NC}"
  exit 1
else
  echo -e "${GREEN}Deploy successful. All health checks passed.${NC}"
fi
