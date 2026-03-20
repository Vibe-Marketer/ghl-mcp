#!/usr/bin/env bash
# add-domain.sh — Scaffold a new GHL domain module (client + tools + wiring)
#
# Usage:
#   ./scripts/add-domain.sh <domain-name>
#
# Example:
#   ./scripts/add-domain.sh invoices
#   Creates: src/client/invoices.ts, src/tools/invoices.ts
#   Prints: lines to add to src/client/index.ts and src/tools/index.ts

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <domain-name>"
  echo "  domain-name: kebab-case (e.g., invoices, custom-fields, social-media)"
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="$1"

# Convert kebab-case to camelCase for code identifiers
camel_case() {
  echo "$1" | perl -pe 's/-([a-z])/uc($1)/ge'
}

# Convert kebab-case to PascalCase
pascal_case() {
  echo "$1" | perl -pe 's/(^|-)([a-z])/uc($2)/ge'
}

CAMEL=$(camel_case "$DOMAIN")
PASCAL=$(pascal_case "$DOMAIN")

CLIENT_FILE="${PROJECT_DIR}/src/client/${DOMAIN}.ts"
TOOLS_FILE="${PROJECT_DIR}/src/tools/${DOMAIN}.ts"

# Check if files already exist
if [[ -f "$CLIENT_FILE" ]]; then
  echo "ERROR: ${CLIENT_FILE} already exists."
  exit 1
fi
if [[ -f "$TOOLS_FILE" ]]; then
  echo "ERROR: ${TOOLS_FILE} already exists."
  exit 1
fi

# Generate client file
cat > "$CLIENT_FILE" << EOF
import { BaseGHLClient } from "./base";

export function ${CAMEL}Methods(client: BaseGHLClient) {
  return {
    // TODO: Add methods for the ${DOMAIN} domain
    //
    // Example:
    // async list${PASCAL}(locationId?: string) {
    //   return client.request<any>("GET", \`/${DOMAIN}/\`, {
    //     query: { locationId: locationId || client.locationId },
    //     version: "2021-07-28",
    //   });
    // },
  };
}
EOF

# Generate tools file
cat > "$TOOLS_FILE" << EOF
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../types";
import { ok, err, resolveClient } from "./_helpers";

export function register${PASCAL}Tools(server: McpServer, env: Env) {
  // TODO: Add tool registrations for the ${DOMAIN} domain
  //
  // Example:
  // server.tool(
  //   "ghl_list_${DOMAIN//-/_}",
  //   "List ${DOMAIN} for a location.",
  //   {
  //     locationId: z.string().optional().describe("GHL Location ID"),
  //   },
  //   async ({ locationId }) => {
  //     try {
  //       const client = await resolveClient(env, locationId);
  //       const result = await client.${CAMEL}.list${PASCAL}(locationId || client.locationId);
  //       return ok(JSON.stringify(result, null, 2));
  //     } catch (e: any) {
  //       return err(e);
  //     }
  //   }
  // );
}
EOF

echo "Created:"
echo "  ${CLIENT_FILE}"
echo "  ${TOOLS_FILE}"
echo ""
echo "=== Manual wiring required ==="
echo ""
echo "1. Add to src/client/index.ts:"
echo ""
echo "   // Import"
echo "   import { ${CAMEL}Methods } from \"./${DOMAIN}\";"
echo ""
echo "   // Property declaration (in GHLClient class)"
echo "   ${CAMEL}: ReturnType<typeof ${CAMEL}Methods>;"
echo ""
echo "   // Constructor (inside constructor body)"
echo "   this.${CAMEL} = ${CAMEL}Methods(this);"
echo ""
echo "   // Re-export (at bottom)"
echo "   export * from \"./${DOMAIN}\";"
echo ""
echo "2. Add to src/tools/index.ts:"
echo ""
echo "   // Import"
echo "   import { register${PASCAL}Tools } from \"./${DOMAIN}\";"
echo ""
echo "   // Inside registerAllTools()"
echo "   register${PASCAL}Tools(server, env);"
echo ""
echo "3. Run: ./scripts/check-duplicates.sh"
echo "4. Run: npx tsc --noEmit"
