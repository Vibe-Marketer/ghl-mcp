#!/usr/bin/env bash
# add-tool.sh — Generate a tool stub (client method + tool registration)
#
# Usage:
#   ./scripts/add-tool.sh <domain> <tool_name> <http_method> <path> <description>
#
# Example:
#   ./scripts/add-tool.sh contacts ghl_search_contacts GET /contacts/search "Search contacts with filters"
#
# Output: prints both stubs to stdout for copy-paste into the right files.

set -euo pipefail

if [[ $# -lt 5 ]]; then
  echo "Usage: $0 <domain> <tool_name> <http_method> <path> <description>"
  echo ""
  echo "  domain:       Domain module name (e.g., contacts, calendars)"
  echo "  tool_name:    Tool name with ghl_ prefix (e.g., ghl_search_contacts)"
  echo "  http_method:  GET, POST, PUT, PATCH, DELETE"
  echo "  path:         API path (e.g., /contacts/search)"
  echo "  description:  Tool description string"
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="$1"
TOOL_NAME="$2"
HTTP_METHOD="$3"
API_PATH="$4"
DESCRIPTION="$5"

# Validate tool name prefix
if [[ "$TOOL_NAME" != ghl_* ]]; then
  echo "WARNING: Tool name '${TOOL_NAME}' does not start with 'ghl_'. Convention requires ghl_ prefix."
fi

# Check for duplicate
if grep -rq "\"${TOOL_NAME}\"" "${PROJECT_DIR}/src/tools/"*.ts 2>/dev/null; then
  echo "ERROR: Tool name '${TOOL_NAME}' already exists:"
  grep -rn "\"${TOOL_NAME}\"" "${PROJECT_DIR}/src/tools/"*.ts
  exit 1
fi

# Convert kebab-case domain to camelCase (perl for portability)
CAMEL=$(echo "$DOMAIN" | perl -pe 's/-([a-z])/uc($1)/ge')

# Derive a method name from tool name (strip ghl_ prefix, convert underscores to camelCase)
METHOD_NAME=$(echo "$TOOL_NAME" | sed 's/^ghl_//' | perl -pe 's/_([a-z])/uc($1)/ge')

# Determine if body is needed
NEEDS_BODY=false
if [[ "$HTTP_METHOD" == "POST" || "$HTTP_METHOD" == "PUT" || "$HTTP_METHOD" == "PATCH" ]]; then
  NEEDS_BODY=true
fi

echo "=== Client method stub (src/client/${DOMAIN}.ts) ==="
echo ""
if $NEEDS_BODY; then
  cat << EOF
    async ${METHOD_NAME}(data: any, locationId?: string) {
      return client.request<any>("${HTTP_METHOD}", \`${API_PATH}\`, {
        body: { ...data, locationId: data.locationId || locationId || client.locationId },
        version: "2021-07-28",
      });
    },
EOF
else
  cat << EOF
    async ${METHOD_NAME}(locationId?: string) {
      return client.request<any>("${HTTP_METHOD}", \`${API_PATH}\`, {
        query: { locationId: locationId || client.locationId },
        version: "2021-07-28",
      });
    },
EOF
fi

echo ""
echo "=== Tool registration stub (src/tools/${DOMAIN}.ts) ==="
echo ""
if $NEEDS_BODY; then
  cat << EOF
  server.tool(
    "${TOOL_NAME}",
    "${DESCRIPTION}",
    {
      data: z.record(z.any()).describe("Request body"),
      locationId: z.string().optional().describe("GHL Location ID"),
    },
    async ({ data, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.${CAMEL}.${METHOD_NAME}(data, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );
EOF
else
  cat << EOF
  server.tool(
    "${TOOL_NAME}",
    "${DESCRIPTION}",
    {
      locationId: z.string().optional().describe("GHL Location ID"),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.${CAMEL}.${METHOD_NAME}(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );
EOF
fi
echo ""
echo "Tool '${TOOL_NAME}' stub generated. Copy into the appropriate files."
