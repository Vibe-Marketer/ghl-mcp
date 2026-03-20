# BUILD_LOG

## 2026-03-19 Built: deploy.sh
- **Type**: script
- **Purpose**: Full deploy pipeline -- duplicate check, tsc, deploy to both workers (dlf-agency + ghl-mcp-v2), health verify. Supports --dry-run and --one flags.
- **Saves**: ~500 tokens per deploy (replaces 4 separate commands + manual verification)
- **Usage**: `./scripts/deploy.sh` | `./scripts/deploy.sh --dry-run` | `./scripts/deploy.sh --one dlf-agency`

## 2026-03-19 Built: check-duplicates.sh
- **Type**: script
- **Purpose**: Scans all tool files for duplicate tool names. Exits 1 on duplicates. --list flag shows all 508 tools with their source files.
- **Saves**: ~300 tokens per check (replaces multi-step grep + sort + uniq)
- **Usage**: `./scripts/check-duplicates.sh` | `./scripts/check-duplicates.sh --list`

## 2026-03-19 Built: count-tools.sh
- **Type**: script
- **Purpose**: Shows tool count per domain module. --detail flag lists individual tool names.
- **Saves**: ~200 tokens per audit
- **Usage**: `./scripts/count-tools.sh` | `./scripts/count-tools.sh --detail`

## 2026-03-19 Built: add-domain.sh
- **Type**: script
- **Purpose**: Scaffolds a new GHL domain module (client factory + tools registration). Generates both files and prints manual wiring instructions.
- **Saves**: ~1500 tokens per new domain (replaces copy-paste-rename of existing module pair)
- **Usage**: `./scripts/add-domain.sh <domain-name>` (kebab-case, e.g. `custom-fields`)

## 2026-03-19 Built: add-tool.sh
- **Type**: script
- **Purpose**: Generates client method + tool registration stubs for a new tool. Validates no duplicate exists. Prints both stubs for copy-paste.
- **Saves**: ~800 tokens per tool (replaces boilerplate typing)
- **Usage**: `./scripts/add-tool.sh <domain> <tool_name> <method> <path> <description>`

## 2026-03-19 Built: mcp-add-tool.md (skill)
- **Type**: skill
- **Purpose**: Step-by-step guide for Claude to add a tool to the MCP server. Covers client method, tool registration, duplicate check, and deploy.
- **Saves**: ~400 tokens (eliminates re-reading CLAUDE.md patterns each time)
- **Location**: `.claude/skills/mcp-add-tool.md`

## 2026-03-19 Built: mcp-deploy-verify.md (skill)
- **Type**: skill
- **Purpose**: Deploy and verify guide -- quick reference for deploy commands, worker URLs, and troubleshooting health failures.
- **Location**: `.claude/skills/mcp-deploy-verify.md`

## 2026-03-19 Built: mcp-audit-domain.md (skill)
- **Type**: skill
- **Purpose**: Audit checklist for reviewing a domain module -- orphaned methods, missing tools, pattern violations, API coverage gaps.
- **Location**: `.claude/skills/mcp-audit-domain.md`

## 2026-03-19 Built: mcp-error-diagnosis.md (skill)
- **Type**: skill
- **Purpose**: Structured error diagnosis -- fetches errors from D1, groups by tool name, classifies by HTTP code (AUTH/SCOPE/VALIDATION/PATH), cross-references known GHL quirks, proposes fixes. Replaces ad-hoc debugging.
- **Saves**: ~800-1200 tokens per diagnosis session
- **Location**: `.claude/skills/mcp-error-diagnosis.md`

## 2026-03-19 Built: mcp-tool-health.md (skill)
- **Type**: skill
- **Purpose**: Domain health check -- 14 read-only probe tools (one per domain), classify results as HEALTHY/AUTH_FAIL/API_ERROR/CLIENT_ERROR, triage all-fail vs partial-fail scenarios, provide fix commands.
- **Saves**: ~600-1000 tokens per health check
- **Location**: `.claude/skills/mcp-tool-health.md`

## 2026-03-19 Built: mcp-self-heal.md (skill)
- **Type**: skill
- **Purpose**: End-to-end error-to-fix pipeline -- given a tool name + error, locates source files, reads handler + client method, classifies error, checks known GHL quirks, proposes schema/handler/client/auth fix, verifies and documents.
- **Saves**: ~1500-2500 tokens per fix
- **Location**: `.claude/skills/mcp-self-heal.md`
