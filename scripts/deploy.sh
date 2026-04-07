#!/usr/bin/env bash
# deploy.sh — Type-check and deploy the GHL MCP worker, then verify health
#
# Usage:
#   ./scripts/deploy.sh              Deploy the worker
#   ./scripts/deploy.sh --dry-run    Type-check only, no deploy

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# Read worker name from wrangler.toml
WORKER_NAME=$(grep '^name' wrangler.toml | head -1 | sed 's/name *= *"\(.*\)"/\1/')

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "=== GHL MCP Server Deploy (${WORKER_NAME}) ==="
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
echo "[3/4] Deploying ${WORKER_NAME}..."
if npx wrangler deploy 2>&1; then
  echo -e "  ${GREEN}${WORKER_NAME} deployed.${NC}"
else
  echo -e "  ${RED}${WORKER_NAME} deploy FAILED.${NC}"
  exit 1
fi

# Step 4: Health check
echo ""
echo "[4/4] Verifying health..."

# Get the deployed URL from wrangler output or construct it
WORKER_URL=$(npx wrangler deployments list --json 2>/dev/null | grep -o 'https://[^"]*workers.dev' | head -1 || true)
if [[ -z "$WORKER_URL" ]]; then
  # Fallback: construct from worker name (assumes workers.dev subdomain)
  echo -e "  ${YELLOW}Could not detect URL automatically. Check health manually:${NC}"
  echo "  curl https://${WORKER_NAME}.<your-subdomain>.workers.dev/health"
else
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${WORKER_URL}/health" --max-time 10 2>/dev/null || echo "000")
  if [[ "$STATUS" == "200" ]]; then
    echo -e "  ${GREEN}${WORKER_NAME}: OK (${STATUS}) — ${WORKER_URL}${NC}"
  else
    echo -e "  ${RED}${WORKER_NAME}: FAILED (${STATUS})${NC}"
    echo "  Check: curl ${WORKER_URL}/health"
    exit 1
  fi
fi

echo ""
echo -e "${GREEN}Deploy successful.${NC}"
